"use client";

import { motion } from "framer-motion";
import { Play } from "lucide-react";
import clsx from "clsx";

type Props = {
  className?: string;
};

/**
 * Placeholder for marketing video / advertisement on the bottom half of the
 * kiosk. Swap the inner content for a real <video autoPlay loop> or
 * rotating banner when the asset pipeline is ready.
 */
export function MarketingSlot({ className }: Props) {
  return (
    <section
      className={clsx(
        "relative w-full overflow-hidden border-t border-white/10",
        "bg-gradient-to-br from-[#0f1530] via-[#1a1038] to-[#0b1628]",
        className,
      )}
    >
      <div className="absolute -top-24 -left-16 w-96 h-96 rounded-full bg-[#7c5cff] blur-3xl opacity-25" />
      <div className="absolute -bottom-24 -right-16 w-96 h-96 rounded-full bg-[#22d3ee] blur-3xl opacity-20" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative h-full w-full flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 24 }}
          className="flex flex-col items-center text-center gap-3 max-w-[720px]"
        >
          <div className="h-16 w-16 rounded-full grid place-items-center bg-white/5 ring-1 ring-white/10">
            <Play size={22} className="text-white/70" />
          </div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/45">
            Marketing video
          </p>
          <p className="text-2xl font-semibold tracking-tight text-white/85">
            Showcase your brand story here
          </p>
          <p className="text-sm text-white/50 max-w-[460px]">
            Swap this slot for a looping brand video, product trailer, or an
            animated ad. It plays while customers use the card builder above.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
