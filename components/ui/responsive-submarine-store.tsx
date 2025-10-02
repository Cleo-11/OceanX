// Mobile-First Responsive Submarine Store Component
"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { animationVariants } from '@/lib/design-system/animations';
import { oceanColorSystem } from '@/lib/design-system/colors';
import { typographyVariants } from '@/lib/design-system/typography';
import { useIsMobile } from '@/hooks/use-mobile';
import { X, ShoppingCart, Zap, Shield, ArrowRight } from 'lucide-react';
import OceanButton from './ocean-button';

interface ResponsiveSubmarineStoreProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase: (submarineId: string, price: number) => void;
  userBalance: number;
  ownedSubmarines: string[];
}

const submarines = [
  {
    id: 'explorer',
    name: 'Explorer',
    tier: 1,
    price: 1000,
    stats: { speed: 3, storage: 100, mining: 2, depth: 500 },
    description: 'Perfect for beginners exploring shallow waters',
    special: 'Energy Efficient',
  },
  {
    id: 'harvester',
    name: 'Harvester',
    tier: 2,
    price: 5000,
    stats: { speed: 4, storage: 250, mining: 4, depth: 1000 },
    description: 'Advanced mining capabilities for serious collectors',
    special: 'Enhanced Mining Rate',
  },
  {
    id: 'leviathan',
    name: 'Leviathan',
    tier: 3,
    price: 15000,
    stats: { speed: 5, storage: 500, mining: 6, depth: 2000 },
    description: 'Elite submarine for deep-sea expeditions',
    special: 'Depth Master',
  },
];

