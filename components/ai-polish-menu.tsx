"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Wand2, X } from "lucide-react";
import clsx from "clsx";

export type PolishStyle = {
  outfit: "keep" | "suit" | "blazer" | "smart-casual";
  eyewear: "keep" | "add" | "remove";
  background: "neutral" | "soft-blue" | "warm" | "office-blur";
  mood: "balanced" | "friendly" | "confident" | "approachable";
};

const DEFAULT_STYLE: PolishStyle = {
  outfit: "keep",
  eyewear: "keep",
  background: "neutral",
  mood: "balanced",
};

type Option<T extends string> = { id: T; label: string };

const OUTFIT: Option<PolishStyle["outfit"]>[] = [
  { id: "keep", label: "Keep" },
  { id: "suit", label: "Suit" },
  { id: "blazer", label: "Blazer" },
  { id: "smart-casual", label: "Smart casual" },
];

const EYEWEAR: Option<PolishStyle["eyewear"]>[] = [
  { id: "keep", label: "Keep" },
  { id: "add", label: "Add glasses" },
  { id: "remove", label: "Remove glasses" },
];

const BACKGROUND: Option<PolishStyle["background"]>[] = [
  { id: "neutral", label: "Neutral grey" },
  { id: "soft-blue", label: "Soft blue" },
  { id: "warm", label: "Warm cream" },
  { id: "office-blur", label: "Blurred office" },
];

const MOOD: Option<PolishStyle["mood"]>[] = [
  { id: "balanced", label: "Balanced" },
  { id: "friendly", label: "Warm & friendly" },
  { id: "confident", label: "Bold & confident" },
  { id: "approachable", label: "Soft & approachable" },
];

type Props = {
  onApply: (style: PolishStyle) => void;
  onClose: () => void;
};

export function AiPolishMenu({ onApply, onClose }: Props) {
  const [style, setStyle] = useState<PolishStyle>(DEFAULT_STYLE);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 8 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className="absolute z-30 inset-0 flex items-center justify-center p-3"
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm rounded-2xl" />
      <div className="relative w-full max-w-[480px] rounded-2xl border border-white/15 bg-[#0b0f1a]/95 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white inline-flex items-center gap-2">
            <Wand2 size={16} className="text-[#22d3ee]" /> AI studio polish
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-white/55 hover:text-white p-1 -m-1"
          >
            <X size={16} />
          </button>
        </div>

        <Row
          label="Outfit"
          options={OUTFIT}
          value={style.outfit}
          onChange={(id) => setStyle((s) => ({ ...s, outfit: id }))}
        />
        <Row
          label="Eyewear"
          options={EYEWEAR}
          value={style.eyewear}
          onChange={(id) => setStyle((s) => ({ ...s, eyewear: id }))}
        />
        <Row
          label="Background"
          options={BACKGROUND}
          value={style.background}
          onChange={(id) => setStyle((s) => ({ ...s, background: id }))}
        />
        <Row
          label="Mood"
          options={MOOD}
          value={style.mood}
          onChange={(id) => setStyle((s) => ({ ...s, mood: id }))}
        />

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(style)}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#7c5cff] to-[#22d3ee] shadow-[0_4px_18px_-6px_rgba(124,92,255,0.6)] hover:scale-[1.03] active:scale-95 transition"
          >
            <Wand2 size={14} /> Apply polish
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Row<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-white/45">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = o.id === value;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              aria-pressed={active}
              className={clsx(
                "rounded-full px-3 py-1 text-[11px] font-medium border transition",
                active
                  ? "bg-white/15 border-[#22d3ee]/60 text-white"
                  : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
