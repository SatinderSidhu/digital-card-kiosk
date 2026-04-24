"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import clsx from "clsx";
import type { ReactNode } from "react";

export function PrimaryButton({
  children,
  className,
  disabled,
  ...rest
}: HTMLMotionProps<"button"> & { children: ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      disabled={disabled}
      className={clsx(
        "relative inline-flex items-center justify-center gap-2 rounded-full",
        "px-7 py-4 font-semibold text-white",
        "bg-gradient-to-r from-[#7c5cff] via-[#8b5cf6] to-[#22d3ee]",
        "shadow-[0_12px_40px_-10px_rgba(124,92,255,0.7)]",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function GhostButton({
  children,
  className,
  ...rest
}: HTMLMotionProps<"button"> & { children: ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.02 }}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-full",
        "px-6 py-3 font-medium text-white/80",
        "bg-white/5 border border-white/10 hover:bg-white/10",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="relative flex p-1 rounded-full bg-white/5 border border-white/10">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={clsx(
              "relative flex-1 py-2.5 px-4 rounded-full text-sm font-medium transition-colors",
              active ? "text-white" : "text-white/60 hover:text-white/80",
            )}
          >
            {active && (
              <motion.span
                layoutId="segmented-active"
                className="absolute inset-0 rounded-full bg-gradient-to-r from-[#7c5cff] to-[#22d3ee]"
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-2 justify-center">
              {o.icon}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wider text-white/50 mb-1.5">
        {label}
      </span>
      {children}
      {hint && <span className="block mt-1 text-xs text-white/40">{hint}</span>}
    </label>
  );
}

export function TextInput({
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3",
        "text-white placeholder-white/30",
        "focus:border-[#7c5cff] focus:bg-white/10 transition-colors",
        className,
      )}
      {...rest}
    />
  );
}

export function StepShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1 min-h-0 px-6 pb-6 pt-2">
      <div className="mb-5">
        <h1 className="text-3xl font-bold tracking-tight text-shimmer">{title}</h1>
        {subtitle && <p className="mt-1 text-white/55">{subtitle}</p>}
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      {footer && <div className="pt-5">{footer}</div>}
    </div>
  );
}
