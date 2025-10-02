// Enhanced Player HUD with Advanced Animations and Better UX
"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { animationVariants, effectVariants } from '@/lib/design-system/animations';
import { oceanColorSystem } from '@/lib/design-system/colors';
import { typographyVariants } from '@/lib/design-system/typography';
import { getResourceColor } from '@/lib/resource-utils';
import type { PlayerStats } from '@/lib/types';
import { getSubmarineByTier } from '@/lib/submarine-tiers';
import { Battery, Zap, AlertTriangle, TrendingUp } from 'lucide-react';

interface EnhancedPlayerHUDProps {
  stats: PlayerStats;
  tier: number;
  className?: string;
}

interface StatBarProps {
  label: string;
  value: number;
  maxValue: number;
  color?: string;
  gradient?: string;
  pulse?: boolean;
  icon?: React.ReactNode;
  formatValue?: (value: number) => string;
  showPercentage?: boolean;
}

function EnhancedStatBar({
  label,
  value,
  maxValue,
  color = oceanColorSystem.bio.cyan,
  gradient,
  pulse = false,
  icon,
  formatValue = (v) => v.toString(),
  showPercentage = true,
}: StatBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / maxValue) * 100));
  const isLow = percentage < 25;
  const isCritical = percentage < 10;

  return (
    <motion.div
      className="space-y-1"
      variants={animationVariants.staggerItem}
      whileHover={{ scale: 1.02 }}
    >
      {/* Label and Value */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1">
          {icon && (
            <motion.span
              className={cn(
                "w-3 h-3 text-current",
                isCritical && "text-red-400",
                isLow && "text-orange-400"
              )}
              animate={isCritical ? { rotate: [0, 10, -10, 0] } : {}}
              transition={{ duration: 0.5, repeat: isCritical ? Infinity : 0 }}
            >
              {icon}
            </motion.span>
          )}
          <span
            className={cn(
              "text-xs font-medium tracking-wider uppercase",
              isCritical && "text-red-400",
              isLow && "text-orange-400"
            )}
            style={{
              color: !isLow && !isCritical ? color : undefined,
              fontFamily: typographyVariants.stats.fontFamily,
              fontSize: typographyVariants.stats.fontSize,
              letterSpacing: typographyVariants.stats.letterSpacing,
            }}
          >
            {label}
          </span>
        </div>
        <span
          className="text-xs font-mono tabular-nums"
          style={{
            color: isCritical ? oceanColorSystem.semantic.error : 
                   isLow ? oceanColorSystem.semantic.warning : color,
          }}
        >
          {formatValue(value)}{maxValue !== Infinity && `/${formatValue(maxValue)}`}
          {showPercentage && ` (${percentage.toFixed(0)}%)`}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        {/* Background */}
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{
            backgroundColor: `${color}20`,
            border: `1px solid ${color}30`,
          }}
        >
          {/* Fill */}
          <motion.div
            className="h-full rounded-full relative overflow-hidden"
            style={{
              background: gradient || `linear-gradient(90deg, ${color}, ${color}80)`,
            }}
            variants={animationVariants.progressBar}
            initial="empty"
            animate="filled"
            custom={percentage}
          >
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </motion.div>
        </div>

        {/* Pulse effect for critical values */}
        <AnimatePresence>
          {pulse && isCritical && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                backgroundColor: oceanColorSystem.semantic.error,
                opacity: 0.3,
              }}
              variants={effectVariants.glowPulse}
              initial="initial"
              animate="animate"
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

interface ResourceBarProps {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  icon?: React.ReactNode;
}

function ResourceBar({ label, value, maxValue, color, icon }: ResourceBarProps) {
  return (
    <EnhancedStatBar
      label={label}
      value={value}
      maxValue={maxValue}
      color={color}
      gradient={`linear-gradient(90deg, ${color}, ${color}80)`}
      icon={icon}
      formatValue={(v) => v.toLocaleString()}
    />
  );
}

