"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useReview } from "@/lib/review-store";
import { IntroForm } from "@/components/reviews/intro-form";
import { Recorder } from "@/components/reviews/recorder";
import { Playback } from "@/components/reviews/playback";
import { DoneState } from "@/components/reviews/done-state";

export default function ReviewsPage() {
  const phase = useReview((s) => s.phase);
  const uploadError = useReview((s) => s.uploadError);
  const ensureSession = useReview((s) => s.ensureSession);
  const initCamera = useReview((s) => s.initCamera);

  useEffect(() => {
    ensureSession();
    initCamera();
  }, [ensureSession, initCamera]);

  return (
    <main className="w-full min-h-dvh flex flex-col">
      <header className="flex-none flex items-center justify-between gap-3 px-5 py-2.5 backdrop-blur-md bg-[color:var(--background)]/60 border-b border-white/5">
        <Link
          href="/"
          className="flex items-center gap-2 min-w-0 text-white/70 hover:text-white transition-colors"
        >
          <div className="h-7 w-7 shrink-0 rounded-lg bg-gradient-to-br from-[#7c5cff] to-[#22d3ee] grid place-items-center text-xs font-black text-white">
            ◆
          </div>
          <span className="text-sm font-semibold tracking-tight truncate">
            Video Reviews
          </span>
        </Link>
      </header>

      <div className="flex-1 min-h-0 flex flex-col w-full">
        {uploadError && phase === "playback" && (
          <div className="mx-4 mt-3 rounded-xl bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs text-red-200">
            {uploadError}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex-1 min-h-0 flex flex-col"
          >
            {phase === "intro" && <IntroForm />}
            {phase === "recording" && <Recorder />}
            {phase === "playback" && <Playback />}
            {phase === "done" && <DoneState />}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
