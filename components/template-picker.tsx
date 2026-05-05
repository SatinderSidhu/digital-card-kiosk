"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, RotateCcw } from "lucide-react";
import clsx from "clsx";
import {
  FACTORY_DEFAULT_TEMPLATE,
  PAGE_TEMPLATES,
  type TemplateId,
} from "@/lib/types";
import { TEMPLATES } from "./templates/card-templates";

type Props = {
  template: TemplateId | null;
  onChange: (id: TemplateId) => void;
};

export function TemplatePicker({ template, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click — same pattern as CameraPicker.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // When the user hasn't explicitly picked yet (`template === null`), the
  // live preview falls back to the factory default — surface that as the
  // "current" pick in the trigger so the label matches what's on screen.
  const effective: TemplateId = template ?? FACTORY_DEFAULT_TEMPLATE;
  const current = TEMPLATES.find((t) => t.id === effective);
  const showReset = effective !== FACTORY_DEFAULT_TEMPLATE;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/85 hover:bg-white/10 transition-colors"
      >
        <span className="text-white/45">Style</span>
        <span>{current?.name}</span>
        <ChevronDown
          size={12}
          className={clsx("transition-transform", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-30 w-72 rounded-2xl glass p-2 shadow-2xl"
          >
            <div className="grid grid-cols-2 gap-1">
              {PAGE_TEMPLATES.map((id) => {
                const m = TEMPLATES.find((t) => t.id === id);
                if (!m) return null;
                const active = id === effective;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      onChange(id);
                      setOpen(false);
                    }}
                    aria-pressed={active}
                    className={clsx(
                      "flex items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                      active ? "bg-white/10" : "hover:bg-white/5",
                    )}
                  >
                    <span className="w-3 h-3 rounded-full border border-white/30 grid place-items-center mt-0.5 shrink-0">
                      {active && <Check size={9} className="text-[#22d3ee]" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-white truncate">
                        {m.name}
                      </span>
                      <span className="block text-[10px] text-white/45 truncate">
                        {m.orientation === "landscape" ? "Horizontal" : "Vertical"}{" "}
                        · {m.mood}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {showReset && (
              <button
                onClick={() => {
                  onChange(FACTORY_DEFAULT_TEMPLATE);
                  setOpen(false);
                }}
                className="mt-1.5 w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-white/55 hover:text-white hover:bg-white/5 transition-colors"
              >
                <RotateCcw size={11} /> Reset to default
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
