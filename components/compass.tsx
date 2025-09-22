import { motion } from "framer-motion";

interface CompassProps {
  heading: number; // radians
}

export function Compass({ heading }: CompassProps) {
  return (
    <div className="absolute left-1/2 top-2 z-30 flex w-40 -translate-x-1/2 flex-col items-center">
      <motion.div
        className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-900/60 to-slate-900/80 shadow-lg backdrop-blur-lg border-2 border-cyan-400/30"
        animate={{ rotate: (-heading * 180) / Math.PI }}
        transition={{ type: "spring", stiffness: 60 }}
      >
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-2 h-6 bg-cyan-400 rounded-b-full shadow-cyan-400/40 shadow-md" />
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-cyan-300 font-bold">N</span>
      </motion.div>
      <span className="mt-1 text-xs text-cyan-400/80 font-mono">COMPASS</span>
    </div>
  );
}
