"use client"
import { Waves, Anchor, Fish, Zap, Users, Trophy, ArrowRight, LogIn, UserPlus } from "lucide-react"

interface LandingPageProps {
  onLogin: () => void
  onSignUp: () => void
}

export function LandingPage({ onLogin, onSignUp }: LandingPageProps) {
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        {/* Floating Bubbles */}
        <div
          className="absolute top-20 left-10 w-4 h-4 bg-cyan-400/20 rounded-full animate-bounce"
          style={{ animationDelay: "0s", animationDuration: "3s" }}
        />
        <div
          className="absolute top-40 right-20 w-6 h-6 bg-blue-400/20 rounded-full animate-bounce"
          style={{ animationDelay: "1s", animationDuration: "4s" }}
        />
        <div
          className="absolute top-60 left-1/4 w-3 h-3 bg-teal-400/20 rounded-full animate-bounce"
          style={{ animationDelay: "2s", animationDuration: "3.5s" }}
        />
        <div
          className="absolute bottom-40 right-1/3 w-5 h-5 bg-cyan-300/20 rounded-full animate-bounce"
          style={{ animationDelay: "0.5s", animationDuration: "4.5s" }}
        />
        <div
          className="absolute bottom-60 left-1/2 w-4 h-4 bg-blue-300/20 rounded-full animate-bounce"
          style={{ animationDelay: "1.5s", animationDuration: "3.2s" }}
        />

        {/* Animated Fish */}
        <div className="absolute top-32 right-10 text-cyan-400/30 animate-pulse">
          <Fish className="w-8 h-8 transform rotate-12" />
        </div>
        <div className="absolute bottom-32 left-16 text-blue-400/30 animate-pulse" style={{ animationDelay: "1s" }}>
          <Fish className="w-6 h-6 transform -rotate-45 scale-x-[-1]" />
        </div>
        <div className="absolute top-1/2 right-1/4 text-teal-400/30 animate-pulse" style={{ animationDelay: "2s" }}>
          <Fish className="w-7 h-7 transform rotate-45" />
        </div>

        {/* Wave Patterns */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-blue-900/50 to-transparent">
          <svg className="absolute bottom-0 w-full h-16" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,60 C300,120 900,0 1200,60 L1200,120 L0,120 Z" fill="rgba(59, 130, 246, 0.1)" />
          </svg>
          <svg className="absolute bottom-0 w-full h-20" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,80 C400,20 800,100 1200,40 L1200,120 L0,120 Z" fill="rgba(6, 182, 212, 0.1)" />
          </svg>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 text-center">
        {/* Logo/Title Section */}
        <div className="mb-8">
          <div className="flex items-center justify-center mb-4">
            <Anchor className="w-12 h-12 text-cyan-400 mr-3" />
            <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-teal-400 bg-clip-text text-transparent">
              OceanX
            </h1>
          </div>
          <p className="text-xl md:text-2xl text-slate-300 font-light">Deep Sea Mining Adventure</p>
        </div>

        {/* Hero Description */}
        <div className="max-w-3xl mb-12">
          <p className="text-lg md:text-xl text-slate-400 leading-relaxed mb-6">
            Dive into the depths of the ocean and discover rare minerals in this multiplayer Web3 mining game. Upgrade
            your submarine, compete with other players, and build your underwater mining empire.
          </p>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-cyan-500/20">
              <Zap className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Mine Resources</h3>
              <p className="text-sm text-slate-400">
                Extract valuable minerals from the ocean floor using advanced submarine technology
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-blue-500/20">
              <Users className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Multiplayer</h3>
              <p className="text-sm text-slate-400">
                Join other players in real-time mining sessions and compete for the best spots
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-teal-500/20">
              <Trophy className="w-8 h-8 text-teal-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Upgrade & Trade</h3>
              <p className="text-sm text-slate-400">
                Enhance your submarine and trade resources using blockchain technology
              </p>
            </div>
          </div>
        </div>

        {/* Authentication Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <button
            onClick={onLogin}
            className="group relative px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg font-semibold text-white text-lg shadow-lg shadow-cyan-900/30 transition-all duration-300 hover:shadow-cyan-900/50 hover:scale-105"
          >
            <span className="flex items-center">
              <LogIn className="w-5 h-5 mr-3" />
              Login
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>

          <button
            onClick={onSignUp}
            className="group relative px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-600 rounded-lg font-semibold text-white text-lg shadow-lg shadow-teal-900/30 transition-all duration-300 hover:shadow-teal-900/50 hover:scale-105"
          >
            <span className="flex items-center">
              <UserPlus className="w-5 h-5 mr-3" />
              Sign Up
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>
        </div>

        <p className="text-sm text-slate-500 mt-3">Create your account • Connect your wallet • Start mining</p>

        {/* Game Info */}
        <div className="mt-12 text-xs text-slate-500 space-y-1">
          <div>🌊 Powered by Ethereum • Built with Next.js</div>
          <div>⚡ Real-time multiplayer • Blockchain integration</div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-10 left-10 text-cyan-400/20">
        <Waves className="w-16 h-16" />
      </div>
      <div className="absolute bottom-20 right-10 text-blue-400/20">
        <Anchor className="w-12 h-12 transform rotate-12" />
      </div>
    </div>
  )
}
