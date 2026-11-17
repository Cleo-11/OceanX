/**
 * Nonce Manager - Signature Replay Prevention
 * 
 * This module prevents signature replay attacks by tracking which nonces
 * have been used to generate claim signatures. It ensures that:
 * 
 * 1. Each nonce can only be used once to generate a signature
 * 2. Concurrent requests for the same nonce are prevented
 * 3. Expired signatures are cleaned up automatically
 * 4. Blockchain claim confirmations are tracked
 * 
 * Adapted to work with existing claim_signatures table schema:
 * - wallet (TEXT) instead of wallet_address
 * - used (BOOLEAN) instead of status
 * - expires_at (BIGINT, Unix timestamp seconds)
 * - claim_id (UUID) as primary key
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

class NonceManager {
  constructor(supabase, contract) {
    this.supabase = supabase;
    this.contract = contract;
  }

  /**
   * Get current nonce from smart contract
   * @param {string} walletAddress - Ethereum wallet address
   * @returns {Promise<string>} Current nonce as string
   */
  async getCurrentNonce(walletAddress) {
    try {
      const nonce = await this.contract.nonces(walletAddress);
      return nonce.toString();
    } catch (error) {
      console.error('❌ Failed to get nonce from contract:', error);
      throw new Error('Failed to fetch nonce from blockchain');
    }
  }

  /**
   * Check if a nonce has already been used for signing
   * Returns existing signature if found, preventing duplicate generation
   * 
   * @param {string} walletAddress - Ethereum wallet address
   * @param {string|number} nonce - Nonce to check
   * @returns {Promise<Object|null>} Existing claim or null
   */
  async checkNonceUsage(walletAddress, nonce) {
    // Query ALL records for this wallet+nonce (including used=true)
    // The UNIQUE constraint is on (wallet, nonce) regardless of 'used' status
    const { data, error } = await this.supabase
      .from('claim_signatures')
      .select('*')
      .eq('wallet', walletAddress.toLowerCase())
      .eq('nonce', parseInt(nonce))
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error checking nonce usage:', error);
      throw error;
    }

    return data;
  }

  /**
   * Reserve a nonce for signing (prevents concurrent use)
   * Uses UNIQUE constraint on (wallet, nonce) to prevent race conditions
   * On conflict, waits and returns existing signature if available
   * 
   * @param {string} walletAddress - Ethereum wallet address
   * @param {string|number} nonce - Nonce to reserve
   * @param {string|number} amount - Claim amount
   * @returns {Promise<Object>} Reserved claim record
   */
  async reserveNonce(walletAddress, nonce, amount) {
    const expiresAtSeconds = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now (Unix timestamp)
    const claimId = randomUUID();
    const normalizedWallet = walletAddress.toLowerCase();
    const parsedNonce = parseInt(nonce);

    // Validate nonce
    if (isNaN(parsedNonce) || parsedNonce === null || parsedNonce === undefined) {
      console.error(`❌ Invalid nonce value: '${nonce}' (type: ${typeof nonce}) -> parsed as ${parsedNonce}`);
      throw new Error(`Invalid nonce value: ${nonce}`);
    }

    // Log details for debugging
    console.log(`🔒 Reserving nonce for ${normalizedWallet}: nonce=${parsedNonce} (parsed from '${nonce}', type: ${typeof nonce})`);

    // Double-check for existing reservation before insert
    const { data: existing } = await this.supabase
      .from('claim_signatures')
      .select('claim_id, created_at, used, signature')
      .eq('wallet', normalizedWallet)
      .eq('nonce', parsedNonce)
      .maybeSingle();

    if (existing) {
      if (existing.used) {
        // Stale used=true record blocking new reservation — delete it
        console.warn(`⚠️ [DB Check] Stale used=true record for nonce ${parsedNonce}, deleting...`);
        await this.supabase
          .from('claim_signatures')
          .delete()
          .eq('wallet', normalizedWallet)
          .eq('nonce', parsedNonce)
          .eq('used', true);
      } else {
        console.warn(`⚠️ [DB Check] Nonce ${parsedNonce} already exists for ${normalizedWallet} (created: ${existing.created_at}, used: ${existing.used}, hasSig: ${!!existing.signature})`);
        throw new Error('Nonce already in use. Please try again.');
      }
    }

    const { data, error } = await this.supabase
      .from('claim_signatures')
      .insert({
        claim_id: claimId,
        wallet: normalizedWallet,
        nonce: parsedNonce,
        amount: amount.toString(),
        expires_at: expiresAtSeconds,
        used: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // Unique constraint violation = nonce already reserved by concurrent request
      if (error.code === '23505') {
        console.error(`❌ [CONSTRAINT VIOLATION] Nonce ${parsedNonce} already reserved for ${normalizedWallet}`);
        
        // Check if the concurrent request already completed and has a signature
        // Wait briefly to allow concurrent request to finish
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const { data: concurrentClaim } = await this.supabase
          .from('claim_signatures')
          .select('*')
          .eq('wallet', normalizedWallet)
          .eq('nonce', parsedNonce)
          .maybeSingle();
        
        if (concurrentClaim && concurrentClaim.signature) {
          console.log(`ℹ️ Concurrent request completed, returning existing signature`);
          // Return the signature that was generated by the concurrent request
          return concurrentClaim;
        }
        
        throw new Error('Nonce already in use. Please try again.');
      }
      console.error(`❌ Error reserving nonce ${parsedNonce}:`, error);
      throw error;
    }

    console.log(`✅ Reserved nonce ${parsedNonce} for ${normalizedWallet} (claim_id: ${claimId})`);
    return data;
  }

  /**
   * Store signature after successful signing
   * Updates the claim record with the generated signature
   * 
   * @param {string} walletAddress - Ethereum wallet address
   * @param {string|number} nonce - Nonce used
   * @param {string} signature - EIP-712 signature
   * @param {number|string} [deadline] - Deadline (unix seconds) that was signed.
   *   When given it replaces the provisional 1-hour reservation expiry, so
   *   `expires_at` is exactly the moment the signature stops working on-chain.
   *   Callers return `expires_at` to clients as the claim `deadline`; with the
   *   reservation value the contract rejected every re-issued signature
   *   ("Invalid signature"), and a dead signature blocked new claims for an hour.
   */
  async storeSignature(walletAddress, nonce, signature, deadline) {
    const update = { signature: signature };
    const signedDeadline = Number(deadline);
    if (deadline !== undefined && deadline !== null && Number.isFinite(signedDeadline) && signedDeadline > 0) {
      update.expires_at = Math.floor(signedDeadline);
    }

    const { error } = await this.supabase
      .from('claim_signatures')
      .update(update)
      .eq('wallet', walletAddress.toLowerCase())
      .eq('nonce', parseInt(nonce));

    if (error) {
      console.error('❌ Error storing signature:', error);
      throw error;
    }

    console.log(`✅ Stored signature for ${walletAddress}, nonce ${nonce}`);
  }

  /**
   * Mark nonce as claimed (called after blockchain confirmation)
   * This is typically called via webhook or event listener
   * 
   * @param {string} walletAddress - Ethereum wallet address
   * @param {string|number} nonce - Nonce that was claimed
   */
  async markAsClaimed(walletAddress, nonce) {
    const { error } = await this.supabase
      .from('claim_signatures')
      .update({
        used: true,
        used_at: new Date().toISOString(),
      })
      .eq('wallet', walletAddress.toLowerCase())
      .eq('nonce', parseInt(nonce));

    if (error) {
      console.error('❌ Error marking as claimed:', error);
    } else {
      console.log(`✅ Marked nonce ${nonce} as claimed for ${walletAddress}`);
    }
  }

  /**
   * Cleanup expired signatures
   * Run this periodically (e.g., every 5 minutes)
   * 
   * @returns {Promise<number>} Number of expired signatures
   */
  async cleanupExpired() {
    try {
      const { data, error } = await this.supabase.rpc('expire_old_claim_signatures');

      if (error) {
        console.error('❌ Error cleaning up expired signatures:', error);
        return 0;
      }

      if (data > 0) {
        console.log(`🧹 Cleaned up ${data} expired signatures`);
      }

      return data || 0;
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Get pending claims for a wallet
   * Useful for debugging and user support
   * 
   * @param {string} walletAddress - Ethereum wallet address
   * @returns {Promise<Array>} Pending claim records
   */
  async getPendingClaims(walletAddress) {
    const { data, error } = await this.supabase
      .from('claim_signatures')
      .select('*')
      .eq('wallet', walletAddress.toLowerCase())
      .eq('used', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching pending claims:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Cleanup expired signatures for a specific wallet
   * Called before checking nonce usage to ensure stale reservations are cleared
   * 
   * @param {string} walletAddress - Ethereum wallet address
   * @returns {Promise<number>} Number of expired signatures removed
   */
  async cleanupExpiredForWallet(walletAddress) {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    // Delete ALL expired records (both used=true and used=false)
    // This is critical: expired used=true records block new reservations
    // due to the UNIQUE constraint on (wallet, nonce)
    const { data, error } = await this.supabase
      .from('claim_signatures')
      .delete()
      .eq('wallet', walletAddress.toLowerCase())
      .lt('expires_at', currentTimestamp)
      .select();

    if (error) {
      console.error('❌ Error cleaning up expired signatures for wallet:', error);
      return 0;
    }

    if (data && data.length > 0) {
      console.log(`🧹 Cleaned up ${data.length} expired signatures for ${walletAddress}`);
    }

    return data ? data.length : 0;
  }

  /**
   * Delete a stale record for a given wallet+nonce regardless of used status.
   * Use when: on-chain nonce hasn't moved but DB record blocks new reservation
   * (expired signature, wrong signer key, failed tx, etc.)
   * 
   * @param {string} walletAddress - Ethereum wallet address
   * @param {string|number} nonce - Nonce to delete
   * @returns {Promise<boolean>} Whether deletion was successful
   */
  async deleteStaleRecord(walletAddress, nonce) {
    const { data, error } = await this.supabase
      .from('claim_signatures')
      .delete()
      .eq('wallet', walletAddress.toLowerCase())
      .eq('nonce', parseInt(nonce))
      .select();

    if (error) {
      console.error('❌ Error deleting stale record:', error);
      return false;
    }

    if (data && data.length > 0) {
      console.log(`🧹 Deleted stale used=true record for ${walletAddress}, nonce ${nonce}`);
      return true;
    }

    return false;
  }

  /**
   * Delete an incomplete reservation (no signature generated)
   * Called when a previous attempt reserved a nonce but failed to complete
   * 
   * @param {string} walletAddress - Ethereum wallet address
   * @param {string|number} nonce - Nonce to delete
   * @returns {Promise<boolean>} Whether deletion was successful
   */
  async deleteIncompleteReservation(walletAddress, nonce) {
    const { data, error } = await this.supabase
      .from('claim_signatures')
      .delete()
      .eq('wallet', walletAddress.toLowerCase())
      .eq('nonce', parseInt(nonce))
      .eq('used', false)
      .is('signature', null)
      .select();

    if (error) {
      console.error('❌ Error deleting incomplete reservation:', error);
      return false;
    }

    if (data && data.length > 0) {
      console.log(`🧹 Deleted incomplete reservation for ${walletAddress}, nonce ${nonce}`);
      return true;
    }

    return false;
  }

  /**
   * Get claim statistics for monitoring
   * 
   * @returns {Promise<Object>} Statistics about claim signatures
   */
  async getStats() {
    try {
      const { data, error } = await this.supabase
        .from('claim_signatures')
        .select('used, nonce, expires_at');

      if (error) throw error;

      const currentTimestamp = Math.floor(Date.now() / 1000);

      const stats = {
        totalSignatures: data.length,
        pendingSignatures: data.filter(c => !c.used && c.expires_at > currentTimestamp).length,
        claimedSignatures: data.filter(c => c.used).length,
        expiredSignatures: data.filter(c => !c.used && c.expires_at <= currentTimestamp).length,
        uniqueNonces: new Set(data.map(c => c.nonce)).size,
      };

      return stats;
    } catch (error) {
      console.error('❌ Error fetching stats:', error);
      return null;
    }
  }
}

export default NonceManager;
