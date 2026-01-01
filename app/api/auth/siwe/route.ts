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
import crypto from 'crypto'

// Initialize Supabase client lazily to avoid build-time errors
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
    return recoveredAddress.toLowerCase() === address.toLowerCase()
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

    // Validate input
    if (!message || !signature || !address) {
      return NextResponse.json(
        { error: 'Missing required fields: message, signature, address' },
        { status: 400 }
      )
    }

    // Verify signature
    const isValidSignature = verifySignature(message, signature, address)
    if (!isValidSignature) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

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
      // Wallet exists - sign in existing user
      console.log('✅ Returning user:', address)
      
      // Sign in with stable password (never changes)
      const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
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

        // Retry sign in with stable password
        const { data: retryData, error: retryError } = await supabaseAdmin.auth.signInWithPassword({
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

        return NextResponse.json({
          success: true,
          isNewUser: false,
          session: retryData.session,
          user: retryData.user,
          address: address.toLowerCase()
        })
      }

      return NextResponse.json({
        success: true,
        isNewUser: false,
        session: signInData.session,
        user: signInData.user,
        address: address.toLowerCase()
      })
    } else {
      // New wallet - create new account
      console.log('🆕 New user:', address)
      
      // 🔒 Use stable password for new users too
      const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: stablePassword,
        email_confirm: true, // Auto-confirm since wallet signature is proof
        user_metadata: {
          wallet_address: address.toLowerCase(),
          wallet_type: 'ethereum',
          auth_method: 'siwe',
        },
      })

      if (signUpError || !authData.user) {
        console.error('User creation error:', signUpError)
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        )
      }

      // Create player record
      const { error: playerError } = await supabaseAdmin
        .from('players')
        .insert({
          user_id: authData.user.id,
          wallet_address: address.toLowerCase(),
          username: `Captain-${address.slice(2, 8)}`,
          submarine_tier: 1, // Start with tier 1
          resources: 0,
          max_storage: 100,
          energy: 100,
          max_energy: 100,
        })

      if (playerError) {
        console.error('Player creation error:', playerError)
        // Rollback: delete the auth user
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json(
          { error: 'Failed to create player record' },
          { status: 500 }
        )
      }

      // Sign in the newly created user with stable password
      const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
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

      return NextResponse.json({
        success: true,
        isNewUser: true,
        session: signInData.session,
        user: signInData.user,
        address: address.toLowerCase()
      })
    }
  } catch (error) {
    console.error('SIWE authentication error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
