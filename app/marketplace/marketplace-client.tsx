"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ethers } from "ethers"
import {
  ArrowLeft,
  Coins,
  TrendingUp,
  Search,
  Sparkles,
  Package,
  History,
  Wallet,
  ChevronDown,
  Info,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StyleWrapper } from "@/components/style-wrapper"
import { supabase } from "@/lib/supabase"
import { WalletManager } from "@/lib/wallet"
import { executeMarketplaceTrade } from "@/lib/services/blockchain-trade.service"

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
  const [filteredResources, setFilteredResources] = useState<Resource[]>([])
  const [ocxBalance, setOcxBalance] = useState<string>("0")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null)
  const [tradeAmount, setTradeAmount] = useState(1)
  const [isTrading, setIsTrading] = useState(false)
  const [recentTrades, setRecentTrades] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [balanceLoading, setBalanceLoading] = useState(false)

  // Transaction state
  const [tradeStep, setTradeStep] = useState(0)
  const [tradeStatus, setTradeStatus] = useState<string>("")
  const [txHash, setTxHash] = useState<string>("")
  const [tradeError, setTradeError] = useState<string>("")

  // Fetch OCX balance
  const fetchOCXBalance = useCallback(async () => {
    if (!playerData.wallet_address) return

    setBalanceLoading(true)
    try {
      const walletManager = WalletManager.getInstance()
      
      // Try to get balance - if not connected, will show 0
      const connection = walletManager.getConnection()
      if (connection && connection.address.toLowerCase() === playerData.wallet_address.toLowerCase()) {
        const balance = await walletManager.getBalance()
        setOcxBalance(balance)
      } else {
        // If wallet not connected or different address, show player's earned OCX
        setOcxBalance(playerData.total_ocx_earned.toString())
      }
    } catch (error) {
      console.error("Error fetching OCX balance:", error)
      // Fallback to database value
      setOcxBalance(playerData.total_ocx_earned.toString())
    } finally {
      setBalanceLoading(false)
    }
  }, [playerData.wallet_address, playerData.total_ocx_earned])

  // Fetch player's actual resources from database with OCX rates matching backend
  useEffect(() => {
    const fetchPlayerResources = async () => {
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
        setFilteredResources(playerResources)
      } catch (error) {
        console.error("Error loading resources:", error)
      }
    }

    fetchPlayerResources()
  }, [playerData.id])

  useEffect(() => {
    fetchOCXBalance()
  }, [fetchOCXBalance])

  // Apply filters
  useEffect(() => {
    let filtered = resources

    if (searchTerm) {
      filtered = filtered.filter((r) =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply sorting — ocxRate is optional so guard when sorting
    if (filterCategory === "low-to-high") {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a.ocxRate ?? Number.POSITIVE_INFINITY
        const bVal = b.ocxRate ?? Number.POSITIVE_INFINITY
        return aVal - bVal
      })
    } else if (filterCategory === "high-to-low") {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a.ocxRate ?? Number.NEGATIVE_INFINITY
        const bVal = b.ocxRate ?? Number.NEGATIVE_INFINITY
        return bVal - aVal
      })
    } else if (filterCategory === "stock") {
      filtered = [...filtered].sort((a, b) => b.amount - a.amount)
    }

    setFilteredResources(filtered)
  }, [searchTerm, filterCategory, resources])

  const handleTrade = async () => {
    if (!selectedResource || tradeAmount <= 0 || tradeAmount > selectedResource.amount) return

    // Prevent duplicate calls (double-click protection)
    if (isTrading) {
      console.warn('⚠️ Trade already in progress, ignoring duplicate request');
      return;
    }

    // Reset state
    setIsTrading(true)
    setTradeStep(0)
    setTradeStatus("")
    setTxHash("")
    setTradeError("")

    try {
      // Check wallet connection
      const walletManager = WalletManager.getInstance()
      const connection = walletManager.getConnection()
      
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

      // Calculate total max claimable based on ALL resources
      const totalMaxClaimable = resources.reduce((sum, r) => {
        return sum + (r.ocxRate || 0) * r.amount
      }, 0)

      // Validate that requested amount doesn't exceed what backend allows
      if (ocxToReceive > totalMaxClaimable) {
        setTradeError(`Cannot trade ${ocxToReceive} OCX. Maximum claimable from all resources: ${totalMaxClaimable.toFixed(1)} OCX`)
        setIsTrading(false)
        return
      }

      // Get signer from wallet
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

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

      // Update OCX balance in database
      // Use wallet_address with ilike for reliability (case-insensitive match)
      const newOcxTotal = (playerData.total_ocx_earned || 0) + result.ocxReceived;
      const { error: updateError } = await supabase
        .from("players")
        .update({
          total_ocx_earned: newOcxTotal,
        })
        .ilike("wallet_address", playerData.wallet_address.toLowerCase())
      
      if (updateError) {
        console.error("❌ Failed to update total_ocx_earned:", updateError);
      } else {
        console.log(`✅ Database updated: total_ocx_earned = ${newOcxTotal}`);
      }

      // Refresh balance
      await fetchOCXBalance()

      // Keep modal open to show success message with tx link
      setTradeStep(5)
      setTradeStatus(`Successfully traded! Received ${result.ocxReceived} OCX`)
      
      // Close modal after 3 seconds
      setTimeout(() => {
        setSelectedResource(null)
        setTradeAmount(1)
        setIsTrading(false)
      }, 3000)

    } catch (error: any) {
      console.error("Trade error:", error)
      setTradeError(error.message || "Unknown error occurred")
      setIsTrading(false)
    }
  }

  const totalOCXFromTrade = selectedResource && selectedResource.ocxRate ? selectedResource.ocxRate * tradeAmount : 0

  return (
    <StyleWrapper>
      <div className="min-h-screen bg-gradient-to-b from-depth-950 via-depth-900 to-depth-950 text-white relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,176,255,0.1),transparent_50%)]" />
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-cyan-400 rounded-full"
              initial={{
                x: Math.random() * window.innerWidth,
                y: window.innerHeight + 100,
                opacity: 0,
              }}
              animate={{
                y: -100,
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: Math.random() * 10 + 10,
                repeat: Infinity,
                delay: Math.random() * 5,
              }}
            />
          ))}
        </div>

        {/* Header */}
        <div className="relative z-10">
          <motion.header
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="border-b border-cyan-500/20 bg-depth-900/80 backdrop-blur-xl"
          >
            <div className="container mx-auto px-4 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    onClick={() => router.push("/home")}
                    variant="ghost"
                    className="hover:bg-cyan-500/10 hover:text-cyan-400 transition-all"
                  >
                    <ArrowLeft className="mr-2 h-5 w-5" />
                    Back to Home
                  </Button>
                  <div className="h-8 w-px bg-cyan-500/20" />
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg">
                      <TrendingUp className="h-6 w-6 text-cyan-400" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        Ocean Trading Hub
                      </h1>
                      <p className="text-sm text-cyan-400/60">Convert Resources to OCX</p>
                    </div>
                  </div>
                </div>

                {/* Wallet Balance */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center gap-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl px-6 py-3"
                >
                  <Wallet className="h-5 w-5 text-cyan-400" />
                  <div>
                    <p className="text-xs text-cyan-400/60">OCX Balance</p>
                    <p className="text-xl font-bold text-cyan-400">
                      {balanceLoading ? "..." : parseFloat(ocxBalance).toFixed(2)}
                    </p>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.header>

          {/* Filters and Search */}
          <div className="container mx-auto px-4 py-6">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-depth-900/50 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6 mb-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Search */}
                <div className="md:col-span-2 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400/60" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search resources..."
                    className="pl-10 bg-depth-800/50 border-cyan-500/30 focus:border-cyan-400 text-white placeholder:text-cyan-400/40"
                  />
                </div>


                {/* Sort by Value */}
                <div className="relative">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full h-10 px-3 bg-depth-800/50 border border-cyan-500/30 rounded-md text-white focus:border-cyan-400 focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="all">Sort by Value</option>
                    <option value="low-to-high">Price: Low to High</option>
                    <option value="high-to-low">Price: High to Low</option>
                    <option value="stock">Most in Stock</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400/60 pointer-events-none" />
                </div>
              </div>

              {/* Quick Stats */}
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-cyan-500/20">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm text-cyan-400/80">
                    {filteredResources.length} Resources Available
                  </span>
                </div>
                <Button
                  onClick={() => setShowHistory(true)}
                  variant="ghost"
                  size="sm"
                  className="text-cyan-400 hover:bg-cyan-500/10"
                >
                  <History className="mr-2 h-4 w-4" />
                  Trade History
                </Button>
              </div>
            </motion.div>

            {/* Resource Grid */}
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              <AnimatePresence mode="popLayout">
                {filteredResources.map((resource, index) => (
                  <motion.div
                                  key={resource.id}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.9 }}
                                  transition={{ delay: index * 0.05 }}
                                  whileHover={{ y: -8, scale: 1.02 }}
                                  className="group"
                                >
                                  <Card
                                    className={"relative overflow-hidden bg-gradient-to-br from-depth-800/80 to-depth-900/80 border-2 hover:border-cyan-400/50 transition-all duration-300 hover:shadow-2xl cursor-pointer backdrop-blur-sm"}
                                    onClick={() => setSelectedResource(resource)}
                                  >
                                    {/* Glow Effect */}
                                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                                    <CardContent className="p-6 relative">
                        {/* Icon */}
                        <div className="flex justify-center mb-4">
                          <motion.div
                            whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                            transition={{ duration: 0.5 }}
                            className="text-6xl"
                          >
                            {resource.icon}
                          </motion.div>
                        </div>

                        {/* Name & Category */}
                        <h3 className="text-lg font-bold text-center mb-1 text-white">
                          {resource.name}
                        </h3>
                        {/* category removed - all resources are mineable minerals */}
                        <p className="text-xs text-center text-cyan-400/60 mb-3 capitalize">Mineral</p>

                        {/* Description */}
                        <p className="text-xs text-center text-cyan-400/50 mb-4 min-h-[2.5rem]">
                          {resource.description}
                        </p>

                        {/* Stats */}
                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between items-center p-2 bg-cyan-500/5 rounded-lg">
                            <span className="text-sm text-cyan-400/70">In Stock:</span>
                            <span className="text-sm font-semibold text-white">{resource.amount}</span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-cyan-500/5 rounded-lg">
                            <span className="text-sm text-cyan-400/70">Market Value:</span>
                            <span className="text-sm font-semibold text-cyan-400 flex items-center gap-1">
                              <Coins className="h-3 w-3" />
                              {resource.ocxRate ? `${resource.ocxRate} OCX` : "—"}
                            </span>
                          </div>
                        </div>

                        {/* Trade Button */}
                        <Button
                          className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold"
                          disabled={resource.amount === 0}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedResource(resource)
                          }}
                        >
                          {resource.amount === 0 ? "Out of Stock" : "Trade Now"}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {filteredResources.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20"
              >
                <Sparkles className="h-16 w-16 text-cyan-400/30 mx-auto mb-4" />
                <p className="text-xl text-cyan-400/60">No resources found</p>
                <p className="text-sm text-cyan-400/40 mt-2">Try adjusting your filters</p>
              </motion.div>
            )}
          </div>
        </div>

        {/* Trade Dialog */}
        <Dialog open={!!selectedResource} onOpenChange={() => setSelectedResource(null)}>
          <DialogContent className="bg-gradient-to-br from-depth-900 to-depth-950 border-2 border-cyan-500/30 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Trade {selectedResource?.name}
              </DialogTitle>
              <DialogDescription className="text-cyan-400/60">
                Convert your resources to OCX tokens
              </DialogDescription>
            </DialogHeader>

            {selectedResource && (
              <div className="space-y-6">
                {/* Resource Display */}
                <div className="flex items-center gap-4 p-4 bg-cyan-500/5 rounded-xl border border-cyan-500/20">
                  <div className="text-5xl">{selectedResource.icon}</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{selectedResource.name}</h4>
                    <p className="text-sm text-cyan-400/60">{selectedResource.description}</p>
                  </div>
                </div>

                {/* Amount Selector */}
                <div className="space-y-2">
                  <label className="text-sm text-cyan-400/80 font-medium">Trade Amount</label>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTradeAmount(Math.max(1, tradeAmount - 1))}
                      disabled={tradeAmount <= 1}
                      className="border-cyan-500/30 hover:bg-cyan-500/10"
                    >
                      -
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      max={selectedResource.amount}
                      value={tradeAmount}
                      onChange={(e) =>
                        setTradeAmount(
                          Math.min(selectedResource.amount, Math.max(1, parseInt(e.target.value) || 1))
                        )
                      }
                      className="text-center bg-depth-800/50 border-cyan-500/30 focus:border-cyan-400"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setTradeAmount(Math.min(selectedResource.amount, tradeAmount + 1))
                      }
                      disabled={tradeAmount >= selectedResource.amount}
                      className="border-cyan-500/30 hover:bg-cyan-500/10"
                    >
                      +
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTradeAmount(selectedResource.amount)}
                      className="text-cyan-400 hover:bg-cyan-500/10"
                    >
                      Max
                    </Button>
                  </div>
                  <p className="text-xs text-cyan-400/50">
                    Available: {selectedResource.amount} units
                  </p>
                </div>

                {/* Exchange Rate Display */}
                <div className="p-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-cyan-400/70">Exchange Rate:</span>
                    <span className="text-sm font-semibold text-cyan-400">
                      {selectedResource.ocxRate} OCX per unit
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-white">You'll Receive:</span>
                    <span className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
                      <Coins className="h-6 w-6" />
                      {totalOCXFromTrade.toLocaleString()} OCX
                    </span>
                  </div>
                </div>

                {/* Transaction Status */}
                {isTrading && (
                  <div className="space-y-3 p-4 bg-depth-800/50 rounded-lg border border-cyan-500/20">
                    <div className="flex items-center gap-3">
                      {tradeStep < 5 ? (
                        <Loader2 className="h-5 w-5 text-cyan-400 animate-spin" />
                      ) : tradeError ? (
                        <AlertCircle className="h-5 w-5 text-red-400" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-cyan-400">
                          {tradeError ? "Trade Failed" : tradeStatus || "Processing..."}
                        </p>
                        {tradeError && (
                          <p className="text-xs text-red-400 mt-1">{tradeError}</p>
                        )}
                        {txHash && (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mt-1"
                          >
                            View on Etherscan <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    {tradeStep > 0 && tradeStep < 5 && (
                      <div className="w-full bg-depth-700 rounded-full h-1.5">
                        <div
                          className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${(tradeStep / 4) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Info Notice */}
                <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-400/80">
                    Trades are processed on the blockchain. You'll pay gas fees in ETH to complete the transaction.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedResource(null)
                      setTradeError("")
                      setTxHash("")
                    }}
                    className="flex-1 border-cyan-500/30 hover:bg-cyan-500/10"
                    disabled={isTrading && tradeStep > 0 && tradeStep < 4}
                  >
                    {tradeError || tradeStep === 5 ? "Close" : "Cancel"}
                  </Button>
                  <Button
                    onClick={handleTrade}
                    disabled={isTrading || tradeAmount <= 0 || tradeAmount > selectedResource.amount}
                    className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50"
                  >
                    {isTrading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {tradeStep === 1 ? "Requesting..." : tradeStep === 2 ? "Confirm in Wallet" : tradeStep === 3 ? "Confirming..." : "Processing..."}
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Confirm Trade
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Trade History Dialog */}
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className="bg-gradient-to-br from-depth-900 to-depth-950 border-2 border-cyan-500/30 text-white max-w-2xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Trade History
              </DialogTitle>
              <DialogDescription className="text-cyan-400/60">
                Your recent marketplace transactions
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 overflow-y-auto max-h-[60vh] pr-2">
              {recentTrades.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-16 w-16 text-cyan-400/30 mx-auto mb-4" />
                  <p className="text-cyan-400/60">No trades yet</p>
                  <p className="text-sm text-cyan-400/40 mt-2">Start trading to see your history</p>
                </div>
              ) : (
                recentTrades.map((trade) => (
                  <motion.div
                    key={trade.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl hover:bg-cyan-500/10 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white">{trade.resourceName}</p>
                        <p className="text-sm text-cyan-400/60">
                          {new Date(trade.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-cyan-400/70">Amount: {trade.amount}</p>
                        <p className="font-semibold text-cyan-400 flex items-center gap-1 justify-end">
                          <Coins className="h-4 w-4" />
                          +{trade.ocxReceived} OCX
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </StyleWrapper>
  )
}
