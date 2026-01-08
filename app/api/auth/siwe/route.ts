/**
 * Sign-In with Ethereum (SIWE) API Route
 * Implements EIP-4361 standard for Web3 wallet authentication
 * 
 * Flow:
 * 1. Verify signature is valid
 * 2. Check/create player record in database
 * 3. Generate custom JWT tokens for session
 * 
 * 🔐 Uses custom JWT generation for wallet-only authentication
 * ✅ NO Supabase Auth required - just database for player records
 * ✅ Wallet address is the primary user identifier
 */

import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { createClient } from '@supabase/supabase-js'
import { generateTokens, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/jwt-auth'
import type { Database } from '@/lib/types'

// Initialize Supabase admin client (for database operations only)
function getSupabaseAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
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
    const domain = lines[0]
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
      console.error('Missing required fields')
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

    const walletAddress = address.toLowerCase()
    const supabase = getSupabaseAdmin()

    // Check if player already exists
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id, user_id, wallet_address, username')
      .eq('wallet_address', walletAddress)
      .single()

    let isNewUser = false

    if (!existingPlayer) {
      // Create new player record
      console.log('🆕 Creating new player for:', walletAddress)
      isNewUser = true

      const { error: createError } = await supabase
        .from('players')
        .insert({
          user_id: walletAddress, // Use wallet as user_id for simplicity
          wallet_address: walletAddress,
          username: `Captain-${address.slice(2, 8)}`,
          submarine_tier: 1,
          coins: 0,
          total_resources_mined: 0,
          total_ocx_earned: 0,
          nickel: 0,
          cobalt: 0,
          copper: 0,
          manganese: 0,
          is_active: true,
          last_login: new Date().toISOString(),
        })

      if (createError) {
        console.error('Failed to create player:', createError)
        return NextResponse.json(
          { error: 'Failed to create player record' },
          { status: 500 }
        )
      }
      console.log('✅ Player created successfully')
    } else {
      console.log('✅ Returning user:', walletAddress)
      // Update last login
      await supabase
        .from('players')
        .update({ last_login: new Date().toISOString(), is_active: true })
        .eq('wallet_address', walletAddress)
    }

    // Generate JWT tokens
    console.log('🔐 Generating JWT tokens...')
    const tokens = generateTokens(walletAddress)

    console.log('✅ Authentication successful')

    const response = NextResponse.json({
      success: true,
      isNewUser,
      address: walletAddress,
      user: {
        id: walletAddress,
        wallet_address: walletAddress,
      }
    })

    // Set session cookies
    response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: tokens.expiresIn,
    })
    response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch (error) {
    console.error('SIWE authentication error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
