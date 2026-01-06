/**
 * Sign-In with Ethereum (SIWE) API Route
 * Implements EIP-4361 standard for Web3 wallet authentication
 * 
 * Flow:
 * 1. Verify signature is valid
 * 2. Check if wallet already has an account
 * 3. Create user if needed, then generate session via admin API
 * 
 * 🔒 SECURITY FIX: Uses stable password derived from wallet address instead of
 * changing signatures. This prevents race conditions in parallel logins.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import crypto from 'crypto'

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

// Initialize Supabase client with cookies (for session management)
function getSupabaseWithCookies(request: NextRequest) {
  const cookieStore: { [key: string]: string } = {}
  
  return {
    client: createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value || cookieStore[name]
          },
          set(name: string, value: string) {
            cookieStore[name] = value
          },
          remove(name: string) {
            delete cookieStore[name]
          },
        },
      }
    ),
    getCookies: () => cookieStore
  }
}

interface SIWERequest {
  message: string
  signature: string
  address: string
}

/**
 * Generate a stable password from wallet address
 * This ensures the password never changes, preventing race conditions
 * 🔒 Uses HMAC with server secret so it can't be guessed
 */
function generateStablePassword(walletAddress: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret'
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(`siwe-auth:${walletAddress.toLowerCase()}`)
  return hmac.digest('hex')
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

    // 🔒 SECURITY FIX: Use stable password derived from wallet address
    // This prevents race conditions when user logs in from multiple tabs
    const stablePassword = generateStablePassword(address)
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
          password: stablePassword,
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

        // Sign in with the new auth user using cookie-enabled client
        const { client: supabaseRecreate, getCookies: getRecreatedCookies } = getSupabaseWithCookies(request)
        const { data: signInData, error: signInError } = await supabaseRecreate.auth.signInWithPassword({
          email,
          password: stablePassword,
        })

        if (signInError || !signInData.session) {
          console.error('Sign in after recreation failed:', signInError)
          return NextResponse.json(
            { error: 'Authentication failed' },
            { status: 401 }
          )
        }

        const response = NextResponse.json({
          success: true,
          isNewUser: false,
          session: signInData.session,
          user: signInData.user,
          address: address.toLowerCase()
        })
        
        // Apply cookies from Supabase auth
        const cookies = getRecreatedCookies()
        Object.entries(cookies).forEach(([name, value]) => {
          response.cookies.set(name, value, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' })
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
      
      // Try to sign in with stable password using cookie-enabled client
      const { client: supabaseWithCookies, getCookies } = getSupabaseWithCookies(request)
      const { data: signInData, error: signInError } = await supabaseWithCookies.auth.signInWithPassword({
        email,
        password: stablePassword,
      })

      if (signInError) {
        // Password might be old signature-based password, update it
        console.log('🔄 Migrating user to stable password auth:', address)
        
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          existingPlayer.user_id,
          { password: stablePassword }
        )

        if (updateError) {
          console.error('Failed to update password:', updateError)
          return NextResponse.json(
            { error: 'Authentication failed - password migration error' },
            { status: 401 }
          )
        }

        // Retry sign in with stable password using cookie-enabled client
        const { data: retryData, error: retryError } = await supabaseWithCookies.auth.signInWithPassword({
          email,
          password: stablePassword,
        })

        if (retryError || !retryData.session) {
          console.error('Sign in retry failed:', retryError)
          return NextResponse.json(
            { error: 'Authentication failed' },
            { status: 401 }
          )
        }

        const response = NextResponse.json({
          success: true,
          isNewUser: false,
          session: retryData.session,
          user: retryData.user,
          address: address.toLowerCase()
        })
        
        // Apply cookies from Supabase auth
        const cookies = getCookies()
        Object.entries(cookies).forEach(([name, value]) => {
          response.cookies.set(name, value, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' })
        })
        return response
      }

      const response = NextResponse.json({
        success: true,
        isNewUser: false,
        session: signInData.session,
        user: signInData.user,
        address: address.toLowerCase()
      })
      
      // Apply cookies from Supabase auth
      const cookies = getCookies()
      Object.entries(cookies).forEach(([name, value]) => {
        response.cookies.set(name, value, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' })
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
          
          // Update password to stable password (in case it was different before)
          console.log('🔄 Updating password to stable password...')
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
            password: stablePassword
          })
          if (updateError) {
            console.error('⚠️ Password update failed:', updateError.message)
          } else {
            console.log('✅ Password updated successfully')
          }
        }
      }

      // If no existing user found, create new auth user
      if (!authUserId) {
        console.log('🆕 Creating new auth user...')
        const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: stablePassword,
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
        resources: 0,
        max_storage: 100,
        energy: 100,
        max_energy: 100,
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

      // Sign in to create session
      console.log('🔐 Creating session via sign-in...')
      const { client: supabaseNewUser, getCookies: getNewUserCookies } = getSupabaseWithCookies(request)
      const { data: signInData, error: signInError } = await supabaseNewUser.auth.signInWithPassword({
        email,
        password: stablePassword,
      })

      if (signInError || !signInData.session) {
        console.error('Sign in error after creation:', signInError)
        return NextResponse.json(
          { error: 'Failed to create session' },
          { status: 500 }
        )
      }

      console.log('✅ Session created successfully')

      const response = NextResponse.json({
        success: true,
        isNewUser: !isRecoveredUser,
        session: signInData.session,
        user: signInData.user,
        address: address.toLowerCase()
      })
      
      // Apply cookies from Supabase auth
      const cookies = getNewUserCookies()
      Object.entries(cookies).forEach(([name, value]) => {
        response.cookies.set(name, value, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' })
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
