import { useState } from "react";

// Cartoon scuba diver SVG (simple, can be improved or replaced with a more detailed SVG)
const ScubaDiverSVG = ({ style = {} }) => (
  <svg
    width="120"
    height="120"
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={style}
  >
    {/* Body */}
    <ellipse cx="60" cy="80" rx="18" ry="28" fill="#2d3748" />
    {/* Head */}
    <circle cx="60" cy="45" r="14" fill="#fbbf24" stroke="#22223b" strokeWidth="2" />
    {/* Mask */}
    <ellipse cx="60" cy="45" rx="10" ry="8" fill="#60a5fa" stroke="#22223b" strokeWidth="2" />
    {/* Eyes */}
    <circle cx="56" cy="45" r="1.5" fill="#22223b" />
    <circle cx="64" cy="45" r="1.5" fill="#22223b" />
    {/* Mouth */}
    <ellipse cx="60" cy="51" rx="3" ry="1.2" fill="#22223b" />
    {/* Oxygen tank */}
    <rect x="72" y="70" width="8" height="22" rx="4" fill="#60a5fa" stroke="#22223b" strokeWidth="2" />
    {/* Fins */}
    <ellipse cx="50" cy="110" rx="6" ry="2.5" fill="#60a5fa" />
    <ellipse cx="70" cy="110" rx="6" ry="2.5" fill="#60a5fa" />
    {/* Bubbles */}
    <circle cx="80" cy="25" r="3" fill="#bae6fd" />
    <circle cx="90" cy="15" r="2" fill="#bae6fd" />
    <circle cx="100" cy="8" r="1.5" fill="#bae6fd" />
  </svg>
);

const guideSteps = [
  {
    message: "Welcome to AbyssX! 🌊",
    sub: "I'm your scuba guide. Ready to explore the ocean?",
  },
  {
    message: "Move your submarine",
    sub: "Use the controls or arrow keys to navigate the ocean floor.",
  },
  {
    message: "Mine resources",
    sub: "Click on resource nodes to mine valuable minerals.",
  },
  {
    message: "Upgrade your submarine",
    sub: "Visit the store to upgrade your sub for deeper exploration!",
  },
  {
    message: "Good luck!",
    sub: "Dive in and become the top ocean miner!",
  },
];

export function ScubaDiverGuide({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < guideSteps.length - 1) setStep(step + 1);
    else onFinish();
  };

  const handleSkip = () => onFinish();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative flex flex-col items-center">
        <div
          className="animate-bounce"
          style={{ transition: "transform 0.5s" }}
        >
          <ScubaDiverSVG />
        </div>
        <div className="relative mt-4">
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-64">
            <div className="rounded-2xl bg-white/90 border border-cyan-400 shadow-lg px-6 py-4 text-center">
              <div className="text-lg font-bold text-cyan-700">
                {guideSteps[step].message}
              </div>
              <div className="text-sm text-cyan-900 mt-1">
                {guideSteps[step].sub}
              </div>
              <div className="flex justify-center gap-4 mt-4">
                {step < guideSteps.length - 1 && (
                  <button
                    className="px-4 py-1 rounded bg-cyan-400 text-white font-semibold hover:bg-cyan-500 transition"
                    onClick={handleNext}
                  >
                    Next
                  </button>
                )}
                <button
                  className="px-4 py-1 rounded bg-slate-400 text-white font-semibold hover:bg-slate-500 transition"
                  onClick={handleSkip}
                >
                  {step < guideSteps.length - 1 ? "Skip" : "Close"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
