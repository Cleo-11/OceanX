"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Anchor, Waves, Gem, Users, ArrowRight, Play,
  UserPlus, LogIn, ShieldCheck,
  BarChart3, Radar, Wrench, Twitter, Globe2, Lock, LineChart
} from "lucide-react"
import { HeroSubmarine } from './hero-submarine';

// Custom Icon Components
function DiscordIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={props.width || 20}
      height={props.height || 20}
      className={`${props.className || ''} transition-all duration-300`}
      {...props}
    >
      <path
        d="M20.317 4.369A19.791 19.791 0 0 0 16.885 3.2a.077.077 0 0 0-.082.038c-.357.63-.755 1.453-1.037 2.104a18.524 18.524 0 0 0-5.53 0 12.683 12.683 0 0 0-1.05-2.104.077.077 0 0 0-.082-.038A19.736 19.736 0 0 0 3.684 4.369a.07.07 0 0 0-.032.027C.533 9.09-.32 13.579.099 18.021a.082.082 0 0 0 .031.056c2.128 1.565 4.195 2.507 6.228 3.13a.077.077 0 0 0 .084-.027c.48-.66.908-1.356 1.273-2.084a.076.076 0 0 0-.041-.104c-.676-.256-1.32-.568-1.934-.936a.077.077 0 0 1-.008-.127c.13-.098.26-.2.384-.304a.074.074 0 0 1 .077-.01c4.06 1.855 8.447 1.855 12.47 0a.073.073 0 0 1 .078.009c.124.104.254.206.384.304a.077.077 0 0 1-.006.127 12.298 12.298 0 0 1-1.936.936.076.076 0 0 0-.04.105c.366.727.794 1.423 1.272 2.083a.076.076 0 0 0 .084.028c2.034-.623 4.102-1.565 6.23-3.13a.077.077 0 0 0 .03-.055c.5-5.177-.838-9.637-3.548-13.625a.061.061 0 0 0-.03-.028ZM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.175 1.094 2.157 2.418 0 1.334-.955 2.419-2.157 2.419Zm7.974 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.175 1.094 2.157 2.418 0 1.334-.947 2.419-2.157 2.419Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Animated Fish component for underwater effect
function AnimatedFish({ color = "cyan", size = "sm", delay = 0, className = "" }) {
  const sizeClasses = {
    sm: "w-6 h-3",
    md: "w-8 h-4",
    lg: "w-12 h-6"
  };
  // Map color prop to explicit Tailwind classes
  const colorMap = {
    cyan: ['bg-cyan-500/40', 'bg-cyan-400/70', 'bg-cyan-300/40'],
    blue: ['bg-blue-500/40', 'bg-blue-400/70', 'bg-blue-300/40'],
    teal: ['bg-teal-500/40', 'bg-teal-400/70', 'bg-teal-300/40'],
    green: ['bg-green-500/40', 'bg-green-400/70', 'bg-green-300/40'],
    emerald: ['bg-emerald-500/40', 'bg-emerald-400/70', 'bg-emerald-300/40'],
    sky: ['bg-cyan-500/40', 'bg-cyan-400/70', 'bg-cyan-300/40'],
    indigo: ['bg-blue-500/40', 'bg-blue-400/70', 'bg-blue-300/40'],
  };
  const [body, left, top] = colorMap[color as keyof typeof colorMap] || colorMap['cyan'];
  return (
    <div 
      className={`absolute ${sizeClasses[size as keyof typeof sizeClasses]} ${className}`}
      style={{
        animation: `fishSwim 15s ease-in-out infinite ${delay}s`,
      }}
    >
      <div className="relative w-full h-full">
        <div className={`absolute inset-0 rounded-full ${body} blur-sm`}></div>
        <div className={`absolute left-0 top-1/2 transform -translate-y-1/2 w-1/2 h-full rounded-l-full ${left}`}></div>
        <div className={`absolute right-0 top-0 w-1/2 h-1/2 transform rotate-[30deg] origin-left ${top} rounded-r-sm`}></div>
        <div className={`absolute right-0 bottom-0 w-1/2 h-1/2 transform -rotate-[30deg] origin-left ${top} rounded-r-sm`}></div>
      </div>
    </div>
  );
}

// Animated Seaweed component for underwater effect
function Seaweed({ height = "h-24", left = "left-20", width = "w-4", color = "green", delay = 0 }) {
  // Map color prop to explicit Tailwind classes
  const colorMap = {
    cyan: ['bg-cyan-600/40', 'bg-cyan-400/30'],
    blue: ['bg-blue-600/40', 'bg-blue-400/30'],
    teal: ['bg-teal-600/40', 'bg-teal-400/30'],
    green: ['bg-green-600/40', 'bg-green-400/30'],
    emerald: ['bg-emerald-600/40', 'bg-emerald-400/30'],
  };
  const [main, bubble] = colorMap[color as keyof typeof colorMap] || colorMap['green'];
  return (
    <div 
      className={`absolute bottom-0 ${left} ${width} ${height} flex flex-col items-center`}
      style={{ 
        transformOrigin: 'bottom',
        animation: `seaweedSway 8s ease-in-out infinite ${delay}s` 
      }}
    >
      <div className={`w-full h-full ${main} rounded-t-full`}></div>
      <div className={`absolute top-1/4 left-1/2 w-8 h-8 rounded-full ${bubble} blur-md -translate-x-1/2`}></div>
    </div>
  );
}

