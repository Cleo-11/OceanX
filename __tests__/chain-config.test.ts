import { describe, it, expect, afterEach } from '@jest/globals'
import { getPrimaryChain, CHAINS } from '../lib/chain-config'

const original = { ...process.env }
afterEach(() => {
  process.env = { ...original }
})

describe('getPrimaryChain', () => {
  it('defaults to Ethereum Sepolia, where the contracts are deployed', () => {
    delete process.env.NEXT_PUBLIC_CHAIN_ID
    delete process.env.NEXT_PUBLIC_USE_BASE_MAINNET
    expect(getPrimaryChain().chainId).toBe(11155111)
  })

  it('honours NEXT_PUBLIC_CHAIN_ID', () => {
    process.env.NEXT_PUBLIC_CHAIN_ID = String(CHAINS.BASE_SEPOLIA.chainId)
    expect(getPrimaryChain().chainId).toBe(84532)
  })

  it('falls back to Sepolia for an unknown NEXT_PUBLIC_CHAIN_ID', () => {
    process.env.NEXT_PUBLIC_CHAIN_ID = '999999'
    const warn = jestSpyWarn()
    expect(getPrimaryChain().chainId).toBe(11155111)
    warn.restore()
  })

  it('keeps the legacy BASE mainnet switch when no chain id is set', () => {
    delete process.env.NEXT_PUBLIC_CHAIN_ID
    process.env.NEXT_PUBLIC_USE_BASE_MAINNET = 'true'
    expect(getPrimaryChain().chainId).toBe(8453)
  })

  it('has a usable default Sepolia RPC (no bare Infura URL without a key)', () => {
    expect(CHAINS.SEPOLIA.rpcUrl).not.toMatch(/infura\.io\/v3\/$/)
  })
})

function jestSpyWarn() {
  const orig = console.warn
  console.warn = () => {}
  return { restore: () => { console.warn = orig } }
}
