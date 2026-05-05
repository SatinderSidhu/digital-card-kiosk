"use client";

import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { REVIEW_QUESTIONS } from "@/lib/review-questions";

type Props = {
  questionIndex: number;
  /** 0–1 progress through the current question. */
  progress: number;
  /** Seconds left on the current question (display). */
  secondsLeft: number;
};

export function QuestionOverlay({
  questionIndex,
  progress,
  secondsLeft,
}: Props) {
  const current = REVIEW_QUESTIONS[questionIndex];

  // Pip stepper at the top — mirrors 01/02/03/… style from the kitlabs
  // reference. Each pip shows its 1-based index zero-padded.
  return (
    <>
      <div className="absolute top-3 left-0 right-0 flex justify-center px-4 z-10">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/10">
          {REVIEW_QUESTIONS.map((q, i) => {
            const state =
              i < questionIndex ? "done" : i === questionIndex ? "active" : "idle";
            return (
              <div key={q.id} className="flex items-center gap-1.5">
                <span
                  className={clsx(
                    "h-5 px-1.5 min-w-5 grid place-items-center rounded-full text-[9px] font-bold tabular-nums transition-colors",
                    state === "active"
                      ? "bg-gradient-to-r from-[#7c5cff] to-[#22d3ee] text-white"
                      : state === "done"
                        ? "bg-white/85 text-black"
                        : "bg-white/15 text-white/60",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                {i < REVIEW_QUESTIONS.length - 1 && (
                  <span
                    className={clsx(
                      "block h-px w-3 transition-colors",
                      i < questionIndex ? "bg-white/85" : "bg-white/20",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current?.id ?? questionIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35 }}
          className="absolute top-16 left-0 right-0 px-5 z-10"
        >
          <div className="flex items-start gap-3">
            <CountdownRing progress={progress} secondsLeft={secondsLeft} />
            <p className="flex-1 text-white text-xl sm:text-2xl font-bold leading-tight tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
              {current?.prompt}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

function CountdownRing({
  progress,
  secondsLeft,
}: {
  progress: number;
  secondsLeft: number;
}) {
  const size = 48;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * progress;

  return (
    <div
      className="relative shrink-0 grid place-items-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="absolute inset-0 -rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#22d3ee"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 200ms linear" }}
        />
      </svg>
      <span className="text-xs font-bold text-white tabular-nums">
        {Math.max(0, Math.ceil(secondsLeft))}
      </span>
    </div>
  );
}
