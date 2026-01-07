/**
 * Sign-In with Ethereum (SIWE) API Route
 * Implements EIP-4361 standard for Web3 wallet authentication
 * 
 * Flow:
 * 1. Verify signature is valid
 * 2. Check if wallet already has an account
 * 3. Create auth user if needed
 * 4. Generate magic link token and exchange for session
 * 
 * 🔐 Uses admin.generateLink() for wallet-only authentication
 * ✅ Email provider can remain DISABLED in Supabase Dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase admin client (for user management)
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

interface SIWERequest {
  message: string
  signature: string
  address: string
}

/**
 * Verify SIWE signature
 */
function verifySignature(message: string, signature: string, address: string): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature)
    const isValid = recoveredAddress.toLowerCase() === address.toLowerCase()
    
    if (!isValid) {
      console.error('Signature verification mismatch:', {
        expected: address.toLowerCase(),
        recovered: recoveredAddress.toLowerCase(),
      })
    }
    
    return isValid
  } catch (error) {
    console.error('Signature verification failed:', error)
    return false
  }
}

/**
 * Parse SIWE message to extract fields
 */
function parseSIWEMessage(message: string): { domain: string; address: string; nonce: string } | null {
  try {
    const lines = message.split('\n')
    const domain = lines[0] // First line is domain
    const addressLine = lines.find(l => l.startsWith('0x'))
    const nonceLine = lines.find(l => l.startsWith('Nonce: '))
    
    if (!addressLine || !nonceLine) return null
    
    return {
      domain,
      address: addressLine.trim(),
      nonce: nonceLine.replace('Nonce: ', '').trim()
    }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SIWERequest = await request.json()
    const { message, signature, address } = body

    console.log('🔐 SIWE auth request received for:', address)

    // Validate input
    if (!message || !signature || !address) {
      console.error('Missing required fields:', { message: !!message, signature: !!signature, address: !!address })
      return NextResponse.json(
        { error: 'Missing required fields: message, signature, address' },
        { status: 400 }
      )
    }

    // Verify signature
    console.log('🔍 Verifying signature...')
    const isValidSignature = verifySignature(message, signature, address)
    if (!isValidSignature) {
      console.error('❌ Signature verification failed for:', address)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }
    console.log('✅ Signature verified for:', address)

    // Parse and validate SIWE message
    const parsed = parseSIWEMessage(message)
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid SIWE message format' },
        { status: 400 }
      )
    }

    // Verify address in message matches provided address
    if (parsed.address.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json(
        { error: 'Address mismatch between message and signature' },
        { status: 401 }
      )
    }

    // Check if wallet already exists in players table
    const supabaseAdmin = getSupabaseAdmin()
    const { data: existingPlayer } = await supabaseAdmin
      .from('players')
      .select('user_id, wallet_address')
      .eq('wallet_address', address.toLowerCase())
      .single()

    // Synthetic email for Supabase auth (required by schema)
    const email = `${address.toLowerCase()}@ethereum.wallet`

    if (existingPlayer) {
      // Wallet exists in players table - verify auth user still exists
      console.log('✅ Returning user:', address)
      
      // First, check if the auth user actually exists
      const { data: authUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(
        existingPlayer.user_id
      )

      if (getUserError || !authUser.user) {
        // Auth user was deleted but player record remains - recreate auth user
        console.log('🔄 Auth user missing, recreating for:', address)
        
        const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            wallet_address: address.toLowerCase(),
            wallet_type: 'ethereum',
            auth_method: 'siwe',
          },
        })

        if (createError || !newAuthUser.user) {
          console.error('Failed to recreate auth user:', createError)
          return NextResponse.json(
            { error: 'Failed to recreate authentication' },
            { status: 500 }
          )
        }

        // Update the players table with new user_id
        const { error: updatePlayerError } = await supabaseAdmin
          .from('players')
          .update({ user_id: newAuthUser.user.id })
          .eq('wallet_address', address.toLowerCase())

        if (updatePlayerError) {
          console.error('Failed to update player user_id:', updatePlayerError)
        }

        // Generate magic link token and exchange for session
        console.log('🔐 Generating auth token for recreated user')
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: email,
        })

        if (linkError || !linkData) {
          console.error('Failed to generate auth link:', linkError)
          return NextResponse.json(
            { error: 'Authentication failed' },
            { status: 500 }
          )
        }

        // Extract token from the action link
        const url = new URL(linkData.properties.action_link)
        const token = url.searchParams.get('token')
        const type = url.searchParams.get('type')

        if (!token || type !== 'magiclink') {
          console.error('Invalid magic link format')
          return NextResponse.json(
            { error: 'Authentication failed' },
            { status: 500 }
          )
        }

        // Exchange token for session
        const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.verifyOtp({
          token_hash: token,
          type: 'magiclink'
        })

        if (sessionError || !sessionData.session) {
          console.error('Failed to verify token:', sessionError)
          return NextResponse.json(
            { error: 'Authentication failed' },
            { status: 500 }
          )
        }

        const response = NextResponse.json({
          success: true,
          isNewUser: false,
          session: sessionData.session,
          user: sessionData.user,
          address: address.toLowerCase()
        })
        
        // Set session cookies
        response.cookies.set('sb-access-token', sessionData.session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: sessionData.session.expires_in
        })
        response.cookies.set('sb-refresh-token', sessionData.session.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7 // 7 days
        })
        
        return response
      }
      
      // Auth user exists - verify email matches
      console.log('📧 Expected email:', email)
      console.log('📧 Auth user email:', authUser.user.email)
      
      // If email doesn't match, update it
      if (authUser.user.email !== email) {
        console.log('⚠️ Email mismatch, updating auth user email')
        const { error: updateEmailError } = await supabaseAdmin.auth.admin.updateUserById(
          existingPlayer.user_id,
          { email }
        )
        if (updateEmailError) {
          console.error('Failed to update email:', updateEmailError)
        }
      }
      
      // Generate magic link token and exchange for session
      console.log('🔐 Generating auth token for returning user')
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/callback`
        }
      })

      if (linkError || !linkData) {
        console.error('Failed to generate auth link:', linkError)
        return NextResponse.json(
          { error: 'Authentication failed' },
          { status: 401 }
        )
      }

      // Extract tokens from the hash
      const url = new URL(linkData.properties.action_link)
      const token = url.searchParams.get('token')
      const type = url.searchParams.get('type')

      if (!token || type !== 'magiclink') {
        console.error('Invalid magic link format')
        return NextResponse.json(
          { error: 'Authentication failed' },
          { status: 500 }
        )
      }

      // Exchange token for session
      const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.verifyOtp({
        token_hash: token,
        type: 'magiclink'
      })

      if (sessionError || !sessionData.session) {
        console.error('Failed to verify token:', sessionError)
        return NextResponse.json(
          { error: 'Authentication failed' },
          { status: 500 }
        )
      }

      const response = NextResponse.json({
        success: true,
        isNewUser: false,
        session: sessionData.session,
        user: sessionData.user,
        address: address.toLowerCase()
      })
      
      // Set session cookies
      response.cookies.set('sb-access-token', sessionData.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: sessionData.session.expires_in
      })
      response.cookies.set('sb-refresh-token', sessionData.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })
      
      return response
    } else {
      // New wallet - create new account (or recover if auth user already exists)
      console.log('🆕 New user (or missing player) for:', address)
      console.log('📧 Using email:', email)

      let authUserId: string | null = null
      let isRecoveredUser = false

      // FIRST: Check if auth user already exists using admin API (most reliable)
      console.log('🔍 Checking if auth user exists via admin API...')
      const { data: { users: existingUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000 // Should be enough for most cases
      })

      if (!listError && existingUsers) {
        const existingUser = existingUsers.find(u => u.email === email)
        if (existingUser) {
          authUserId = existingUser.id
          isRecoveredUser = true
          console.log('✅ Found existing auth user:', authUserId)
        }
      }

      // If no existing user found, create new auth user
      if (!authUserId) {
        console.log('🆕 Creating new auth user...')
        const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            wallet_address: address.toLowerCase(),
            wallet_type: 'ethereum',
            auth_method: 'siwe',
          },
        })

        if (signUpError || !authData.user) {
          console.error('❌ User creation error:', signUpError?.message, signUpError?.status, signUpError)
          return NextResponse.json(
            { error: 'Failed to create user account' },
            { status: 500 }
          )
        }
        
        authUserId = authData.user.id
        console.log('✅ Created new auth user:', authUserId)
      }

      // Create player record if missing, reconcile duplicates if constraints hit
      const lowerWallet = address.toLowerCase()
      console.log('📝 Ensuring player record for wallet:', lowerWallet)

      // First attempt a straight insert (fast path for new users)
      const basePlayerPayload = {
        user_id: authUserId,
        wallet_address: lowerWallet,
        username: `Captain-${address.slice(2, 8)}`,
        submarine_tier: 1,
        total_resources_mined: 0,
        total_ocx_earned: 0,
        is_active: true,
        last_login: new Date().toISOString(),
      }

      const { error: playerInsertError } = await supabaseAdmin
        .from('players')
        .insert(basePlayerPayload)

      if (playerInsertError) {
        console.error('Player insert error:', playerInsertError)

        // 23505 = unique_violation (wallet_address or user_id). Try to reconcile instead of failing.
        if (playerInsertError.code === '23505') {
          console.log('♻️ Player already exists, reconciling links...')

          // Check by wallet
          const { data: playerByWallet, error: walletCheckError } = await supabaseAdmin
            .from('players')
            .select('id, user_id')
            .eq('wallet_address', lowerWallet)
            .single()

          if (!walletCheckError && playerByWallet) {
            console.log('📋 Found player by wallet:', playerByWallet.id)
            if (playerByWallet.user_id !== authUserId) {
              const { error: updateUserIdError } = await supabaseAdmin
                .from('players')
                .update({ user_id: authUserId })
                .eq('id', playerByWallet.id)

              if (updateUserIdError) {
                console.error('Player update error (wallet match):', updateUserIdError)
              } else {
                console.log('✅ Player user_id updated (wallet match)')
              }
            } else {
              console.log('✅ Player already linked to auth user (wallet match)')
            }
          } else {
            // If no wallet match, try by user_id (maybe wallet changed case or was updated)
            const { data: playerByUser, error: userCheckError } = await supabaseAdmin
              .from('players')
              .select('id, wallet_address')
              .eq('user_id', authUserId)
              .single()

            if (!userCheckError && playerByUser) {
              console.log('📋 Found player by user_id:', playerByUser.id)
              if (playerByUser.wallet_address !== lowerWallet) {
                const { error: updateWalletError } = await supabaseAdmin
                  .from('players')
                  .update({ wallet_address: lowerWallet })
                  .eq('id', playerByUser.id)

                if (updateWalletError) {
                  console.error('Player update error (user match):', updateWalletError)
                } else {
                  console.log('✅ Player wallet updated (user match)')
                }
              } else {
                console.log('✅ Player already linked to auth user (user match)')
              }
            } else {
              console.log('⚠️ Could not reconcile player; check constraints and RLS policies')
              // If we can't reconcile, fail out
              return NextResponse.json(
                { error: 'Failed to create player record' },
                { status: 500 }
              )
            }
          }
        } else {
          // Not a unique violation -> bail
          // Only delete auth user if it was newly created in this flow
          if (!isRecoveredUser && authUserId) {
            await supabaseAdmin.auth.admin.deleteUser(authUserId)
          }
          return NextResponse.json(
            { error: 'Failed to create player record' },
            { status: 500 }
          )
        }
      } else {
        console.log('✅ New player record created')
      }

      // Generate magic link token and exchange for session
      console.log('🔐 Generating auth token for new user')
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
      })

      if (linkError || !linkData) {
        console.error('Failed to generate auth link:', linkError)
        // Clean up auth user if link generation fails
        if (!isRecoveredUser) {
          await supabaseAdmin.auth.admin.deleteUser(authUserId)
        }
        return NextResponse.json(
          { error: 'Failed to create session' },
          { status: 500 }
        )
      }

      // Extract token from the action link
      const url = new URL(linkData.properties.action_link)
      const token = url.searchParams.get('token')
      const type = url.searchParams.get('type')

      if (!token || type !== 'magiclink') {
        console.error('Invalid magic link format')
        if (!isRecoveredUser) {
          await supabaseAdmin.auth.admin.deleteUser(authUserId)
        }
        return NextResponse.json(
          { error: 'Authentication failed' },
          { status: 500 }
        )
      }

      // Exchange token for session
      const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.verifyOtp({
        token_hash: token,
        type: 'magiclink'
      })

      if (sessionError || !sessionData.session) {
        console.error('Failed to verify token:', sessionError)
        // Clean up auth user if session creation fails
        if (!isRecoveredUser) {
          await supabaseAdmin.auth.admin.deleteUser(authUserId)
        }
        return NextResponse.json(
          { error: 'Failed to create session' },
          { status: 500 }
        )
      }

      console.log('✅ Session created successfully')

      const response = NextResponse.json({
        success: true,
        isNewUser: !isRecoveredUser,
        session: sessionData.session,
        user: sessionData.user,
        address: address.toLowerCase()
      })
      
      // Set session cookies
      response.cookies.set('sb-access-token', sessionData.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: sessionData.session.expires_in
      })
      response.cookies.set('sb-refresh-token', sessionData.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })
      
      return response
    }
  } catch (error) {
    console.error('SIWE authentication error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
