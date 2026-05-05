"use client";

import { useEffect, useState } from "react";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useReview } from "@/lib/review-store";
import { GhostButton } from "../ui";

const AUTO_RESET_MS = 25_000;
const CONFETTI_COLORS = ["#7c5cff", "#22d3ee", "#a78bfa", "#ec4899", "#f59e0b"];

type ConfettiPiece = {
  i: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
};

export function DoneState() {
  const email = useReview((s) => s.email);
  const reset = useReview((s) => s.reset);

  useEffect(() => {
    const t = setTimeout(reset, AUTO_RESET_MS);
    return () => clearTimeout(t);
  }, [reset]);

  return (
    <div className="flex flex-col items-center gap-5 px-6 py-12 text-center max-w-[420px] mx-auto">
      <motion.div
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 16 }}
        className="h-20 w-20 rounded-full bg-gradient-to-br from-[#22d3ee] to-[#7c5cff] grid place-items-center shadow-[0_12px_40px_-10px_rgba(124,92,255,0.7)]"
      >
        <CheckCircle2 size={40} className="text-white" />
      </motion.div>

      <Confetti />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-shimmer">
          Thanks so much!
        </h1>
        <p className="text-sm text-white/65 leading-relaxed">
          Your review is on its way to{" "}
          <span className="text-white/90 font-medium">{email}</span>. Watch for
          it in the next minute or two.
        </p>
      </div>

      <GhostButton onClick={reset}>Start over</GhostButton>

      <p className="text-[10px] text-white/35">
        This screen will reset automatically.
      </p>
    </div>
  );
}

function Confetti() {
  // Lazy useState initializer is the React-19-blessed way to do
  // one-shot random work without tripping the purity / set-in-effect
  // lints.
  const [pieces] = useState<ConfettiPiece[]>(() =>
    Array.from({ length: 18 }, (_, i) => ({
      i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 2 + Math.random() * 1.5,
      size: 6 + Math.random() * 6,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    })),
  );

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {pieces.map((p) => (
        <motion.span
          key={p.i}
          initial={{ y: -40, opacity: 0, rotate: 0 }}
          animate={{ y: "110vh", opacity: [0, 1, 1, 0], rotate: 540 }}
          transition={{ delay: p.delay, duration: p.duration, ease: "easeIn" }}
          className="absolute block rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.6,
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}
