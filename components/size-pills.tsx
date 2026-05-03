"use client";

import clsx from "clsx";

export type CardSize = "S" | "M" | "L";

type Props = {
  size: CardSize;
  onChange: (s: CardSize) => void;
};

export function SizePills({ size, onChange }: Props) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10">
      {(["S", "M", "L"] as CardSize[]).map((id) => {
        const active = id === size;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-pressed={active}
            className={clsx(
              "rounded-full w-8 h-7 text-xs font-semibold transition",
              active
                ? "bg-gradient-to-r from-[#7c5cff] to-[#22d3ee] text-white shadow-[0_4px_18px_-6px_rgba(124,92,255,0.6)]"
                : "text-white/70 hover:text-white hover:bg-white/5",
            )}
          >
            {id}
          </button>
        );
      })}
    </div>
  );
}