import { useRouter } from "next/navigation"

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [showParticles, setShowParticles] = useState(false)
  const [parallaxOffset, setParallaxOffset] = useState({ x: 0, y: 0 })
  const [animationLoaded, setAnimationLoaded] = useState(false)
  const [treasureRevealed, setTreasureRevealed] = useState(false)
  const router = useRouter()
  
  // Handle mouse movement for parallax effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20
      const y = (e.clientY / window.innerHeight - 0.5) * 20
      setParallaxOffset({ x, y })
    }
    
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
      
      // Reveal treasure chest when user scrolls to bottom section
      const revealPoint = document.documentElement.scrollHeight - window.innerHeight - 500
      if (window.scrollY > revealPoint && !treasureRevealed) {
        setTreasureRevealed(true)
      }
    }
    
    // Fade in animations
    const timer = setTimeout(() => {
      setShowParticles(true)
      setTimeout(() => setAnimationLoaded(true), 500)
    }, 300)
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('scroll', handleScroll)
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(timer)
    }
  }, [treasureRevealed])

  const handleLogin = () => {
    router.push("/auth?mode=login")
  }

  const handleSignUp = () => {
    router.push("/auth?mode=signup")
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-950 via-blue-900 to-slate-900 text-white overflow-hidden">
      {/* Advanced Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Deep ocean gradient overlay */}
        <div 
          className="absolute inset-0 bg-gradient-to-b from-blue-950/90 via-blue-900/80 to-slate-900/90 opacity-80"
          style={{
            transform: `translate(${parallaxOffset.x * -0.02}px, ${parallaxOffset.y * -0.02}px)`,
          }}
        ></div>
        
        {/* Ocean floor texture */}
        <div 
          className="absolute inset-0 opacity-10 bg-hexagon-pattern"
          style={{
            transform: `translate(${parallaxOffset.x * -0.05}px, ${parallaxOffset.y * -0.05}px)`,
          }}
        ></div>
        
        {/* Dynamic light beams from surface */}
        <div 
          className="absolute top-0 left-1/4 w-[50vw] h-[90vh] bg-gradient-to-b from-cyan-400/5 to-transparent transform -rotate-12 blur-3xl"
          style={{
            transform: `translate(${parallaxOffset.x * 0.2}px, 0) rotate(-12deg)`,
          }}
        ></div>
        
        <div 
          className="absolute top-10 right-1/3 w-[40vw] h-[80vh] bg-gradient-to-b from-blue-400/5 to-transparent transform rotate-12 blur-3xl"
          style={{
            transform: `translate(${parallaxOffset.x * -0.3}px, 0) rotate(12deg)`,
          }}
        ></div>
        
        {/* Dynamic glow sources */}
        <div 
          className="absolute top-1/4 left-1/5 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"
          style={{
            transform: `translate(${parallaxOffset.x * 0.1}px, ${parallaxOffset.y * 0.1}px)`,
          }}
        ></div>
        <div 
          className="absolute bottom-1/3 right-1/4 w-[40rem] h-[40rem] bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"
          style={{
            transform: `translate(${parallaxOffset.x * -0.12}px, ${parallaxOffset.y * -0.12}px)`,
          }}
        ></div>
        <div 
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[50rem] h-[50rem] bg-teal-500/5 rounded-full blur-3xl animate-pulse delay-2000"
          style={{
            transform: `translate(calc(-50% + ${parallaxOffset.x * -0.08}px), calc(-50% + ${parallaxOffset.y * -0.08}px))`,
          }}
        ></div>
        
        {/* Water caustics animated effect */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20" 
          style={{
            backgroundImage: "url('/water-caustics.png')",
            transform: `translate(${parallaxOffset.x * -0.03}px, ${parallaxOffset.y * -0.03}px)`,
            animation: 'waterCaustics 15s linear infinite',
          }}
        ></div>
        
        {/* Animated sea flora */}
        {showParticles && (
          <>
            <Seaweed height="h-36" left="left-[5%]" width="w-6" color="teal" delay={0.5} />
            <Seaweed height="h-24" left="left-[10%]" width="w-4" color="green" delay={1.2} />
            <Seaweed height="h-40" left="left-[20%]" width="w-5" color="emerald" delay={0} />
            <Seaweed height="h-32" left="left-[85%]" width="w-5" color="teal" delay={0.8} />
            <Seaweed height="h-28" left="left-[92%]" width="w-6" color="green" delay={2} />
          </>
        )}
        
        {/* Animated sea creatures */}
        {showParticles && (
          <>
            <AnimatedFish color="cyan" size="md" delay={0} className="top-[15%] left-[10%]" />
            <AnimatedFish color="blue" size="sm" delay={1} className="top-[25%] left-[85%]" />
            <AnimatedFish color="teal" size="lg" delay={2} className="top-[60%] left-[75%]" />
            <AnimatedFish color="sky" size="sm" delay={3.5} className="top-[40%] left-[30%]" />
            <AnimatedFish color="indigo" size="md" delay={5} className="top-[75%] left-[50%]" />
          </>
        )}
        
        {/* Optimized animated bubbles - reduced from 25 to 12 for performance */}
        {showParticles && (
          <>
            {[...Array(12)].map((_, i) => (
              <div 
                key={i}
                className="absolute rounded-full bg-white/20 pointer-events-none"
                style={{
                  width: `${Math.random() * 16 + 6}px`,
                  height: `${Math.random() * 16 + 6}px`,
                  left: `${Math.random() * 100}%`,
                  bottom: `-20px`,
                  animation: `bubbleRise ${Math.random() * 15 + 10}s linear infinite ${Math.random() * 10}s`,
                  opacity: Math.random() * 0.4 + 0.15,
                  willChange: 'transform', // GPU acceleration hint
                }}
              />
            ))}
          </>
        )}
      </div>

      {/* Clean, professional navigation header */}
      <header className={`fixed w-full top-0 left-0 z-30 transition-all duration-300 ${scrolled ? 'bg-depth-900/80 backdrop-blur-xl shadow-lg border-b border-ocean-500/20' : 'bg-gradient-to-b from-depth-900/50 to-transparent backdrop-blur-sm'}`}>
        <nav className="flex items-center justify-between max-w-7xl mx-auto px-6 py-4 relative">
          {/* Clean logo without gimmicks */}
          <div className="flex items-center space-x-3 group">
            <Anchor className="w-8 h-8 text-ocean-400 group-hover:text-ocean-300 transition-colors duration-200" />
            <span className="text-2xl font-bold text-white">
              AbyssX
            </span>
          </div>
          
          {/* Always visible navigation links */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-depth-300 hover:text-white transition-colors duration-200 text-sm font-medium relative group">
              Features
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-ocean-400/70 group-hover:w-full transition-all duration-200"></span>
            </a>
            <a href="#resources" className="text-depth-300 hover:text-white transition-colors duration-200 text-sm font-medium relative group">
              Resources
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-ocean-400/70 group-hover:w-full transition-all duration-200"></span>
            </a>
            <a href="#about" className="text-depth-300 hover:text-white transition-colors duration-200 text-sm font-medium relative group">
              About
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-ocean-400/70 group-hover:w-full transition-all duration-200"></span>
            </a>
          </div>

          {/* Clean auth buttons with clear hierarchy */}
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              onClick={handleLogin}
              className="text-depth-200 hover:text-white hover:bg-white/5 transition-all duration-200"
            >
              <LogIn className="w-4 h-4 mr-2" />
              <span>Login</span>
            </Button>
            
            <Button
              onClick={handleSignUp}
              className="bg-gradient-to-r from-ocean-500 to-abyss-600 hover:from-ocean-400 hover:to-abyss-500 
                text-white shadow-lg shadow-ocean-500/25 hover:shadow-ocean-400/30 
                transition-all duration-200"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              <span>Sign Up</span>
            </Button>
          </div>
        </nav>
      </header>

      {/* Immersive Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[100vh] px-6 text-center pt-20 overflow-hidden">
        <div 
          className={`max-w-5xl mx-auto transition-all duration-1000 ${animationLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          style={{ transitionDelay: '300ms' }}
        >
          {/* Floating animated badge with pulse effect */}
          <div className="relative inline-block">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <Badge 
              variant="secondary" 
              className="relative mb-10 py-3 px-6 bg-blue-900/70 text-cyan-300 border border-cyan-500/30 backdrop-blur-md overflow-hidden animate-float"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer"></div>
              <Waves className="w-5 h-5 mr-3 animate-float" />
              <span className="relative z-10 font-medium tracking-widest text-sm">DEEP SEA MINING ADVENTURE</span>
            </Badge>
          </div>

          {/* Epic Main Heading with Parallax Animation */}
          <div 
            className="relative mb-10"
            style={{
              transform: `translate(${parallaxOffset.x * -0.05}px, ${parallaxOffset.y * -0.05}px)`,
            }}
          >
            <div 
              className="absolute -top-20 -right-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl opacity-70"
              style={{
                transform: `translate(${parallaxOffset.x * 0.1}px, ${parallaxOffset.y * 0.1}px)`,
              }}
            ></div>
            
            <div 
              className="absolute -bottom-20 -left-20 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl opacity-70"
              style={{
                transform: `translate(${parallaxOffset.x * -0.1}px, ${parallaxOffset.y * -0.1}px)`,
              }}
            ></div>
            
            <h1 className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-8 leading-[1.1] tracking-tight relative z-10 ${animationLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-1000`}>
              <span className="block relative mb-2 text-white">
                <span className="relative">Dive Into the</span>
              </span>
              
              <span className="block relative">
                <span className="bg-gradient-to-br from-ocean-300 via-abyss-400 to-ocean-500 bg-clip-text text-transparent">Ocean's Depths</span>
                <span className="absolute -bottom-2 left-0 w-full h-1.5 bg-gradient-to-r from-ocean-400 via-abyss-500 to-ocean-400 rounded-full transform origin-left scale-x-0 animate-grow-x"></span>
              </span>
            </h1>
            
            {/* Animated glowing orbs */}
            <div 
              className="absolute top-1/4 -right-10 w-20 h-20 rounded-full bg-cyan-500/5 animate-pulse blur-2xl"
              style={{
                transform: `translate(${parallaxOffset.x * 0.2}px, ${parallaxOffset.y * 0.2}px)`,
              }}
            ></div>
            <div 
              className="absolute bottom-1/4 -left-10 w-16 h-16 rounded-full bg-blue-500/5 animate-pulse delay-700 blur-2xl"
              style={{
                transform: `translate(${parallaxOffset.x * -0.2}px, ${parallaxOffset.y * -0.2}px)`,
              }}
            ></div>
          </div>

          {/* Enhanced subheading with custom color palette */}
          <div 
            className={`transition-all duration-1000 ${animationLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
            style={{ transitionDelay: '600ms' }}
          >
            <p className="text-lg md:text-xl text-depth-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              Command your <span className="text-ocean-400 font-semibold relative inline-block group">
                submarine fleet
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-ocean-400/70 group-hover:w-full transition-all duration-300"></span>
              </span>, mine precious resources from the 
              <span className="text-abyss-400 font-semibold relative inline-block group">
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-abyss-400/70 group-hover:w-full transition-all duration-300"></span>
                &nbsp;ocean floor
              </span>, and compete with players worldwide in this 
              <span className="text-ocean-300 font-semibold relative inline-block group">
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-ocean-300/70 group-hover:w-full transition-all duration-300"></span>
                &nbsp;blockchain-powered adventure
              </span>.
            </p>
          </div>

          {/* Clean, modern CTA buttons with clear hierarchy */}
          <div 
            className={`flex flex-col sm:flex-row gap-6 justify-center items-center mb-16 transition-all duration-1000 ${animationLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
            style={{ transitionDelay: '900ms' }}
          >
            <Button
              size="lg"
              onClick={handleSignUp}
              className="relative bg-gradient-to-r from-ocean-500 to-abyss-600 hover:from-ocean-400 hover:to-abyss-500 
                text-white px-12 py-4 text-base font-semibold rounded-xl 
                shadow-2xl shadow-ocean-500/25 hover:shadow-ocean-400/40 
                hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <Play className="w-5 h-5 mr-3" />
              <span>Start Your Journey</span>
              <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform duration-200" />
            </Button>

            <Button
              size="lg"
              variant="ghost"
              onClick={handleLogin}
              className="text-depth-200 hover:text-white px-8 py-4 text-base 
                hover:bg-white/5 transition-all duration-200"
            >
              <LogIn className="w-5 h-5 mr-2" />
              <span>Sign In</span>
            </Button>
          </div>

          {/* Premium Submarine Hero Scene */}
          <div 
            className={`relative my-16 max-w-5xl mx-auto transition-all duration-1000 transform ${animationLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
            style={{ transitionDelay: '1200ms' }}
          >
            <HeroSubmarine 
              className="w-full"
              parallaxOffset={parallaxOffset}
            />
          </div>

          {/* Enhanced Feature Presentation */}
          <div id="features" className={`mt-24 mb-12 text-center transition-all duration-1000 ${animationLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 relative inline-block">
              <span className="bg-gradient-to-br from-cyan-300 via-blue-400 to-teal-300 bg-clip-text text-transparent">
                Explore the Ocean's Depths
              </span>
              <span className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full transform origin-left"></span>
            </h2>
            <p className="text-slate-300 max-w-2xl mx-auto mb-12 text-lg">
              Discover an immersive underwater experience with cutting-edge blockchain technology
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-10 max-w-6xl mx-auto px-4">
            {/* Mine Resources Card */}
            <Card className="group bg-gradient-to-br from-blue-950/70 to-slate-900/70 border-0 backdrop-blur-lg hover:shadow-xl transition-all duration-500 overflow-hidden relative h-full">
              {/* Animated border effect */}
              <div className="absolute inset-0 p-px rounded-2xl overflow-hidden z-0">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/30 via-transparent to-cyan-600/30 animate-rotate-gradient"></div>
              </div>
              
              <CardContent className="p-8 relative z-10 flex flex-col h-full">
                {/* Animated background effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                
                {/* Floating Icon */}
                <div className="relative mb-8">
                  <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-cyan-500/20 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-all duration-700 group-hover:animate-pulse-slow"></div>
                  <div className="relative w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-cyan-900/70 to-blue-900/70 flex items-center justify-center shadow-inner-glow">
                    <div className="absolute inset-0.5 rounded-full bg-gradient-to-br from-cyan-700/50 to-blue-900/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <Gem className="w-10 h-10 text-cyan-400 group-hover:text-cyan-300 relative z-10 transition-all duration-500 transform group-hover:scale-110" />
                  </div>
                  
                  {/* Animated particles around icon */}
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={`gem-particle-${i}`}
                      className="absolute rounded-full bg-cyan-400/40 opacity-0 group-hover:opacity-100"
                      style={{
                        width: `${Math.random() * 4 + 2}px`,
                        height: `${Math.random() * 4 + 2}px`,
                        top: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`,
                        transition: 'opacity 300ms ease-out',
                        animation: `floatAround 3s ease-in-out infinite ${Math.random() * 2}s`,
                      }}
                    ></div>
                  ))}
                </div>
                
                {/* Enhanced Content */}
                <h3 className="text-2xl font-bold mb-3 text-white text-center group-hover:text-cyan-300 transition-colors duration-300">
                  Mine Resources
                </h3>
                
                <p className="text-slate-300 group-hover:text-slate-200 text-center transition-colors duration-300 leading-relaxed flex-grow">
                  Extract valuable minerals from the ocean floor using advanced submarine equipment. Collect rare resources to build your underwater empire with blockchain-verified authenticity.
                </p>
                
                {/* Feature highlights */}
                <div className="mt-6 space-y-2 text-sm text-left">
                  <div className="flex items-center text-cyan-300/80">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-2"></div>
                    <span>Discover 15+ rare mineral types</span>
                  </div>
                  <div className="flex items-center text-cyan-300/80">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-2"></div>
                    <span>NFT-backed resource ownership</span>
                  </div>
                  <div className="flex items-center text-cyan-300/80">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-2"></div>
                    <span>Dynamic resource distribution</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upgrade Fleet Card */}
            <Card className="group bg-gradient-to-br from-blue-950/70 to-slate-900/70 border-0 backdrop-blur-lg hover:shadow-xl transition-all duration-500 overflow-hidden relative h-full">
              {/* Animated border effect */}
              <div className="absolute inset-0 p-px rounded-2xl overflow-hidden z-0">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/30 via-transparent to-blue-600/30 animate-rotate-gradient"></div>
              </div>
              
              <CardContent className="p-8 relative z-10 flex flex-col h-full">
                {/* Animated background effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                
                {/* Floating Icon */}
                <div className="relative mb-8">
                  <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-blue-500/20 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-all duration-700 group-hover:animate-pulse-slow"></div>
                  <div className="relative w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-blue-900/70 to-indigo-900/70 flex items-center justify-center shadow-inner-glow">
                    <div className="absolute inset-0.5 rounded-full bg-gradient-to-br from-blue-700/50 to-indigo-900/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <Wrench className="w-10 h-10 text-blue-400 group-hover:text-blue-300 relative z-10 transition-all duration-500 transform group-hover:scale-110" />
                  </div>
                  
                  {/* Animated particles around icon */}
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={`wrench-particle-${i}`}
                      className="absolute rounded-full bg-blue-400/40 opacity-0 group-hover:opacity-100"
                      style={{
                        width: `${Math.random() * 4 + 2}px`,
                        height: `${Math.random() * 4 + 2}px`,
                        top: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`,
                        transition: 'opacity 300ms ease-out',
                        animation: `floatAround 3s ease-in-out infinite ${Math.random() * 2}s`,
                      }}
                    ></div>
                  ))}
                </div>
                
                {/* Enhanced Content */}
                <h3 className="text-2xl font-bold mb-3 text-white text-center group-hover:text-blue-300 transition-colors duration-300">
                  Upgrade Fleet
                </h3>
                
                <p className="text-slate-300 group-hover:text-slate-200 text-center transition-colors duration-300 leading-relaxed flex-grow">
                  Enhance your submarine fleet with cutting-edge technology and equipment. Improve mining efficiency, depth capabilities, and storage to maximize your underwater operations.
                </p>
                
                {/* Feature highlights */}
                <div className="mt-6 space-y-2 text-sm text-left">
                  <div className="flex items-center text-blue-300/80">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2"></div>
                    <span>Multiple submarine tiers</span>
                  </div>
                  <div className="flex items-center text-blue-300/80">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2"></div>
                    <span>Customizable equipment loadouts</span>
                  </div>
                  <div className="flex items-center text-blue-300/80">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2"></div>
                    <span>Specialized mining capabilities</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Compete Globally Card */}
            <Card className="group bg-gradient-to-br from-blue-950/70 to-slate-900/70 border-0 backdrop-blur-lg hover:shadow-xl transition-all duration-500 overflow-hidden relative h-full">
              {/* Animated border effect */}
              <div className="absolute inset-0 p-px rounded-2xl overflow-hidden z-0">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-600/30 via-transparent to-teal-600/30 animate-rotate-gradient"></div>
              </div>
              
              <CardContent className="p-8 relative z-10 flex flex-col h-full">
                {/* Animated background effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-teal-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                
                {/* Floating Icon */}
                <div className="relative mb-8">
                  <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-teal-500/20 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-all duration-700 group-hover:animate-pulse-slow"></div>
                  <div className="relative w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-teal-900/70 to-emerald-900/70 flex items-center justify-center shadow-inner-glow">
                    <div className="absolute inset-0.5 rounded-full bg-gradient-to-br from-teal-700/50 to-emerald-900/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <BarChart3 className="w-10 h-10 text-teal-400 group-hover:text-teal-300 relative z-10 transition-all duration-500 transform group-hover:scale-110" />
                  </div>
                  
                  {/* Animated particles around icon */}
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={`chart-particle-${i}`}
                      className="absolute rounded-full bg-teal-400/40 opacity-0 group-hover:opacity-100"
                      style={{
                        width: `${Math.random() * 4 + 2}px`,
                        height: `${Math.random() * 4 + 2}px`,
                        top: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`,
                        transition: 'opacity 300ms ease-out',
                        animation: `floatAround 3s ease-in-out infinite ${Math.random() * 2}s`,
                      }}
                    ></div>
                  ))}
                </div>
                
                {/* Enhanced Content */}
                <h3 className="text-2xl font-bold mb-3 text-white text-center group-hover:text-teal-300 transition-colors duration-300">
                  Compete Globally
                </h3>
                
                <p className="text-slate-300 group-hover:text-slate-200 text-center transition-colors duration-300 leading-relaxed flex-grow">
                  Challenge players from around the world in this competitive underwater ecosystem. Climb the global leaderboards and earn exclusive rewards for your achievements.
                </p>
                
                {/* Feature highlights */}
                <div className="mt-6 space-y-2 text-sm text-left">
                  <div className="flex items-center text-teal-300/80">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mr-2"></div>
                    <span>Seasonal tournaments & prizes</span>
                  </div>
                  <div className="flex items-center text-teal-300/80">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mr-2"></div>
                    <span>Guild system for team play</span>
                  </div>
                  <div className="flex items-center text-teal-300/80">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mr-2"></div>
                    <span>Exclusive reward NFTs</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Ecosystem Visualization */}
          <div className={`my-32 relative transition-all duration-1000 ${animationLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="absolute -left-16 -top-16 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl"></div>
            <div className="absolute -right-16 -bottom-16 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl"></div>
            
            <h2 className="text-center text-3xl md:text-4xl font-bold mb-16 relative inline-block w-full">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-cyan-500/10 rounded-full blur-3xl"></div>
              <span className="relative bg-gradient-to-br from-blue-300 via-cyan-400 to-teal-300 bg-clip-text text-transparent">
                Thriving Underwater Ecosystem
              </span>
              <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
            </h2>
            
            <div className="relative w-full h-[500px] rounded-3xl overflow-hidden bg-gradient-to-b from-blue-900/20 to-slate-900/30 backdrop-blur-sm border border-cyan-500/10">
              {/* Ocean background */}
              <div 
                className="absolute inset-0 bg-cover bg-center opacity-20"
                style={{
                  backgroundImage: "url('/water-caustics.png')",
                  animation: 'waterCaustics 25s linear infinite',
                  transform: `scale(1.1) translate(${parallaxOffset.x * -0.01}px, ${parallaxOffset.y * -0.01}px)`,
                }}
              ></div>
              
              {/* Center ecosystem hub */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="relative">
                  {/* Central hub glow */}
                  <div className="absolute -inset-6 rounded-full bg-cyan-500/20 blur-xl animate-pulse-slow"></div>
                  
                  {/* Central hub */}
                  <div 
                    className="relative w-28 h-28 rounded-full bg-gradient-to-br from-cyan-900/70 via-blue-900/70 to-slate-900/70 flex items-center justify-center z-10 border border-cyan-500/30 shadow-lg"
                    style={{
                      boxShadow: '0 0 30px rgba(8, 145, 178, 0.3), inset 0 0 15px rgba(6, 182, 212, 0.2)'
                    }}
                  >
                    {/* Hub content */}
                    <Anchor className="w-12 h-12 text-cyan-400" />
                  </div>
                  
                  {/* Connection lines */}
                  {[...Array(6)].map((_, i) => {
                    const angle = (i * 60) * (Math.PI / 180);
                    const length = 120;
                    // removed unused endX
                    // removed unused endY
                    
                    return (
                      <div 
                        key={`connection-${i}`}
                        className="absolute top-1/2 left-1/2 w-1 bg-gradient-to-r from-cyan-500/70 to-cyan-500/10 z-0"
                        style={{
                          height: `${length}px`,
                          transformOrigin: '0 0',
                          transform: `rotate(${angle}rad)`,
                        }}
                      >
                        {/* Animated particle */}
                        <div 
                          className="absolute w-2 h-2 rounded-full bg-cyan-400 z-20"
                          style={{
                            animation: `ecosystemParticle 3s linear infinite ${i * 0.5}s`,
                          }}
                        ></div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Ecosystem nodes */}
              {/* Use valid percentages and center nodes symmetrically around the hub */}
              {/* Top Left - Community */}
              <div className="absolute" style={{ top: '15%', left: '25%', transform: 'translate(-50%, -50%)' }}>
                <div className="relative">
                  <div className="absolute -inset-2 rounded-full bg-blue-500/20 blur-md animate-pulse-slow"></div>
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-blue-900/70 to-slate-900/70 flex items-center justify-center border border-blue-500/30"
                    style={{ boxShadow: '0 0 15px rgba(37, 99, 235, 0.3)' }}
                  >
                    <Users className="w-8 h-8 text-blue-400" />
                  </div>
                </div>
                <div className="mt-2 text-center text-sm text-blue-300 font-medium">Community</div>
              </div>

              {/* Top Right - Resources */}
              <div className="absolute" style={{ top: '15%', right: '25%', transform: 'translate(50%, -50%)' }}>
                <div className="relative">
                  <div className="absolute -inset-2 rounded-full bg-teal-500/20 blur-md animate-pulse-slow"></div>
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-teal-900/70 to-slate-900/70 flex items-center justify-center border border-teal-500/30"
                    style={{ boxShadow: '0 0 15px rgba(20, 184, 166, 0.3)' }}
                  >
                    <Gem className="w-8 h-8 text-teal-400" />
                  </div>
                </div>
                <div className="mt-2 text-center text-sm text-teal-300 font-medium">Resources</div>
              </div>

              {/* Bottom Left - Security */}
              <div className="absolute" style={{ bottom: '15%', left: '25%', transform: 'translate(-50%, 50%)' }}>
                <div className="relative">
                  <div className="absolute -inset-2 rounded-full bg-purple-500/20 blur-md animate-pulse-slow"></div>
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-purple-900/70 to-slate-900/70 flex items-center justify-center border border-purple-500/30"
                    style={{ boxShadow: '0 0 15px rgba(168, 85, 247, 0.3)' }}
                  >
                    <ShieldCheck className="w-8 h-8 text-purple-400" />
                  </div>
                </div>
                <div className="mt-2 text-center text-sm text-purple-300 font-medium">Security</div>
              </div>

              {/* Bottom Right - Market */}
              <div className="absolute" style={{ bottom: '15%', right: '25%', transform: 'translate(50%, 50%)' }}>
                <div className="relative">
                  <div className="absolute -inset-2 rounded-full bg-amber-500/20 blur-md animate-pulse-slow"></div>
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-amber-900/70 to-slate-900/70 flex items-center justify-center border border-amber-500/30"
                    style={{ boxShadow: '0 0 15px rgba(245, 158, 11, 0.3)' }}
                  >
                    <BarChart3 className="w-8 h-8 text-amber-400" />
                  </div>
                </div>
                <div className="mt-2 text-center text-sm text-amber-300 font-medium">Market</div>
              </div>
              
              {/* Floating bubbles */}
              {showParticles && [...Array(12)].map((_, i) => (
                <div 
                  key={`ecosystem-bubble-${i}`}
                  className="absolute rounded-full bg-gradient-to-br from-white/60 to-white/20"
                  style={{
                    width: `${Math.random() * 8 + 2}px`,
                    height: `${Math.random() * 8 + 2}px`,
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animation: `bubbleRiseSmall ${Math.random() * 10 + 5}s linear infinite ${Math.random() * 5}s`,
                    opacity: Math.random() * 0.5 + 0.2,
                  }}
                ></div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Enhanced Stats Section with Animation */}
      <section className="relative z-10 py-24 px-6">
        <div 
          className={`relative max-w-5xl mx-auto transition-all duration-1000 transform ${animationLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          style={{ transitionDelay: '200ms' }}
        >
          {/* Background elements with parallax effect */}
          <div 
            className="absolute inset-0 bg-slate-800/30 backdrop-blur-lg rounded-2xl"
            style={{
              transform: `translate(${parallaxOffset.x * 0.01}px, ${parallaxOffset.y * 0.01}px)`,
            }}
          ></div>
          <div 
            className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-teal-500/5 rounded-2xl"
            style={{
              transform: `translate(${parallaxOffset.x * 0.02}px, ${parallaxOffset.y * 0.02}px)`,
            }}
          ></div>
          
          {/* Animated bubbles background */}
          {showParticles && [...Array(8)].map((_, i) => (
            <div 
              key={`stat-bubble-${i}`}
              className="absolute rounded-full bg-gradient-to-br from-cyan-400/10 to-white/5"
              style={{
                width: `${Math.random() * 30 + 10}px`,
                height: `${Math.random() * 30 + 10}px`,
                left: `${Math.random() * 100}%`,
                bottom: '0',
                animation: `bubbleRiseSmall ${Math.random() * 15 + 8}s linear infinite ${Math.random() * 5}s`,
                opacity: Math.random() * 0.3 + 0.1,
              }}
            ></div>
          ))}
          
          {/* Section header with shimmering effect */}
          <div className="relative p-8 text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold relative inline-block mb-6">
              <span className="bg-gradient-to-br from-cyan-300 via-blue-300 to-teal-300 bg-clip-text text-transparent animate-shimmer">
                Explore the Underwater Economy
              </span>
              <div className="absolute -bottom-3 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
            </h2>
            <p className="text-slate-300 max-w-2xl mx-auto">
              Join thousands of explorers in this thriving blockchain-powered underwater ecosystem
            </p>
          </div>
          
          {/* Stats Grid with Enhanced Styling and Hover Effects */}
            <div className="relative grid grid-cols-2 md:grid-cols-4 gap-8 text-center px-8 pb-12">
              {/* Active Miners Stat */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all duration-500"></div>
                <div className="absolute inset-0 p-px rounded-lg overflow-hidden z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/30 via-transparent to-cyan-600/30 animate-rotate-gradient"></div>
                </div>
                <div className="relative py-8 px-4">
                  <div className="mb-4 mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-cyan-900/50 to-blue-900/50 flex items-center justify-center">
                    <Users className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div className="text-4xl font-extrabold mb-1">
                    <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">10K+</span>
                  </div>
                  <div className="text-slate-300 font-medium">Active Miners</div>
                </div>
              </div>
              {/* Resources Mined Stat */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all duration-500"></div>
                <div className="absolute inset-0 p-px rounded-lg overflow-hidden z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600/30 via-transparent to-blue-600/30 animate-rotate-gradient"></div>
                </div>
                <div className="relative py-8 px-4">
                  <div className="mb-4 mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-blue-900/50 to-indigo-900/50 flex items-center justify-center">
                    <Gem className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="text-4xl font-extrabold mb-1">
                    <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">50M+</span>
                  </div>
                  <div className="text-slate-300 font-medium">Resources Mined</div>
                </div>
              </div>
              {/* Submarines Stat */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all duration-500"></div>
                <div className="absolute inset-0 p-px rounded-lg overflow-hidden z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 bg-gradient-to-br from-teal-600/30 via-transparent to-teal-600/30 animate-rotate-gradient"></div>
                </div>
                <div className="relative py-8 px-4">
                  <div className="mb-4 mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-teal-900/50 to-emerald-900/50 flex items-center justify-center">
                    <Anchor className="w-6 h-6 text-teal-400" />
                  </div>
                  <div className="text-4xl font-extrabold mb-1">
                    <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">8K+</span>
                  </div>
                  <div className="text-slate-300 font-medium">Submarines Built</div>
                </div>
              </div>
              {/* Trading Volume */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all duration-500"></div>
                <div className="absolute inset-0 p-px rounded-lg overflow-hidden z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-600/30 via-transparent to-purple-600/30 animate-rotate-gradient"></div>
                </div>
                <div className="relative py-8 px-4">
                  <div className="mb-4 mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-purple-900/50 to-indigo-900/50 flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-purple-400" />
                  </div>
                  <div className="text-4xl font-extrabold mb-1">
                    <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">120K</span>
                  </div>
                  <div className="text-slate-300 font-medium">Daily Trades</div>
                </div>
              </div>
            </div>
          
          {/* Key Feature Highlights */}
          <div className="grid md:grid-cols-3 gap-8 px-8 py-12 relative">
            {/* Left illumination */}
            <div className="absolute -left-10 top-1/2 transform -translate-y-1/2 w-20 h-64 bg-cyan-500/10 rounded-full blur-3xl"></div>
            
            {/* Feature 1 - Blockchain Verification */}
            <div className="relative p-6 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/30 hover:border-cyan-500/20 transition-all duration-300 group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-900/70 to-blue-900/70 flex items-center justify-center mb-4">
                  <Lock className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">Blockchain Verified</h3>
                <p className="text-slate-300">All resources and submarines are secured on the blockchain with immutable proof of ownership.</p>
              </div>
            </div>
            
            {/* Feature 2 - Real Economics */}
            <div className="relative p-6 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/30 hover:border-blue-500/20 transition-all duration-300 group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-900/70 to-indigo-900/70 flex items-center justify-center mb-4">
                  <LineChart className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">Real Economics</h3>
                <p className="text-slate-300">Experience a player-driven economy with supply and demand mechanics that affect resource values.</p>
              </div>
            </div>
            
            {/* Feature 3 - Global Community */}
            <div className="relative p-6 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/30 hover:border-teal-500/20 transition-all duration-300 group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-teal-500/20 to-green-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-900/70 to-emerald-900/70 flex items-center justify-center mb-4">
                  <Globe2 className="w-6 h-6 text-teal-400" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">Global Community</h3>
                <p className="text-slate-300">Join miners from over 50 countries working together in guilds or competing for rare discoveries.</p>
              </div>
            </div>
            {/* Right illumination */}
            <div className="absolute -right-10 top-1/2 transform -translate-y-1/2 w-20 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
          </div>
        </div>
      </section>

      {/* Immersive Call to Action Section */}
  <section className="relative z-10 py-24 px-6 overflow-hidden">
  {/* ...existing code... */}
  </section>
        <div className="max-w-6xl mx-auto relative">
                                     {/* Background Elements */}
          <div className="absolute inset-0 opacity-70">
            {/* Dynamic waves */}
            <div 
              className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-blue-900/30 to-transparent"
              style={{
                transform: `translateY(${Math.sin(Date.now() * 0.001) * 5}px)`,
              }}
            ></div>
            
            {/* Light rays */}
            <div className="absolute top-0 left-1/4 w-1/2 h-full bg-gradient-to-b from-cyan-500/10 via-blue-500/5 to-transparent transform -rotate-45 blur-3xl"></div>
            <div className="absolute top-0 right-1/3 w-1/3 h-full bg-gradient-to-b from-blue-500/10 via-teal-500/5 to-transparent transform rotate-45 blur-3xl"></div>
          </div>
          
          {/* Floating bubbles for animation */}
          {showParticles && [...Array(12)].map((_, i) => (
            <div 
              key={`cta-bubble-${i}`}
              className="absolute rounded-full bg-gradient-to-br from-white/60 to-white/20"
              style={{
                width: `${Math.random() * 12 + 4}px`,
                height: `${Math.random() * 12 + 4}px`,
                left: `${Math.random() * 100}%`,
                bottom: '0',
                animation: `bubbleRiseSmall ${Math.random() * 15 + 6}s linear infinite ${Math.random() * 5}s`,
                opacity: Math.random() * 0.4 + 0.2,
              }}
            ></div>
          ))}
          
          <div 
            className={`text-center max-w-3xl mx-auto py-16 px-6 relative transition-all duration-1000 transform ${animationLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
            style={{ transitionDelay: '400ms' }}
          >
            <div className="mb-6">
              <Anchor className="w-16 h-16 text-cyan-400 mx-auto" />
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-cyan-300 via-blue-300 to-teal-300 bg-clip-text text-transparent">
              Ready to Explore the Depths?
            </h2>
            
            <p className="text-slate-300 text-xl mb-10 max-w-xl mx-auto">
              Join thousands of explorers in the most immersive underwater mining experience. 
              Create your account now and begin your deep sea adventure!
            </p>
            
            <div className="relative inline-block group">
              {/* Button glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse-slow"></div>
              
              <Button
                size="lg"
                onClick={handleSignUp}
                className="relative bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-10 py-6 text-lg font-semibold shadow-glow hover:shadow-glow-strong rounded-xl group overflow-hidden"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                <Radar className="w-6 h-6 mr-3 animate-spin-slow" />
                <span>Start Mining Now</span>
              </Button>
            </div>
          </div>
        </div>
      {/* Enhanced Footer */}
      <footer className="relative z-10 border-t border-slate-800/50 pt-16 pb-12 px-6 bg-slate-900/80">
        <div className="max-w-6xl mx-auto">
          {/* Footer Top Section */}
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center space-x-2 mb-4">
                <Anchor className="w-8 h-8 text-cyan-400" />
                <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  AbyssX
                </span>
              </div>
              <p className="text-slate-400 mb-6">
                The next-generation blockchain-powered deep sea mining adventure.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors duration-300">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors duration-300">
                  <DiscordIcon className="w-5 h-5" />
                </a>
              </div>
            </div>
            
            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors duration-300">Features</a>
                </li>
                <li>
                  <a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors duration-300">Leaderboard</a>
                </li>
                <li>
                  <a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors duration-300">Marketplace</a>
                </li>
                <li>
                  <a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors duration-300">Roadmap</a>
                </li>
              </ul>
            </div>
            
            {/* Resources */}
            <div>
              <h4 className="text-white font-semibold mb-4">Resources</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors duration-300">Documentation</a>
                </li>
                <li>
                  <a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors duration-300">Tutorials</a>
                </li>
                <li>
                  <a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors duration-300">FAQs</a>
                </li>
                <li>
                  <a href="#" className="text-slate-400 hover:text-cyan-400 transition-colors duration-300">Support</a>
                </li>
              </ul>
            </div>
            
            {/* Newsletter */}
            <div>
              <h4 className="text-white font-semibold mb-4">Stay Updated</h4>
              <p className="text-slate-400 mb-4">Subscribe to our newsletter for the latest updates and features.</p>
              <div className="flex">
                <input 
                  type="email" 
                  placeholder="Your email" 
                  className="bg-slate-800 text-slate-200 px-4 py-2 rounded-l-md border border-slate-700 focus:outline-none focus:border-cyan-500 w-full"
                />
                <Button className="rounded-l-none bg-cyan-500 hover:bg-cyan-600">
                  Subscribe
                </Button>
              </div>
            </div>
          </div>
          
          {/* Copyright */}
          <div className="pt-8 border-t border-slate-800 text-center">
            <p className="text-slate-400 text-sm">© 2025 AbyssX. Dive deep, mine smart, conquer the seas.</p>
          </div>
        </div>
      </footer>

    </div>
  )
}
