"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import {
  Waves,
  Wallet,
  Trophy,
  Zap,
  Package,
  Calendar,
  ArrowLeft,
  LogOut,
  AlertTriangle,
  Coins,
  Anchor,
  Award,
  Target,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { supabase } from "@/lib/supabase"
import { WalletManager } from "@/lib/wallet"
import { ProfileData } from "./page"

interface ProfileClientProps {
  profileData: ProfileData
  walletAddress: string
}

/**
 * ProfileClient - Client-side component for profile page
 * Handles interactive UI, animations, and wallet disconnection
 */
export function ProfileClient({ profileData, walletAddress }: ProfileClientProps) {
  const router = useRouter()
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [liveBalance] = useState(profileData.tokenInfo.ocxBalance)

  // Format wallet address for display
  const formatWallet = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Unknown"
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Note: Balance updates are handled by the ProfileData prop
  // No need for polling since the server component provides fresh data
  // and blockchain events would require web3 listeners in production

  // Handle wallet disconnection
  const handleDisconnect = async () => {
    setIsDisconnecting(true)

    try {
      // Update player record to remove wallet_address instead of deleting the entire record
      // This preserves the user's account and game progress
      const { error: updateError } = await supabase
        .from("players")
        .update({ wallet_address: null })
        .eq("user_id", profileData.playerInfo.userId)

      if (updateError) {
        console.error("❌ [Profile] Failed to disconnect wallet:", updateError)
        throw updateError
      }

      // Disconnect wallet using WalletManager
      const walletManager = WalletManager.getInstance()
      walletManager.disconnect()

      // Redirect to connect wallet page
      router.push("/connect-wallet")
    } catch (error) {
      console.error("❌ [Profile] Disconnect failed:", error)
      alert("Failed to disconnect. Please try again.")
      setIsDisconnecting(false)
    }
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      },
    },
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-depth-950 via-depth-900 to-ocean-900 text-ocean-50">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
        <motion.div
          className="absolute top-20 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-20 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.5, 0.3, 0.5],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between mb-8"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/game")}
            className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Ocean
          </Button>

          <div className="flex items-center gap-2">
            <Waves className="h-6 w-6 text-cyan-400" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Captain's Profile
            </h1>
          </div>

          <div className="w-32" /> {/* Spacer for centering */}
        </motion.div>

        {/* Bento Grid Layout */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {/* Player Info Card - Full width on mobile, spans 2 cols on desktop */}
          <motion.div
            variants={cardVariants}
            whileHover={{ scale: 1.02, y: -5 }}
            transition={{ duration: 0.3 }}
            className="lg:col-span-2"
          >
            <Card className="bg-depth-900/60 backdrop-blur-xl border-cyan-500/20 shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/30 hover:border-cyan-500/40 overflow-hidden group transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-cyan-300">
                  <Anchor className="h-5 w-5" />
                  Captain Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ocean-300">Username</p>
                    <p className="text-xl font-bold text-ocean-50">
                      {profileData.playerInfo.username}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                  >
                    Active Captain
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-ocean-300 flex items-center gap-1">
                      <Wallet className="h-3 w-3" />
                      Wallet Address
                    </p>
                    <p className="font-mono text-sm text-ocean-50 bg-depth-950/50 px-3 py-2 rounded-lg border border-cyan-500/10">
                      {formatWallet(walletAddress)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-ocean-300 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Join Date
                    </p>
                    <p className="font-semibold text-ocean-50">
                      {formatDate(profileData.playerInfo.joinDate)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Token Info Card */}
          <motion.div
            variants={cardVariants}
            whileHover={{ scale: 1.02, y: -5 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-depth-900/60 backdrop-blur-xl border-yellow-500/20 shadow-lg shadow-yellow-500/10 hover:shadow-yellow-500/30 hover:border-yellow-500/40 overflow-hidden group h-full transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-400">
                  <Coins className="h-5 w-5" />
                  Token Economy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-ocean-300">OCX Balance</p>
                  <motion.p
                    key={liveBalance}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    className="text-3xl font-bold text-yellow-400"
                  >
                    {liveBalance.toLocaleString()}
                  </motion.p>
                </div>

                <div className="space-y-2 pt-2 border-t border-yellow-500/10">
                  <div className="flex justify-between text-sm">
                    <span className="text-ocean-300">Total Earned</span>
                    <span className="font-semibold text-ocean-50">
                      {profileData.tokenInfo.totalEarned.toLocaleString()} OCX
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ocean-300">Total Mined</span>
                    <span className="font-semibold text-ocean-50">
                      {profileData.tokenInfo.totalMined.toLocaleString()} resources
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Submarine Info Card */}
          <motion.div
            variants={cardVariants}
            whileHover={{ scale: 1.02, y: -5 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-depth-900/60 backdrop-blur-xl border-purple-500/20 shadow-lg shadow-purple-500/10 hover:shadow-purple-500/30 hover:border-purple-500/40 overflow-hidden group h-full transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-400">
                  <Anchor className="h-5 w-5" />
                  Submarine Fleet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-ocean-300">Current Model</p>
                  <p className="text-xl font-bold text-ocean-50">
                    {profileData.submarineInfo.submarineName}
                  </p>
                  <Badge
                    variant="outline"
                    className="mt-2 bg-purple-500/10 text-purple-300 border-purple-500/30"
                  >
                    Tier {profileData.submarineInfo.currentTier}
                  </Badge>
                </div>

                {profileData.submarineInfo.nextUpgradeCost && (
                  <div className="pt-2 border-t border-purple-500/10">
                    <p className="text-sm text-ocean-300 mb-1">Next Upgrade Cost</p>
                    <p className="text-lg font-semibold text-purple-400">
                      {profileData.submarineInfo.nextUpgradeCost.toLocaleString()} OCX
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Resource Stats Card */}
          <motion.div
            variants={cardVariants}
            whileHover={{ scale: 1.02, y: -5 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-depth-900/60 backdrop-blur-xl border-green-500/20 shadow-lg shadow-green-500/10 hover:shadow-green-500/30 hover:border-green-500/40 overflow-hidden group h-full transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-400">
                  <Package className="h-5 w-5" />
                  Resource Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-ocean-300">Resources Mined</span>
                  <span className="font-bold text-green-400">
                    {profileData.resourceStats.totalResourcesMined.toLocaleString()}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-ocean-300 flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Fuel Remaining
                    </span>
                    <span className="font-semibold text-ocean-50">
                      {profileData.resourceStats.fuelRemaining}%
                    </span>
                  </div>
                  <Progress
                    value={profileData.resourceStats.fuelRemaining}
                    className="h-2 bg-depth-950/50"
                  />
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-green-500/10">
                  <span className="text-sm text-ocean-300">Missions Completed</span>
                  <span className="font-bold text-ocean-50">
                    {profileData.resourceStats.missionsCompleted}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Achievements Card */}
          <motion.div
            variants={cardVariants}
            whileHover={{ scale: 1.02, y: -5 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-depth-900/60 backdrop-blur-xl border-orange-500/20 shadow-lg shadow-orange-500/10 hover:shadow-orange-500/30 hover:border-orange-500/40 overflow-hidden group h-full transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-400">
                  <Award className="h-5 w-5" />
                  Achievements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ocean-300">Badges Unlocked</p>
                    <p className="text-3xl font-bold text-orange-400">
                      {profileData.achievements.badgesUnlocked}
                    </p>
                  </div>
                  <Trophy className="h-12 w-12 text-orange-500/30" />
                </div>

                <div className="space-y-2 pt-2 border-t border-orange-500/10">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ocean-300 flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      Next Goal Progress
                    </span>
                    <span className="font-semibold text-ocean-50">
                      {profileData.achievements.nextGoalProgress.toFixed(0)}%
                    </span>
                  </div>
                  <Progress
                    value={profileData.achievements.nextGoalProgress}
                    className="h-2 bg-depth-950/50"
                  />
                  <p className="text-xs text-ocean-400">
                    {1000 - (profileData.resourceStats.totalResourcesMined % 1000)} resources until
                    next badge
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Disconnect Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-12 flex justify-center"
        >
          <Button
            variant="outline"
            size="lg"
            onClick={() => setShowDisconnectModal(true)}
            disabled={isDisconnecting}
            className="bg-red-950/30 hover:bg-red-950/50 text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-500/50 transition-all duration-300"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isDisconnecting ? "Disconnecting..." : "Disconnect Wallet"}
          </Button>
        </motion.div>
      </div>

      {/* Disconnect Warning Modal */}
      <AlertDialog open={showDisconnectModal} onOpenChange={setShowDisconnectModal}>
        <AlertDialogContent className="bg-depth-900 border-red-500/30 text-ocean-50">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Warning: Data Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-ocean-300">
              Disconnecting your wallet will permanently delete all your saved game data,
              including:
              <ul className="mt-3 space-y-2 list-disc list-inside">
                <li>Your submarine progress and upgrades</li>
                <li>All mined resources and OCX tokens</li>
                <li>Achievement badges and statistics</li>
                <li>Game history and records</li>
              </ul>
              <p className="mt-4 font-semibold text-red-400">
                This action cannot be undone. Are you sure you want to continue?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-depth-800 hover:bg-depth-700 text-ocean-50 border-ocean-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDisconnecting ? "Disconnecting..." : "Yes, Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