export function EnhancedPlayerHUD({ stats, tier, className }: EnhancedPlayerHUDProps) {
  const submarineData = getSubmarineByTier(tier);
  const energyPercentage = (stats.energy / submarineData.baseStats.energy) * 100;
  const isEnergyLow = energyPercentage < 25;
  const isEnergyCritical = energyPercentage < 10;

  return (
    <motion.div
      className={cn(
        "absolute left-4 top-4 z-20 min-w-[280px]",
        "rounded-2xl backdrop-blur-lg border",
        "shadow-2xl overflow-hidden",
        className
      )}
      style={{
        background: `linear-gradient(135deg, ${oceanColorSystem.depth.abyss}95 0%, ${oceanColorSystem.depth.deep}80 100%)`,
        borderColor: `${oceanColorSystem.bio.cyan}40`,
        boxShadow: `0 8px 32px ${oceanColorSystem.depth.abyss}80, 0 0 0 1px ${oceanColorSystem.bio.cyan}20`,
      }}
      variants={animationVariants.hud}
      initial="hidden"
      animate="visible"
      layoutId="player-hud"
    >
      {/* Header */}
      <div className="p-4 border-b border-cyan-400/20">
        <div className="flex items-center justify-between">
          <motion.h2
            className="font-bold text-cyan-400 drop-shadow tracking-wide"
            style={{
              fontSize: typographyVariants.h3.fontSize,
              fontFamily: typographyVariants.h3.fontFamily,
            }}
            variants={effectVariants.glowPulse}
            animate={isEnergyCritical ? "animate" : "initial"}
          >
            SUBMARINE STATUS
          </motion.h2>
          <motion.div
            className="px-3 py-1 rounded-full text-xs font-bold"
            style={{
              background: `linear-gradient(135deg, ${oceanColorSystem.tech.hull} 0%, ${oceanColorSystem.depth.mid} 100%)`,
              color: oceanColorSystem.bio.cyan,
              border: `1px solid ${oceanColorSystem.bio.cyan}40`,
            }}
            whileHover={{ scale: 1.05, rotate: 1 }}
            whileTap={{ scale: 0.95, rotate: -1 }}
          >
            TIER {tier}: {submarineData.name}
          </motion.div>
        </div>
      </div>

      {/* Main Stats */}
      <motion.div
        className="p-4 space-y-4"
        variants={animationVariants.stagger}
        initial="hidden"
        animate="visible"
      >
        {/* Energy Bar with Special Attention */}
        <motion.div
          className={cn(
            "p-3 rounded-lg border",
            isEnergyCritical && "bg-red-500/10 border-red-500/30",
            isEnergyLow && !isEnergyCritical && "bg-orange-500/10 border-orange-500/30",
            !isEnergyLow && "bg-cyan-500/5 border-cyan-500/20"
          )}
          animate={isEnergyCritical ? { scale: [1, 1.02, 1] } : {}}
          transition={{ duration: 1, repeat: isEnergyCritical ? Infinity : 0 }}
        >
          <EnhancedStatBar
            label="ENERGY"
            value={stats.energy}
            maxValue={submarineData.baseStats.energy}
            color={
              isEnergyCritical ? oceanColorSystem.semantic.error :
              isEnergyLow ? oceanColorSystem.semantic.warning :
              oceanColorSystem.tech.energy
            }
            gradient={
              isEnergyCritical ? `linear-gradient(90deg, ${oceanColorSystem.semantic.error}, #7f1d1d)` :
              isEnergyLow ? `linear-gradient(90deg, ${oceanColorSystem.semantic.warning}, #92400e)` :
              `linear-gradient(90deg, ${oceanColorSystem.tech.energy}, #ca8a04)`
            }
            pulse={isEnergyCritical}
            icon={<Battery />}
          />
        </motion.div>

        {/* Cargo Section */}
        <div className="space-y-3">
          <motion.h3
            className="text-sm font-bold text-cyan-400 flex items-center space-x-2 border-b border-cyan-400/20 pb-2"
            style={{
              fontFamily: typographyVariants.hud.fontFamily,
              letterSpacing: typographyVariants.hud.letterSpacing,
            }}
            variants={animationVariants.staggerItem}
          >
            <TrendingUp className="w-4 h-4" />
            <span>CARGO MANIFEST</span>
          </motion.h3>
          <motion.div
            className="grid grid-cols-2 gap-3"
            variants={animationVariants.stagger}
          >
            <ResourceBar
              label="NICKEL"
              value={stats.capacity.nickel}
              maxValue={stats.maxCapacity.nickel}
              color={getResourceColor('nickel')}
            />
            <ResourceBar
              label="COBALT"
              value={stats.capacity.cobalt}
              maxValue={stats.maxCapacity.cobalt}
              color={getResourceColor('cobalt')}
            />
            <ResourceBar
              label="COPPER"
              value={stats.capacity.copper}
              maxValue={stats.maxCapacity.copper}
              color={getResourceColor('copper')}
            />
            <ResourceBar
              label="MANGANESE"
              value={stats.capacity.manganese}
              maxValue={stats.maxCapacity.manganese}
              color={getResourceColor('manganese')}
            />
          </motion.div>
        </div>

        {/* Technical Readouts */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-cyan-400/20">
          {[
            { label: 'DEPTH', value: `${stats.depth}m`, icon: '⬇️' },
            { label: 'SPEED', value: `x${stats.speed.toFixed(1)}`, icon: '🚀' },
            { label: 'MINING', value: `x${stats.miningRate.toFixed(1)}`, icon: '⛏️' },
          ].map((item) => (
            <motion.div
              key={item.label}
              className="text-center p-2 rounded-lg bg-slate-800/30 border border-slate-600/30"
              variants={animationVariants.staggerItem}
              whileHover={{ scale: 1.05, y: -2 }}
            >
              <div className="text-lg mb-1">{item.icon}</div>
              <div
                className="text-xs font-medium text-slate-300 mb-1"
                style={{
                  fontFamily: typographyVariants.stats.fontFamily,
                  letterSpacing: typographyVariants.stats.letterSpacing,
                }}
              >
                {item.label}
              </div>
              <div
                className="font-mono text-sm text-cyan-400 font-bold"
                style={{ fontFamily: typographyVariants.hud.fontFamily }}
              >
                {item.value}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Special Ability */}
        <AnimatePresence>
          {submarineData.specialAbility && (
            <motion.div
              className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/10"
              variants={animationVariants.staggerItem}
              whileHover={{ scale: 1.02 }}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="flex items-center space-x-2 mb-1">
                <Zap className="w-4 h-4 text-purple-400" />
                <span
                  className="text-xs font-bold text-purple-400 uppercase tracking-wider"
                  style={{ fontFamily: typographyVariants.stats.fontFamily }}
                >
                  SPECIAL ABILITY
                </span>
              </div>
              <p className="text-xs text-purple-300">{submarineData.specialAbility}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Critical Alerts */}
      <AnimatePresence>
        {isEnergyCritical && (
          <motion.div
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
            variants={effectVariants.glowPulse}
            initial="initial"
            animate="animate"
            exit={{ opacity: 0, scale: 0 }}
          >
            <AlertTriangle className="w-3 h-3 text-white" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default EnhancedPlayerHUD;