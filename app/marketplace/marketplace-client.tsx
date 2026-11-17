"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { ethers } from "ethers"
import { StyleWrapper } from "@/components/style-wrapper"
import { supabase } from "@/lib/supabase"
import { WalletManager } from "@/lib/wallet"
import { executeMarketplaceTrade } from "@/lib/services/blockchain-trade.service"
import { getPrimaryChain } from "@/lib/chain-config"
import { HOLD_COLORS } from "@/components/player-hud"
import type { ResourceType } from "@/lib/types"

interface PlayerData {
  id: string
  user_id: string
  wallet_address: string
  username: string
  submarine_tier: number
  total_resources_mined: number
  total_ocx_earned: number
  last_login: string
}

interface MarketplaceClientProps {
  playerData: PlayerData
}

interface Resource {
  id: string
  name: string
  icon: string
  // ocxRate optional: live market will provide values; placeholder displayed otherwise
  ocxRate?: number
  amount: number
  description: string
}

// Note: Rarity/colors removed — market determines value/rank dynamically

export default function MarketplaceClient({ playerData }: MarketplaceClientProps) {
  const router = useRouter()
  const [resources, setResources] = useState<Resource[]>([])
  const [ocxBalance, setOcxBalance] = useState<string>("0")
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null)
  const [tradeAmount, setTradeAmount] = useState(1)
  const [isTrading, setIsTrading] = useState(false)
  const [recentTrades, setRecentTrades] = useState<any[]>([])
  const [balanceLoading, setBalanceLoading] = useState(false)

  // Transaction state
  const [tradeStep, setTradeStep] = useState(0)
  const [tradeStatus, setTradeStatus] = useState<string>("")
  const [txHash, setTxHash] = useState<string>("")
  const [tradeError, setTradeError] = useState<string>("")
  // Trade dialog lifecycle helpers. `isTrading` is React state and is stale
  // inside a handler that fires twice in one tick, so the double-submit guard
  // is a ref; the auto-close timer is tracked so it cannot close a dialog the
  // player has since reopened for a different resource.
  const tradeInFlightRef = useRef(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const resetTradeStatus = useCallback(() => {
    setTradeStep(0)
    setTradeStatus("")
    setTxHash("")
    setTradeError("")
  }, [])

  /** Open the trade dialog for a resource with a clean status panel. */
  const openTradeDialog = useCallback((resource: Resource) => {
    if (tradeInFlightRef.current) return
    clearCloseTimer()
    resetTradeStatus()
    setIsTrading(false)
    setTradeAmount(1)
    setSelectedResource(resource)
  }, [clearCloseTimer, resetTradeStatus])

  /** Close the dialog. An in-flight trade keeps running; its result is not lost. */
  const closeTradeDialog = useCallback(() => {
    clearCloseTimer()
    setSelectedResource(null)
    if (!tradeInFlightRef.current) {
      resetTradeStatus()
      setIsTrading(false)
      setTradeAmount(1)
    }
  }, [clearCloseTimer, resetTradeStatus])

  useEffect(() => clearCloseTimer, [clearCloseTimer])

  // Fetch OCX balance - prioritizes on-chain wallet balance
  const fetchOCXBalance = useCallback(async () => {
    if (!playerData.wallet_address) return

    setBalanceLoading(true)
    try {
      const walletManager = WalletManager.getInstance()
      
      // Try to get on-chain balance from connected wallet (source of truth)
      const connection = walletManager.getConnection()
      if (connection && connection.address.toLowerCase() === playerData.wallet_address.toLowerCase()) {
        // Fetch actual wallet balance (reflects purchases/spends)
        const walletBalance = await walletManager.getBalance()
        const walletBalanceNum = parseFloat(walletBalance)
        
        console.log(`✅ Using wallet balance: ${walletBalanceNum} OCX`)
        setOcxBalance(walletBalance)
        // NOTE: Do NOT write wallet balance back to total_ocx_earned.
        // total_ocx_earned tracks *unclaimed* off-chain OCX (pending claim).
        // Overwriting it with the on-chain balance would undo the deduction
        // performed by /marketplace/claim-ocx and cause double-claiming.
      } else {
        // If wallet not connected or different address, show database value as fallback
        console.log("⚠️ Wallet not connected, using DB balance as fallback")
        setOcxBalance(playerData.total_ocx_earned.toString())
      }
    } catch (error) {
      console.error("Error fetching OCX balance:", error)
      // Fallback to database value on error
      setOcxBalance(playerData.total_ocx_earned.toString())
    } finally {
      setBalanceLoading(false)
    }
  }, [playerData.wallet_address, playerData.total_ocx_earned])

  // Fetch player's actual resources from database with OCX rates matching backend
  const fetchPlayerResources = useCallback(async () => {
      try {
        const { data, error } = await supabase
          .from("players")
          .select("nickel, cobalt, copper, manganese")
          .eq("id", playerData.id)
          .single()

        if (error) {
          console.error("Error fetching player resources:", error)
          return
        }

        // OCX rates must match backend rates in server/index.js computeMaxClaimableAmount
        const playerResources: Resource[] = [
          {
            id: "nickel",
            name: "Nickel",
            icon: "⚪",
            ocxRate: 0.1, // Backend: nickel = 0.1 OCX
            amount: data?.nickel || 0,
            description: "Common nickel deposits found on the ocean floor",
          },
          {
            id: "cobalt",
            name: "Cobalt",
            icon: "🔵",
            ocxRate: 0.5, // Backend: cobalt = 0.5 OCX
            amount: data?.cobalt || 0,
            description: "Valuable cobalt-rich mineral nodules from deep waters",
          },
          {
            id: "copper",
            name: "Copper",
            icon: "🟠",
            ocxRate: 1.0, // Backend: copper = 1.0 OCX
            amount: data?.copper || 0,
            description: "Rare copper ore deposits from volcanic vents",
          },
          {
            id: "manganese",
            name: "Manganese",
            icon: "⚫",
            ocxRate: 2.0, // Backend: manganese = 2.0 OCX
            amount: data?.manganese || 0,
            description: "Premium manganese nodules from the abyssal plains",
          },
        ]

        setResources(playerResources)
      } catch (error) {
        console.error("Error loading resources:", error)
      }
  }, [playerData.id])

  useEffect(() => {
    fetchPlayerResources()
  }, [fetchPlayerResources])

  useEffect(() => {
    fetchOCXBalance()
  }, [fetchOCXBalance])


  const handleTrade = async () => {
    if (!selectedResource || tradeAmount <= 0 || tradeAmount > selectedResource.amount) return

    // Prevent duplicate calls (double-click protection). Checked on a ref so
    // two clicks in the same tick cannot both pass.
    if (tradeInFlightRef.current || isTrading) {
      console.warn('⚠️ Trade already in progress, ignoring duplicate request');
      return;
    }
    tradeInFlightRef.current = true
    clearCloseTimer()

    // Reset state
    setIsTrading(true)
    resetTradeStatus()

    try {
      // Check wallet connection. ensureConnected() reuses the live connection,
      // or silently restores it after a reload / account switch.
      const walletManager = WalletManager.getInstance()
      let connection = walletManager.getConnection()
      if (!connection) {
        try {
          connection = await walletManager.ensureConnected()
        } catch (connectErr) {
          console.warn("Wallet connection failed:", connectErr)
        }
      }
      
      if (!connection) {
        setTradeError("Please connect your wallet first")
        setIsTrading(false)
        return
      }

      // Verify wallet matches player address
      if (connection.address.toLowerCase() !== playerData.wallet_address.toLowerCase()) {
        setTradeError("Connected wallet doesn't match your player account")
        setIsTrading(false)
        return
      }

      // Calculate OCX to receive
      const ocxToReceive = selectedResource.ocxRate ? selectedResource.ocxRate * tradeAmount : 0
      
      if (ocxToReceive <= 0) {
        setTradeError("This resource cannot be traded yet (market rate not available)")
        setIsTrading(false)
        return
      }

      // The server reserves exactly these units when it signs, so check them
      // (not the value of all resources combined, which it no longer accepts).
      if (!Number.isInteger(tradeAmount) || tradeAmount <= 0 || tradeAmount > selectedResource.amount) {
        setTradeError(`You have ${selectedResource.amount} ${selectedResource.name}. Choose a whole number up to that.`)
        setIsTrading(false)
        return
      }

      // Signer on the contracts' chain (switches the wallet if needed; works
      // for WalletConnect too, unlike reading window.ethereum directly).
      let signer: ethers.Signer
      try {
        signer = (await walletManager.ensurePrimaryNetwork()).signer
      } catch (networkErr: any) {
        setTradeError(networkErr?.message || "Please switch your wallet to the game's network")
        setIsTrading(false)
        return
      }

      // Execute blockchain trade
      const result = await executeMarketplaceTrade(
        {
          walletAddress: playerData.wallet_address,
          ocxAmount: ocxToReceive,
          resourceType: selectedResource.id,
          resourceAmount: tradeAmount,
        },
        signer,
        (step, message) => {
          setTradeStep(step)
          setTradeStatus(message)
        }
      )

      if (!result.success) {
        // The server may be holding the resources for this trade: show the
        // real balance rather than the pre-trade one.
        if (result.reservationHeld) void fetchPlayerResources()
        setTradeError(result.error || "Trade failed")
        setIsTrading(false)
        return
      }

      // Trade successful!
      setTxHash(result.txHash)
      
      // Update resource amount locally
      const updatedResources = resources.map((r) =>
        r.id === selectedResource.id
          ? { ...r, amount: r.amount - tradeAmount }
          : r
      )
      setResources(updatedResources)

      // Add to recent trades
      const trade = {
        id: Date.now().toString(),
        resourceName: selectedResource.name,
        amount: tradeAmount,
        ocxReceived: result.ocxReceived,
        txHash: result.txHash,
        timestamp: new Date().toISOString(),
      }
      setRecentTrades([trade, ...recentTrades.slice(0, 9)])

      // Refresh balance from wallet (on-chain trade already completed)
      // The wallet balance is now the source of truth
      await fetchOCXBalance()

      // Keep modal open to show success message with tx link
      setTradeStep(5)
      setTradeStatus(`Successfully traded! Received ${result.ocxReceived} OCX`)
      
      // Close modal after 3 seconds (cancelled if the player closes or
      // reopens the dialog first)
      clearCloseTimer()
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null
        setSelectedResource(null)
        setTradeAmount(1)
        setIsTrading(false)
        resetTradeStatus()
      }, 3000)

    } catch (error: any) {
      console.error("Trade error:", error)
      setTradeError(error.message || "Unknown error occurred")
      setIsTrading(false)
    } finally {
      tradeInFlightRef.current = false
    }
  }

  const totalOCXFromTrade = selectedResource && selectedResource.ocxRate ? selectedResource.ocxRate * tradeAmount : 0
  const explorer = getPrimaryChain().blockExplorer
  const fmt = (n: number, digits = 2) => n.toLocaleString("en-US", { maximumFractionDigits: digits })
  const busyLabel =
    tradeStep === 1 ? "Reserving your resources…" : tradeStep === 2 ? "Confirm in your wallet…" : tradeStep === 3 ? "Recording the sale…" : "Working…"

  return (
    <StyleWrapper>
      <main className="dive">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--rule)] px-6 py-4 sm:px-10">
          <div className="flex items-baseline gap-6">
            <button type="button" onClick={() => router.push("/home")} className="text-lg font-semibold tracking-tight">
              AbyssX
            </button>
            <h1 className="text-lg text-[var(--ink-dim)]">Marketplace</h1>
          </div>
          <p className="text-sm">
            <span className="text-[var(--ink-dim)]">In your wallet </span>
            {balanceLoading ? "…" : `${fmt(parseFloat(ocxBalance) || 0)} OCX`}
          </p>
        </header>

        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-10 sm:px-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <section aria-labelledby="sell-title">
            <h2 id="sell-title" className="dive-display text-4xl">
              Sell to the surface
            </h2>
            <p className="mt-3 max-w-[58ch] leading-relaxed text-[var(--ink-dim)]">
              Sell part of your hold and the OCX is minted straight to your wallet. Your wallet pays a small network fee
              in Sepolia ETH. To sell everything at once without a fee, use the menu while diving.
            </p>

            <table className="mt-8 w-full text-left">
              <thead>
                <tr className="text-sm text-[var(--ink-dim)]">
                  <th scope="col" className="pb-2 font-normal">Mineral</th>
                  <th scope="col" className="pb-2 text-right font-normal">In your hold</th>
                  <th scope="col" className="pb-2 text-right font-normal">Price per unit</th>
                  <th scope="col" className="pb-2 text-right font-normal">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => {
                  const active = selectedResource?.id === r.id
                  return (
                    <tr key={r.id} className={`border-t border-[var(--rule)] ${active ? "bg-[rgba(95,227,208,0.05)]" : ""}`}>
                      <th scope="row" className="py-3 font-semibold">
                        <span className="flex items-center gap-2.5">
                          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: HOLD_COLORS[r.id as ResourceType] }} />
                          {r.name}
                        </span>
                      </th>
                      <td className="py-3 text-right">{fmt(r.amount, 0)}</td>
                      <td className="py-3 text-right text-[var(--ink-dim)]">{r.ocxRate ? `${r.ocxRate} OCX` : "Not priced"}</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openTradeDialog(r)}
                          disabled={r.amount === 0 || !r.ocxRate}
                          className="dive-btn dive-btn--quiet py-1.5 text-sm"
                        >
                          {r.amount === 0 ? "None to sell" : active ? "Selected" : "Sell"}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <section aria-labelledby="history-title" className="mt-12">
              <h2 id="history-title" className="text-lg font-semibold">This session&apos;s sales</h2>
              {recentTrades.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--ink-dim)]">Nothing sold yet.</p>
              ) : (
                <ul className="mt-2">
                  {recentTrades.map((trade) => (
                    <li key={trade.id} className="dive-row border-t border-[var(--rule)]">
                      <span>
                        {fmt(trade.amount, 0)} {trade.resourceName}
                        <span className="ml-2 text-xs">{new Date(trade.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                      </span>
                      <span className="text-[var(--ink)]">
                        {fmt(Number(trade.ocxReceived) || 0)} OCX
                        {trade.txHash && (
                          <a href={`${explorer}/tx/${trade.txHash}`} target="_blank" rel="noopener noreferrer" className="dive-link ml-2 text-xs">
                            Transaction
                          </a>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </section>

          <aside aria-label="Sale" className="lg:pt-[4.5rem]">
            {!selectedResource ? (
              <p className="border-l-2 border-[var(--rule)] pl-4 text-sm leading-relaxed text-[var(--ink-dim)]">
                Choose a mineral to sell.
              </p>
            ) : (
              <div className="dive-panel bg-[var(--panel-solid)] p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-xl font-semibold">Sell {selectedResource.name.toLowerCase()}</h2>
                  <button type="button" onClick={closeTradeDialog} disabled={isTrading && tradeStep > 0 && tradeStep < 4} className="text-sm text-[var(--ink-dim)] hover:text-[var(--ink)]">
                    {tradeError || tradeStep === 5 ? "Done" : "Cancel"}
                  </button>
                </div>

                <label htmlFor="sell-amount" className="mt-5 block text-sm text-[var(--ink-dim)]">
                  Units to sell, up to {fmt(selectedResource.amount, 0)}
                </label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    aria-label="One fewer"
                    onClick={() => setTradeAmount(Math.max(1, tradeAmount - 1))}
                    disabled={tradeAmount <= 1 || isTrading}
                    className="dive-btn dive-btn--quiet w-11 px-0"
                  >
                    −
                  </button>
                  <input
                    id="sell-amount"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={selectedResource.amount}
                    value={tradeAmount}
                    disabled={isTrading}
                    onChange={(e) =>
                      setTradeAmount(Math.min(selectedResource.amount, Math.max(1, parseInt(e.target.value) || 1)))
                    }
                    className="dive-input text-center text-base"
                  />
                  <button
                    type="button"
                    aria-label="One more"
                    onClick={() => setTradeAmount(Math.min(selectedResource.amount, tradeAmount + 1))}
                    disabled={tradeAmount >= selectedResource.amount || isTrading}
                    className="dive-btn dive-btn--quiet w-11 px-0"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeAmount(selectedResource.amount)}
                    disabled={isTrading}
                    className="dive-btn dive-btn--quiet"
                  >
                    All
                  </button>
                </div>

                <div className="mt-5 flex items-baseline justify-between border-t border-[var(--rule)] pt-4">
                  <span className="text-sm text-[var(--ink-dim)]">You receive</span>
                  <span className="text-2xl font-semibold">{fmt(totalOCXFromTrade)} OCX</span>
                </div>

                {(isTrading || !!tradeError) && (
                  <div
                    role={tradeError ? "alert" : "status"}
                    aria-live="polite"
                    className={`mt-4 border-l-2 pl-3 text-sm ${tradeError ? "border-[var(--danger)]" : tradeStep === 5 ? "border-[var(--bio)]" : "border-[var(--lamp)]"}`}
                  >
                    <p>{tradeError ? "The sale did not go through." : tradeStatus || busyLabel}</p>
                    {tradeError && <p className="mt-1 text-[var(--ink-dim)]">{tradeError}</p>}
                    {txHash && (
                      <a href={`${explorer}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="dive-link mt-1 inline-block">
                        View transaction
                      </a>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleTrade}
                  disabled={isTrading || tradeAmount <= 0 || tradeAmount > selectedResource.amount}
                  className="dive-btn dive-btn--warm mt-5 w-full py-3 text-base"
                >
                  {isTrading ? busyLabel : `Sell ${fmt(tradeAmount, 0)} for ${fmt(totalOCXFromTrade)} OCX`}
                </button>
              </div>
            )}
          </aside>
        </div>
      </main>
    </StyleWrapper>
  )
}
