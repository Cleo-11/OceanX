"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Anchor, Waves, Gem, Zap, Users, ArrowRight, Play,
  UserPlus, LogIn, Compass, ShipWheel, Sparkles,
  BarChart3, Radar, Wrench, Twitter
} from "lucide-react"

// Discord SVG Icon Component
function DiscordIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={props.width || 20}
      height={props.height || 20}
      {...props}
    >
      <path
        d="M20.317 4.369A19.791 19.791 0 0 0 16.885 3.2a.077.077 0 0 0-.082.038c-.357.63-.755 1.453-1.037 2.104a18.524 18.524 0 0 0-5.53 0 12.683 12.683 0 0 0-1.05-2.104.077.077 0 0 0-.082-.038A19.736 19.736 0 0 0 3.684 4.369a.07.07 0 0 0-.032.027C.533 9.09-.32 13.579.099 18.021a.082.082 0 0 0 .031.056c2.128 1.565 4.195 2.507 6.228 3.13a.077.077 0 0 0 .084-.027c.48-.66.908-1.356 1.273-2.084a.076.076 0 0 0-.041-.104c-.676-.256-1.32-.568-1.934-.936a.077.077 0 0 1-.008-.127c.13-.098.26-.2.384-.304a.074.074 0 0 1 .077-.01c4.06 1.855 8.447 1.855 12.47 0a.073.073 0 0 1 .078.009c.124.104.254.206.384.304a.077.077 0 0 1-.006.127 12.298 12.298 0 0 1-1.936.936.076.076 0 0 0-.04.105c.366.727.794 1.423 1.272 2.083a.076.076 0 0 0 .084.028c2.034-.623 4.102-1.565 6.23-3.13a.077.077 0 0 0 .03-.055c.5-5.177-.838-9.637-3.548-13.625a.061.061 0 0 0-.03-.028ZM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.175 1.094 2.157 2.418 0 1.334-.955 2.419-2.157 2.419Zm7.974 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.175 1.094 2.157 2.418 0 1.334-.947 2.419-2.157 2.419Z"
        fill="currentColor"
      />
    </svg>
  );
}
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function LandingPage() {
  const [isHovered, setIsHovered] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [showParticles, setShowParticles] = useState(false)
  const router = useRouter()
  
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    
    setTimeout(() => setShowParticles(true), 500)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogin = () => {
    router.push("/auth?mode=login")
  }

  const handleSignUp = () => {
    router.push("/auth?mode=signup")
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-950 to-slate-900 text-white overflow-hidden">
      {/* Advanced Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Ocean floor light rays */}
        <div className="absolute inset-0 opacity-20 bg-hexagon-pattern"></div>
        
        {/* Dynamic light sources */}
        <div className="absolute top-1/4 left-1/5 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/4 w-[40rem] h-[40rem] bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[50rem] h-[50rem] bg-teal-500/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
        
        {/* Water caustics effect overlay */}
        <div className="absolute inset-0 bg-cover bg-center opacity-10" 
             style={{backgroundImage: "url('/water-caustics.png')"}}></div>
        
        {/* Animated bubbles */}
        {showParticles && (
          <>
            {[...Array(15)].map((_, i) => (
              <div 
                key={i}
                className="resource-particle opacity-30 animate-float"
                style={{
                  width: `${Math.random() * 20 + 5}px`,
                  height: `${Math.random() * 20 + 5}px`,
                  left: `${Math.random() * 100}%`,
                  bottom: `-10px`,
                  animation: `bubbleRise ${Math.random() * 15 + 10}s linear infinite ${Math.random() * 10}s`,
                  opacity: Math.random() * 0.5 + 0.1,
                  background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.1))',
                }}
              />
            ))}
          </>
        )}
      </div>

      {/* Floating Navigation Header */}
      <header className={`fixed w-full top-0 left-0 z-30 transition-all duration-300 ${scrolled ? 'bg-slate-900/80 backdrop-blur-lg shadow-lg' : 'bg-transparent'}`}>
        <nav className="flex items-center justify-between max-w-7xl mx-auto p-6">
          <div className="flex items-center space-x-2 group">
            <div className="relative">
              <Anchor className="w-8 h-8 text-cyan-400 group-hover:animate-float" />
              <div className="absolute inset-0 rounded-full bg-cyan-400/20 animate-ping opacity-0 group-hover:opacity-100"></div>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent group-hover:from-cyan-300 group-hover:to-blue-300 transition-all duration-300">
              OceanX
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={handleLogin}
              className="text-slate-300 hover:text-white hover:bg-slate-800/50 backdrop-blur-sm transition-all duration-300"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Login
            </Button>
            <Button
              onClick={handleSignUp}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-glow hover:shadow-glow-strong transition-all duration-300"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Sign Up
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[100vh] px-6 text-center pt-20">
        <div className="max-w-5xl mx-auto">
          {/* Animated Badge */}
          <div className="relative inline-block">
            <Badge variant="secondary" className="mb-8 py-2 px-4 bg-slate-800/70 text-cyan-400 border-cyan-500/30 backdrop-blur-md animate-shimmer overflow-hidden">
              <Waves className="w-5 h-5 mr-2 animate-float" />
              <span className="relative z-10 font-medium tracking-wide">DEEP SEA MINING ADVENTURE</span>
            </Badge>
          </div>

          {/* Enhanced Main Heading with Animation */}
          <div className="relative mb-8">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold mb-6 bg-gradient-to-r from-cyan-300 via-blue-400 to-teal-300 bg-clip-text text-transparent leading-tight tracking-tighter relative z-10 animate-float">
              Dive Into the
              <br />
              <span className="relative">
                Ocean's Depths
                <span className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-cyan-300 via-blue-400 to-teal-300 rounded-full"></span>
              </span>
            </h1>
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-teal-500/20 rounded-full blur-3xl"></div>
          </div>

          {/* Enhanced subheading with more engaging typography */}
          <p className="text-xl md:text-2xl text-slate-200 mb-10 max-w-3xl mx-auto leading-relaxed font-light">
            Command your <span className="text-cyan-400 font-medium">submarine fleet</span>, mine precious resources from the 
            <span className="text-blue-400 font-medium"> ocean floor</span>, and compete with players worldwide in this 
            <span className="text-teal-400 font-medium"> blockchain-powered adventure</span>.
          </p>

          {/* Enhanced CTA buttons with better hover effects and animations */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <Button
              size="lg"
              onClick={handleSignUp}
              className="relative bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-10 py-6 text-lg font-semibold transform hover:scale-105 transition-all duration-300 shadow-glow hover:shadow-glow-strong rounded-xl group overflow-hidden"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              <Play className={`w-6 h-6 mr-3 ${isHovered ? "animate-pulse" : ""}`} />
              <span className="relative z-10">Start Your Journey</span>
              <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform duration-300" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={handleLogin}
              className="border-cyan-500/30 text-slate-200 hover:bg-slate-800/50 hover:text-white hover:border-cyan-500/60 px-10 py-6 text-lg shadow-inner-glow hover:shadow-glow bg-slate-900/40 backdrop-blur-sm rounded-xl transition-all duration-300"
            >
              <LogIn className="w-5 h-5 mr-3" />
              I Have an Account
            </Button>
          </div>

          {/* 3D Submarine Illustration */}
          <div className="relative my-12 max-w-6xl mx-auto">
            <div className="relative w-full h-64 md:h-80 lg:h-96">
              {/* This is a placeholder for a 3D submarine illustration */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-4/5 h-4/5 animate-float">
                  {/* Submarine Body */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3/4 h-1/3 bg-gradient-to-b from-cyan-600 to-cyan-800 rounded-full shadow-glow"></div>
                  {/* Submarine Tower */}
                  <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 w-1/5 h-1/3 bg-gradient-to-b from-cyan-700 to-cyan-900 rounded-t-lg"></div>
                  {/* Submarine Window */}
                  <div className="absolute top-1/2 left-1/3 transform -translate-y-1/2 w-12 h-12 bg-cyan-200/50 rounded-full shadow-glow animate-pulse"></div>
                  {/* Submarine Propeller */}
                  <div className="absolute top-1/2 right-[12%] transform -translate-y-1/2 w-8 h-8 animate-spin-slow">
                    <div className="w-full h-1 bg-cyan-400 rounded-full"></div>
                    <div className="w-full h-1 bg-cyan-400 rounded-full transform rotate-45"></div>
                    <div className="w-full h-1 bg-cyan-400 rounded-full transform rotate-90"></div>
                    <div className="w-full h-1 bg-cyan-400 rounded-full transform rotate-135"></div>
                  </div>
                  {/* Lights */}
                  <div className="absolute top-1/2 left-[10%] transform -translate-y-1/2 w-6 h-6 bg-yellow-300/50 rounded-full animate-glow"></div>
                </div>
              </div>
              
              {/* Particle Effects */}
              {showParticles && [...Array(8)].map((_, i) => (
                <div 
                  key={`particle-${i}`}
                  className="absolute w-2 h-2 rounded-full bg-cyan-300/50 animate-float"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDuration: `${3 + Math.random() * 4}s`,
                    animationDelay: `${Math.random() * 2}s`
                  }}
                />
              ))}
            </div>
          </div>

          {/* Enhanced Feature Cards */}
          <h2 className="text-3xl font-bold mb-8 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Explore the Ocean's Depths</h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="group bg-slate-800/40 border-slate-700/50 backdrop-blur-lg hover:bg-slate-800/60 transition-all duration-500 overflow-hidden shadow-lg hover:shadow-cyan-900/50 nft-border">
              <CardContent className="p-8 text-center relative">
                {/* Background glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                {/* Icon container with glow effect */}
                <div className="relative w-20 h-20 mx-auto mb-6 rounded-full bg-slate-700/50 flex items-center justify-center group-hover:shadow-glow transition-all duration-500">
                  <Gem className="w-10 h-10 text-cyan-400 group-hover:text-cyan-300 group-hover:scale-110 transition-all duration-500" />
                </div>
                
                <h3 className="text-2xl font-semibold mb-3 text-white group-hover:text-cyan-300 transition-colors duration-300">Mine Resources</h3>
                <p className="text-slate-300 group-hover:text-slate-200 transition-colors duration-300 leading-relaxed">
                  Extract valuable minerals from the ocean floor and build your underwater empire with blockchain-verified resources.
                </p>
              </CardContent>
            </Card>

            <Card className="group bg-slate-800/40 border-slate-700/50 backdrop-blur-lg hover:bg-slate-800/60 transition-all duration-500 overflow-hidden shadow-lg hover:shadow-blue-900/50 nft-border">
              <CardContent className="p-8 text-center relative">
                {/* Background glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                {/* Icon container with glow effect */}
                <div className="relative w-20 h-20 mx-auto mb-6 rounded-full bg-slate-700/50 flex items-center justify-center group-hover:shadow-glow transition-all duration-500">
                  <Wrench className="w-10 h-10 text-blue-400 group-hover:text-blue-300 group-hover:scale-110 transition-all duration-500" />
                </div>
                
                <h3 className="text-2xl font-semibold mb-3 text-white group-hover:text-blue-300 transition-colors duration-300">Upgrade Fleet</h3>
                <p className="text-slate-300 group-hover:text-slate-200 transition-colors duration-300 leading-relaxed">
                  Enhance your submarines with advanced technology and increase mining efficiency. Unlock new capabilities and depths.
                </p>
              </CardContent>
            </Card>

            <Card className="group bg-slate-800/40 border-slate-700/50 backdrop-blur-lg hover:bg-slate-800/60 transition-all duration-500 overflow-hidden shadow-lg hover:shadow-teal-900/50 nft-border">
              <CardContent className="p-8 text-center relative">
                {/* Background glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                {/* Icon container with glow effect */}
                <div className="relative w-20 h-20 mx-auto mb-6 rounded-full bg-slate-700/50 flex items-center justify-center group-hover:shadow-glow transition-all duration-500">
                  <BarChart3 className="w-10 h-10 text-teal-400 group-hover:text-teal-300 group-hover:scale-110 transition-all duration-500" />
                </div>
                
                <h3 className="text-2xl font-semibold mb-3 text-white group-hover:text-teal-300 transition-colors duration-300">Compete Globally</h3>
                <p className="text-slate-300 group-hover:text-slate-200 transition-colors duration-300 leading-relaxed">
                  Challenge players worldwide, climb the leaderboards, and earn exclusive rewards in this competitive underwater ecosystem.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Enhanced Stats Section with Animation */}
      <section className="relative z-10 py-24 px-6">
        <div className="relative max-w-5xl mx-auto">
          {/* Background elements */}
          <div className="absolute inset-0 bg-slate-800/30 backdrop-blur-lg rounded-2xl"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-teal-500/5 rounded-2xl"></div>
          
          {/* Section header */}
          <div className="relative p-8 text-center mb-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-300 via-blue-300 to-teal-300 bg-clip-text text-transparent mb-4">
              Explore the Underwater Economy
            </h2>
            <p className="text-slate-300 max-w-2xl mx-auto">
              Join thousands of explorers in this thriving blockchain-powered underwater ecosystem
            </p>
          </div>
          
          {/* Stats Grid with Enhanced Styling */}
          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-8 text-center px-8 pb-12">
            {/* Active Miners Stat */}
            <div className="group relative">
              <div className="absolute inset-0 bg-cyan-500/10 rounded-lg opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all duration-300"></div>
              <div className="relative py-6 px-4">
                <div className="text-4xl font-extrabold text-cyan-400 mb-3 flex items-center justify-center">
                  <Users className="w-6 h-6 mr-2 animate-pulse" />
                  <span className="group-hover:animate-shimmer">10K+</span>
                </div>
                <div className="text-slate-200 font-medium">Active Miners</div>
              </div>
            </div>
            
            {/* Resources Mined Stat */}
            <div className="group relative">
              <div className="absolute inset-0 bg-blue-500/10 rounded-lg opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all duration-300"></div>
              <div className="relative py-6 px-4">
                <div className="text-4xl font-extrabold text-blue-400 mb-3 flex items-center justify-center">
                  <Gem className="w-6 h-6 mr-2 animate-pulse" />
                  <span className="group-hover:animate-shimmer">50M+</span>
                </div>
                <div className="text-slate-200 font-medium">Resources Mined</div>
              </div>
            </div>
            
            {/* Submarines Deployed Stat */}
            <div className="group relative">
              <div className="absolute inset-0 bg-teal-500/10 rounded-lg opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all duration-300"></div>
              <div className="relative py-6 px-4">
                <div className="text-4xl font-extrabold text-teal-400 mb-3 flex items-center justify-center">
                  <ShipWheel className="w-6 h-6 mr-2 animate-pulse" />
                  <span className="group-hover:animate-shimmer">1000+</span>
                </div>
                <div className="text-slate-200 font-medium">Submarines Deployed</div>
              </div>
            </div>
            
            {/* Ocean Exploration Stat */}
            <div className="group relative">
              <div className="absolute inset-0 bg-green-500/10 rounded-lg opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all duration-300"></div>
              <div className="relative py-6 px-4">
                <div className="text-4xl font-extrabold text-green-400 mb-3 flex items-center justify-center">
                  <Compass className="w-6 h-6 mr-2 animate-pulse" />
                  <span className="group-hover:animate-shimmer">24/7</span>
                </div>
                <div className="text-slate-200 font-medium">Ocean Exploration</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="relative z-10 py-24 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center relative">
          {/* Background elements */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
          </div>
          
          {/* CTA Content */}
          <div className="relative bg-slate-800/40 backdrop-blur-xl p-12 rounded-2xl border border-slate-700/50 shadow-glow">
            <Sparkles className="w-12 h-12 mx-auto mb-6 text-yellow-400 animate-pulse" />
            
            <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
              Ready to Explore the Depths?
            </h2>
            
            <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
              Join thousands of explorers in the most immersive underwater mining experience. 
              Create your account now and begin your deep sea adventure!
            </p>
            
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
      </section>

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
                  OceanX
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
            <p className="text-slate-400 text-sm">© 2025 OceanX. Dive deep, mine smart, conquer the seas.</p>
          </div>
        </div>
      </footer>

    </div>
  )
}