function SubmarineCard({ 
  submarine, 
  isOwned, 
  canAfford, 
  onPurchase, 
  isMobile 
}: {
  submarine: typeof submarines[0];
  isOwned: boolean;
  canAfford: boolean;
  onPurchase: () => void;
  isMobile: boolean;
}) {
  return (
    <motion.div
      className={cn(
        "relative overflow-hidden border rounded-xl",
        "backdrop-blur-lg transition-all duration-300",
        isMobile ? "w-full" : "w-80",
        isOwned && "ring-2 ring-green-400/50",
        !isOwned && canAfford && "hover:scale-[1.02] cursor-pointer",
        !canAfford && "opacity-60"
      )}
      style={{
        background: `linear-gradient(135deg, ${oceanColorSystem.depth.deep}90 0%, ${oceanColorSystem.depth.abyss}95 100%)`,
        borderColor: isOwned ? oceanColorSystem.bio.teal : `${oceanColorSystem.bio.cyan}40`,
      }}
      variants={animationVariants.staggerItem}
      whileHover={!isOwned && canAfford ? { y: -4 } : {}}
      layout
    >
      {/* Tier Badge */}
      <div className="absolute top-3 right-3 z-10">
        <motion.div
          className="px-2 py-1 rounded-full text-xs font-bold"
          style={{
            background: `linear-gradient(135deg, ${oceanColorSystem.mineral.rare} 0%, #92400e 100%)`,
            color: 'white',
          }}
          whileHover={{ scale: 1.1, rotate: 5 }}
        >
          TIER {submarine.tier}
        </motion.div>
      </div>

      {/* Owned Indicator */}
      <AnimatePresence>
        {isOwned && (
          <motion.div
            className="absolute top-3 left-3 z-10 flex items-center space-x-1 px-2 py-1 rounded-full"
            style={{
              background: `linear-gradient(135deg, ${oceanColorSystem.bio.teal} 0%, #047857 100%)`,
              color: 'white',
            }}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
          >
            <Shield className="w-3 h-3" />
            <span className="text-xs font-bold">OWNED</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submarine Visual */}
      <div className="relative h-32 bg-gradient-to-b from-cyan-500/10 to-blue-600/20 flex items-center justify-center">
        <motion.div
          className="text-6xl"
          animate={{
            y: [0, -4, 0],
            rotate: [0, 1, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          🚁
        </motion.div>
        
        {/* Water Caustics Effect */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'url("/water-caustics.png")',
            backgroundSize: '200px 200px',
            animation: 'caustics-move 15s linear infinite',
          }}
        />
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Header */}
        <div>
          <h3 
            className="font-bold text-xl mb-1"
            style={{
              color: oceanColorSystem.bio.cyan,
              fontFamily: typographyVariants.h3.fontFamily,
            }}
          >
            {submarine.name}
          </h3>
          <p className="text-sm text-slate-300">{submarine.description}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Speed', value: submarine.stats.speed, icon: '⚡', max: 6 },
            { label: 'Storage', value: submarine.stats.storage, icon: '📦', max: 500 },
            { label: 'Mining', value: submarine.stats.mining, icon: '⛏️', max: 6 },
            { label: 'Depth', value: submarine.stats.depth, icon: '🌊', max: 2000 },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center space-x-2">
              <span className="text-sm">{stat.icon}</span>
              <div className="flex-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">{stat.label}</span>
                  <span className="text-cyan-300 font-mono">{stat.value}</span>
                </div>
                <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(stat.value / stat.max) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Special Ability */}
        <div 
          className="p-2 rounded-lg border text-xs"
          style={{
            background: `${oceanColorSystem.bio.purple}15`,
            borderColor: `${oceanColorSystem.bio.purple}30`,
            color: oceanColorSystem.bio.purple,
          }}
        >
          <div className="flex items-center space-x-1">
            <Zap className="w-3 h-3" />
            <span className="font-bold">SPECIAL:</span>
            <span>{submarine.special}</span>
          </div>
        </div>

        {/* Price and Action */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-600/30">
          <div>
            <div className="text-xs text-slate-400">Price</div>
            <div 
              className="font-bold text-lg"
              style={{ color: oceanColorSystem.mineral.rare }}
            >
              {submarine.price.toLocaleString()} OCX
            </div>
          </div>
          
          <OceanButton
            variant={isOwned ? 'secondary' : canAfford ? 'primary' : 'ghost'}
            size={isMobile ? 'sm' : 'md'}
            disabled={!canAfford || isOwned}
            onClick={onPurchase}
            icon={isOwned ? <Shield /> : <ShoppingCart />}
            glowEffect={!isOwned && canAfford}
          >
            {isOwned ? 'Owned' : canAfford ? 'Purchase' : 'Insufficient'}
          </OceanButton>
        </div>
      </div>
    </motion.div>
  );
}

export function ResponsiveSubmarineStore({
  isOpen,
  onClose,
  onPurchase,
  userBalance,
  ownedSubmarines,
}: ResponsiveSubmarineStoreProps) {
  const isMobile = useIsMobile();
  const [selectedTier, setSelectedTier] = useState<number | null>(null);

  const availableSubmarines = submarines.filter(sub => 
    selectedTier === null || sub.tier === selectedTier
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${oceanColorSystem.depth.abyss}95 0%, ${oceanColorSystem.depth.deep}90 100%)`,
        }}
        variants={animationVariants.modal}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* Water Caustics Background */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'url("/water-caustics.png")',
            backgroundSize: '400px 400px',
            animation: 'caustics-move 20s linear infinite',
          }}
        />

        {/* Content Container */}
        <div className={cn(
          "relative w-full h-full overflow-hidden",
          "flex flex-col",
          isMobile ? "p-4" : "p-8 max-w-6xl max-h-[90vh]"
        )}>
          {/* Header */}
          <motion.div
            className="flex items-center justify-between mb-6"
            variants={animationVariants.staggerItem}
          >
            <div>
              <h1 
                className="font-bold mb-2"
                style={{
                  fontSize: isMobile ? typographyVariants.h2.fontSize : typographyVariants.h1.fontSize,
                  fontFamily: typographyVariants.h1.fontFamily,
                  background: `linear-gradient(135deg, ${oceanColorSystem.bio.cyan} 0%, ${oceanColorSystem.bio.blue} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                SUBMARINE STORE
              </h1>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400">Balance:</span>
                  <span 
                    className="font-bold text-lg"
                    style={{ color: oceanColorSystem.mineral.rare }}
                  >
                    {userBalance.toLocaleString()} OCX
                  </span>
                </div>
              </div>
            </div>

            <OceanButton
              variant="ghost"
              size={isMobile ? "sm" : "md"}
              onClick={onClose}
              icon={<X />}
              className="!p-2"
            >
              Close
            </OceanButton>
          </motion.div>

          {/* Tier Filter */}
          <motion.div
            className="flex space-x-2 mb-6"
            variants={animationVariants.stagger}
          >
            <OceanButton
              variant={selectedTier === null ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setSelectedTier(null)}
            >
              All Tiers
            </OceanButton>
            {[1, 2, 3].map((tier) => (
              <OceanButton
                key={tier}
                variant={selectedTier === tier ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setSelectedTier(tier)}
              >
                Tier {tier}
              </OceanButton>
            ))}
          </motion.div>

          {/* Submarines Grid */}
          <motion.div
            className={cn(
              "flex-1 overflow-y-auto",
              isMobile ? "space-y-4" : "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6"
            )}
            variants={animationVariants.stagger}
            initial="hidden"
            animate="visible"
          >
            {availableSubmarines.map((submarine) => (
              <SubmarineCard
                key={submarine.id}
                submarine={submarine}
                isOwned={ownedSubmarines.includes(submarine.id)}
                canAfford={userBalance >= submarine.price}
                onPurchase={() => onPurchase(submarine.id, submarine.price)}
                isMobile={isMobile}
              />
            ))}
          </motion.div>

          {/* Mobile Navigation */}
          {isMobile && (
            <motion.div
              className="mt-4 flex justify-center"
              variants={animationVariants.staggerItem}
            >
              <OceanButton
                variant="secondary"
                onClick={onClose}
                icon={<ArrowRight />}
                iconPosition="right"
              >
                Continue Mining
              </OceanButton>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default ResponsiveSubmarineStore;