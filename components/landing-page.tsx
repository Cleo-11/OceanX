"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Anchor, Waves, Gem, Zap, Users, ArrowRight, Play, UserPlus, LogIn } from "lucide-react"
import { useRouter } from "next/navigation"

export default function LandingPage() {
  const [isHovered, setIsHovered] = useState(false)
  const router = useRouter()

  const handleLogin = () => {
    router.push("/auth?mode=login")
  }

  const handleSignUp = () => {
    router.push("/auth?mode=signup")
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 text-white overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-128 h-128 bg-teal-500/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 p-6">
        <nav className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-2">
            <Anchor className="w-8 h-8 text-cyan-400" />
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              OceanX
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={handleLogin}
              className="text-slate-300 hover:text-white hover:bg-slate-800/50"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Login
            </Button>
            <Button
              onClick={handleSignUp}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Sign Up
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
  <main className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-6 bg-slate-800/50 text-cyan-400 border-cyan-500/30">
            <Waves className="w-4 h-4 mr-2" />
            Deep Sea Mining Adventure
          </Badge>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-blue-400 to-teal-400 bg-clip-text text-transparent leading-tight">
            Dive Into the
            <br />
            Ocean's Depths
          </h1>

          <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-3xl mx-auto leading-relaxed">
            Command your submarine fleet, mine precious resources from the ocean floor, and compete with players
            worldwide in this immersive blockchain-powered adventure.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button
              size="lg"
              onClick={handleSignUp}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-8 py-4 text-lg font-semibold transform hover:scale-105 transition-all duration-200"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <Play className={`w-5 h-5 mr-2 ${isHovered ? "animate-pulse" : ""}`} />
              Start Your Journey
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={handleLogin}
              className="border-slate-600 text-slate-300 hover:bg-slate-800/50 hover:text-white px-8 py-4 text-lg bg-transparent"
            >
              <LogIn className="w-5 h-5 mr-2" />I Have an Account
            </Button>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="bg-slate-800/30 border-slate-700 backdrop-blur-sm hover:bg-slate-800/50 transition-all duration-300">
              <CardContent className="p-6 text-center">
                <Gem className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Mine Resources</h3>
                <p className="text-slate-400">
                  Extract valuable minerals from the ocean floor and build your underwater empire.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/30 border-slate-700 backdrop-blur-sm hover:bg-slate-800/50 transition-all duration-300">
              <CardContent className="p-6 text-center">
                <Zap className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Upgrade Fleet</h3>
                <p className="text-slate-400">
                  Enhance your submarines with advanced technology and increase mining efficiency.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/30 border-slate-700 backdrop-blur-sm hover:bg-slate-800/50 transition-all duration-300">
              <CardContent className="p-6 text-center">
                <Users className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Compete Globally</h3>
                <p className="text-slate-400">
                  Challenge players worldwide and climb the leaderboards to earn exclusive rewards.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Stats Section */}
      <section className="relative z-10 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-cyan-400 mb-2">10K+</div>
              <div className="text-slate-400">Active Miners</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-400 mb-2">50M+</div>
              <div className="text-slate-400">Resources Mined</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-teal-400 mb-2">1000+</div>
              <div className="text-slate-400">Submarines Deployed</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-400 mb-2">24/7</div>
              <div className="text-slate-400">Ocean Exploration</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800 py-8 px-6">
        <div className="max-w-4xl mx-auto text-center text-slate-400">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Anchor className="w-6 h-6 text-cyan-400" />
            <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              OceanX
            </span>
          </div>
          <p className="text-sm">© 2024 OceanX. Dive deep, mine smart, conquer the seas.</p>
        </div>
      </footer>

    </div>
  )
}
