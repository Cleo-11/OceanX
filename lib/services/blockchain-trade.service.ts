/**
 * Blockchain Trade Service
 * 
 * Handles the complete marketplace claim flow:
 * 1. Request signature from backend
 * 2. Submit claim transaction on-chain (user pays gas)
 * 3. Confirm trade with backend
 */

import { ethers } from 'ethers';
import { getOCXTokenContractWithSigner } from '@/lib/contracts/ocx-token';

// Backend API URL
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// Debug: Log the backend URL being used (remove after debugging)
if (typeof window !== 'undefined') {
  console.log('[BlockchainTradeService] BACKEND_URL:', BACKEND_URL);
  console.log('[BlockchainTradeService] ENV value:', process.env.NEXT_PUBLIC_BACKEND_URL);
}

export interface ClaimSignatureResponse {
  success: boolean;
  tradeId: string | null;
  wallet: string;
  ocxAmount: number;
  amountWei: string;
  nonce: string;
  deadline: number;
  signature: string;
  v: number;
  r: string;
  s: string;
  message: string;
}

export interface TradeConfirmResponse {
  success: boolean;
  trade?: {
    id: string;
    status: string;
    ocx_amount: string;
  };
  player?: {
    total_ocx_earned: number;
  };
}

export interface TradeParams {
  walletAddress: string;
  ocxAmount: number;
  resourceType: string;
  resourceAmount: number;
}

export interface TradeResult {
  success: boolean;
  txHash: string;
  ocxReceived: number;
  tradeId?: string | null;
  error?: string;
}

/**
 * Generate authentication signature for backend requests
 */
async function generateAuthSignature(wallet: ethers.Signer): Promise<{ message: string; signature: string }> {
  const address = await wallet.getAddress();
  const message = `AbyssX claim
Wallet: ${address}
Timestamp: ${Date.now()}
Network: sepolia`;
  
  const signature = await wallet.signMessage(message);
  return { message, signature };
}

/**
 * Step 1: Request claim signature from backend
 */
export async function requestClaimSignature(
  params: TradeParams,
  wallet: ethers.Signer
): Promise<ClaimSignatureResponse> {
  try {
    // Generate auth signature
    const auth = await generateAuthSignature(wallet);
    const address = await wallet.getAddress();

    // Request signature from backend
    const response = await fetch(`${BACKEND_URL}/marketplace/sign-claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress: address,
        address: address,
        authMessage: auth.message,
        authSignature: auth.signature,
        ocxAmount: params.ocxAmount,
        resourceType: params.resourceType,
        resourceAmount: params.resourceAmount,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error requesting claim signature:', error);
    throw error;
  }
}

/**
 * Step 2: Submit claim transaction on-chain
 */
export async function submitClaimTransaction(
  signatureData: ClaimSignatureResponse,
  wallet: ethers.Signer
): Promise<{ txHash: string; receipt: ethers.TransactionReceipt }> {
  try {
    // Get contract instance with signer
    const contract = getOCXTokenContractWithSigner(wallet);

    // Verify nonce matches on-chain
    const address = await wallet.getAddress();
    const onChainNonce = await contract.nonces(address);
    
    if (onChainNonce.toString() !== signatureData.nonce) {
      throw new Error(`Nonce mismatch! Expected ${signatureData.nonce}, got ${onChainNonce}`);
    }

    console.log('Submitting claim transaction...', {
      amount: signatureData.amountWei,
      nonce: signatureData.nonce,
      deadline: signatureData.deadline,
      v: signatureData.v,
      r: signatureData.r,
      s: signatureData.s,
    });

    // Submit claim transaction
    const tx = await contract.claim(
      signatureData.amountWei,
      signatureData.nonce,
      signatureData.deadline,
      signatureData.v,
      signatureData.r,
      signatureData.s
    );

    console.log('Transaction submitted:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();
    
    if (!receipt) {
      throw new Error('Transaction receipt is null');
    }

    console.log('Transaction confirmed in block:', receipt.blockNumber);

    return { txHash: tx.hash, receipt };
  } catch (error: any) {
    console.error('Error submitting claim transaction:', error);
    
    // Parse common errors
    if (error.code === 'ACTION_REJECTED') {
      throw new Error('Transaction rejected by user');
    } else if (error.message?.includes('insufficient funds')) {
      throw new Error('Insufficient ETH for gas fees');
    } else if (error.message?.includes('Invalid signature')) {
      throw new Error('Invalid signature - please try again');
    } else if (error.message?.includes('Nonce mismatch')) {
      throw new Error('Nonce mismatch - please refresh and try again');
    }
    
    throw error;
  }
}

/**
 * Step 3: Confirm trade with backend
 */
export async function confirmTrade(
  txHash: string,
  tradeId: string | null,
  wallet: ethers.Signer
): Promise<TradeConfirmResponse> {
  try {
    // Generate auth signature
    const auth = await generateAuthSignature(wallet);
    const address = await wallet.getAddress();

    // Confirm trade with backend
    const response = await fetch(`${BACKEND_URL}/marketplace/trade/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress: address,
        address: address,
        authMessage: auth.message,
        authSignature: auth.signature,
        txHash: txHash,
        tradeId: tradeId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('Backend confirmation failed:', errorText);
      // Don't throw - transaction already succeeded on-chain
      return { success: false };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error confirming trade:', error);
    // Don't throw - transaction already succeeded on-chain
    return { success: false };
  }
}

/**
 * Complete marketplace trade flow (all 3 steps)
 */
export async function executeMarketplaceTrade(
  params: TradeParams,
  wallet: ethers.Signer,
  onProgress?: (step: number, message: string) => void
): Promise<TradeResult> {
  try {
    // Step 1: Request signature
    onProgress?.(1, 'Requesting signature from server...');
    const signatureData = await requestClaimSignature(params, wallet);

    // Step 2: Submit transaction
    onProgress?.(2, 'Please confirm the transaction in your wallet...');
    const { txHash } = await submitClaimTransaction(signatureData, wallet);

    // Step 3: Confirm with backend
    onProgress?.(3, 'Confirming trade with server...');
    await confirmTrade(txHash, signatureData.tradeId, wallet);

    onProgress?.(4, 'Trade completed successfully!');

    return {
      success: true,
      txHash,
      ocxReceived: signatureData.ocxAmount,
      tradeId: signatureData.tradeId || null,
    };
  } catch (error: any) {
    console.error('Trade execution failed:', error);
    return {
      success: false,
      txHash: '',
      ocxReceived: 0,
      error: error.message || 'Unknown error occurred',
    };
  }
}
