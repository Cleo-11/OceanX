import { ethers } from 'ethers'
import { env } from './env'

// TODO: currently using Sepolia via Infura. Replace with BASE RPC URL when ready.
const RPC_URL = env.ETHEREUM_RPC_URL || process.env.ETHEREUM_RPC_URL || ''

if (!RPC_URL) {
  console.warn('[server-provider] ETHEREUM_RPC_URL is not set. On-chain verification will fail until configured.')
}

export function getServerProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(RPC_URL)
}

export async function getTransactionReceipt(txHash: string) {
  const provider = getServerProvider()
  return provider.getTransactionReceipt(txHash)
}
