"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Anchor, Waves, Gem, Zap, Users, ArrowRight, Play, UserPlus, LogIn, ChevronDown } from "lucide-react"
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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 text-white overflow-hidden relative">
      {/* Animated Ocean Waves */}
      <div className="absolute inset-x-0 bottom-0 z-0 pointer-events-none">
        <svg className="w-full h-40 md:h-56 animate-wave" viewBox="0 0 1440 320" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill="#06b6d4" fillOpacity="0.2" d="M0,160L60,170.7C120,181,240,203,360,197.3C480,192,600,160,720,154.7C840,149,960,171,1080,186.7C1200,203,1320,213,1380,218.7L1440,224L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z" />
          <path fill="#0ea5e9" fillOpacity="0.15" d="M0,224L60,208C120,192,240,160,360,154.7C480,149,600,171,720,181.3C840,192,960,192,1080,186.7C1200,181,1320,171,1380,165.3L1440,160L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z" />
        </svg>
      </div>

      {/* Floating Submarine SVG */}
      <div className="absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
        <svg width="220" height="90" viewBox="0 0 220 90" fill="none" className="animate-float drop-shadow-xl opacity-80">
          <ellipse cx="110" cy="60" rx="80" ry="18" fill="#0ea5e9" fillOpacity="0.18" />
          <rect x="40" y="30" width="140" height="40" rx="20" fill="#334155" stroke="#06b6d4" strokeWidth="3" />
          <circle cx="60" cy="50" r="8" fill="#06b6d4" />
          <circle cx="160" cy="50" r="8" fill="#06b6d4" />
          <rect x="100" y="18" width="20" height="18" rx="6" fill="#0ea5e9" stroke="#06b6d4" strokeWidth="2" />
          <rect x="120" y="38" width="18" height="8" rx="3" fill="#0ea5e9" />
        </svg>
      </div>

      {/* Parallax Bubbles */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <span
            key={i}
            className={`absolute rounded-full bg-cyan-300/20 blur-2xl animate-bubble${i % 3 + 1}`}
            style={{
              left: `${Math.random() * 100}%`,
              width: `${24 + Math.random() * 32}px`,
              height: `${24 + Math.random() * 32}px`,
              bottom: `${Math.random() * 60}%`,
              animationDelay: `${i * 0.7}s`,
            }}
          />
        ))}
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
        {/* Scroll Down Indicator */}
        <div className="absolute left-1/2 top-[80vh] -translate-x-1/2 z-20 animate-bounce pointer-events-none">
          <ChevronDown className="w-10 h-10 text-cyan-400/70" />
        </div>
        <div className="max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-6 bg-slate-800/50 text-cyan-400 border-cyan-500/30">
            <Waves className="w-4 h-4 mr-2" />
            Deep Sea Mining Adventure
          </Badge>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-blue-400 to-teal-400 bg-clip-text text-transparent leading-tight drop-shadow-lg">
            Dive Into the
            <br />
            <span className="relative inline-block">
              Ocean's Depths
              <span className="absolute left-0 right-0 -bottom-2 h-2 bg-cyan-400/30 rounded-full blur-md animate-glow" />
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-3xl mx-auto leading-relaxed">
            Command your submarine fleet, mine precious resources from the ocean floor, and compete with players
            worldwide in this immersive blockchain-powered adventure.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button
              size="lg"
              onClick={handleSignUp}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-8 py-4 text-lg font-semibold transform hover:scale-110 transition-all duration-200 shadow-lg ring-2 ring-cyan-400/30 hover:ring-cyan-400/60 animate-glow-btn"
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
              className="border-slate-600 text-slate-300 hover:bg-slate-800/50 hover:text-white px-8 py-4 text-lg bg-transparent backdrop-blur-md"
            >
              <LogIn className="w-5 h-5 mr-2" />I Have an Account
            </Button>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="bg-slate-800/30 border-slate-700 backdrop-blur-sm hover:scale-105 hover:shadow-cyan-400/20 hover:shadow-2xl transition-all duration-300 group cursor-pointer">
              <CardContent className="p-6 text-center">
                <Gem className="w-12 h-12 text-cyan-400 mx-auto mb-4 group-hover:animate-wiggle" />
                <h3 className="text-xl font-semibold mb-2">Mine Resources</h3>
                <p className="text-slate-400">
                  Extract valuable minerals from the ocean floor and build your underwater empire.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/30 border-slate-700 backdrop-blur-sm hover:scale-105 hover:shadow-yellow-400/20 hover:shadow-2xl transition-all duration-300 group cursor-pointer">
              <CardContent className="p-6 text-center">
                <Zap className="w-12 h-12 text-yellow-400 mx-auto mb-4 group-hover:animate-wiggle" />
                <h3 className="text-xl font-semibold mb-2">Upgrade Fleet</h3>
                <p className="text-slate-400">
                  Enhance your submarines with advanced technology and increase mining efficiency.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/30 border-slate-700 backdrop-blur-sm hover:scale-105 hover:shadow-green-400/20 hover:shadow-2xl transition-all duration-300 group cursor-pointer">
              <CardContent className="p-6 text-center">
                <Users className="w-12 h-12 text-green-400 mx-auto mb-4 group-hover:animate-wiggle" />
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

      {/* Custom Animations */}
      <style jsx global>{`
        @keyframes wave {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50px); }
        }
        .animate-wave {
          animation: wave 12s linear infinite alternate;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-18px); }
        }
        .animate-float {
          animation: float 5s ease-in-out infinite;
        }
        @keyframes bubble1 {
          0% { transform: translateY(0) scale(1); opacity: 0.5; }
          80% { opacity: 0.7; }
          100% { transform: translateY(-120vh) scale(1.2); opacity: 0; }
        }
        @keyframes bubble2 {
          0% { transform: translateY(0) scale(1); opacity: 0.5; }
          80% { opacity: 0.8; }
          100% { transform: translateY(-100vh) scale(1.3); opacity: 0; }
        }
        @keyframes bubble3 {
          0% { transform: translateY(0) scale(1); opacity: 0.5; }
          80% { opacity: 0.9; }
          100% { transform: translateY(-140vh) scale(1.1); opacity: 0; }
        }
        .animate-bubble1 { animation: bubble1 18s linear infinite; }
        .animate-bubble2 { animation: bubble2 22s linear infinite; }
        .animate-bubble3 { animation: bubble3 16s linear infinite; }
        @keyframes glow {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        .animate-glow {
          animation: glow 2.5s ease-in-out infinite;
        }
        @keyframes glowBtn {
          0%, 100% { box-shadow: 0 0 0 0 #06b6d4aa; }
          50% { box-shadow: 0 0 24px 8px #06b6d4cc; }
        }
        .animate-glow-btn {
          animation: glowBtn 2.2s ease-in-out infinite;
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-8deg); }
          50% { transform: rotate(8deg); }
          80% { transform: rotate(-4deg); }
        }
        .animate-wiggle {
          animation: wiggle 0.7s ease-in-out;
        }
      `}</style>
    </div>
  )
}
