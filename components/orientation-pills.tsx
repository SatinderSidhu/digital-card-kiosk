"use client";

import { Rows3, Columns3 } from "lucide-react";
import clsx from "clsx";
import type { Orientation, TemplateId } from "@/lib/types";

// Experimental: lets the user pick an orientation at step 1, before
// the photo / details / template steps complete. Pills write through
// to the wizard's `template` field so step 3 starts on their pick.
//
// Each orientation maps to one default template — the first of that
// kind in the registry. The user can still fine-tune in step 3.
const DEFAULT_TEMPLATE_FOR: Record<Orientation, TemplateId> = {
  landscape: "aurora",
  portrait: "neon",
};

const LANDSCAPE_TEMPLATES: TemplateId[] = ["aurora", "mono", "sunset"];

type Props = {
  template: TemplateId | null;
  onChange: (id: TemplateId) => void;
};

export function OrientationPills({ template, onChange }: Props) {
  const current: Orientation =
    template && LANDSCAPE_TEMPLATES.includes(template) ? "landscape" : "portrait";

  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10">
      <Pill
        active={current === "landscape"}
        onClick={() => onChange(DEFAULT_TEMPLATE_FOR.landscape)}
        icon={<Rows3 size={14} />}
        label="Landscape"
      />
      <Pill
        active={current === "portrait"}
        onClick={() => onChange(DEFAULT_TEMPLATE_FOR.portrait)}
        icon={<Columns3 size={14} />}
        label="Portrait"
      />
    </div>
  );
}

function Pill({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
        active
          ? "bg-gradient-to-r from-[#7c5cff] to-[#22d3ee] text-white shadow-[0_4px_18px_-6px_rgba(124,92,255,0.6)]"
          : "text-white/70 hover:text-white hover:bg-white/5",
      )}
    >
      {icon} {label}
    </button>
  );
}
