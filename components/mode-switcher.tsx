"use client";

import { Laptop, Monitor, ChevronDown } from "lucide-react";
import { useWizard } from "@/lib/store";
import type { Mode } from "@/lib/store";

const MODES: { id: Mode; label: string; Icon: typeof Monitor }[] = [
  { id: "kiosk", label: "Kiosk", Icon: Monitor },
  { id: "compact", label: "Laptop", Icon: Laptop },
];

export function ModeSwitcher() {
  const mode = useWizard((s) => s.mode);
  const setMode = useWizard((s) => s.setMode);
  const current = MODES.find((m) => m.id === mode) ?? MODES[0];
  const Icon = current.Icon;

  return (
    <label className="relative inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 pl-2.5 pr-1.5 py-1 text-xs font-medium text-white/85 hover:bg-white/10 transition-colors cursor-pointer">
      <Icon size={14} className="text-white/70" />
      <span className="hidden sm:inline">{current.label}</span>
      <ChevronDown size={12} className="text-white/50" />
      <select
        aria-label="Display mode"
        value={mode}
        onChange={(e) => setMode(e.target.value as Mode)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      >
        {MODES.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  );
}
