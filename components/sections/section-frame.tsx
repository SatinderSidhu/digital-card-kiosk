"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import clsx from "clsx";
import type { ReactNode } from "react";

type Props = {
  index: number;
  title: string;
  subtitle: string;
  state: "idle" | "active" | "done";
  children: ReactNode;
  innerRef?: React.RefObject<HTMLElement | null>;
};

export function SectionFrame({ index, title, subtitle, state, children, innerRef }: Props) {
  return (
    <motion.section
      ref={innerRef as React.RefObject<HTMLElement>}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.2 }}
      transition={{ type: "spring", stiffness: 200, damping: 26 }}
      className={clsx(
        "relative flex flex-col min-h-0 flex-1 transition-all",
        state === "idle" && "opacity-55",
      )}
    >
      <div className="flex-none flex items-start gap-3 mb-3">
        <motion.div
          layout
          animate={{ scale: state === "active" ? 1.06 : 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className={clsx(
            "h-8 w-8 shrink-0 rounded-full grid place-items-center font-bold text-sm border transition-colors",
            state === "done" &&
              "bg-gradient-to-br from-[#7c5cff] to-[#22d3ee] border-transparent text-white",
            state === "active" && "bg-white/10 border-white/30 text-white",
            state === "idle" && "bg-white/[0.04] border-white/10 text-white/50",
          )}
          style={
            state === "active"
              ? { animation: "pulse-ring 2.4s ease-out infinite" }
              : undefined
          }
        >
          {state === "done" ? <Check size={14} /> : index}
        </motion.div>
        <div className="min-w-0">
          <h2
            className={clsx(
              "text-lg font-bold leading-tight",
              state === "active" ? "text-shimmer" : "text-white",
            )}
          >
            {title}
          </h2>
          <p className="text-xs text-white/55 leading-tight">{subtitle}</p>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </motion.section>
  );
}
