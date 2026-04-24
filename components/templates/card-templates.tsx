"use client";

import { QRCodeSVG } from "qrcode.react";
import { Phone, Mail, Globe, Building2 } from "lucide-react";
import clsx from "clsx";
import type { ReactNode } from "react";
import type { CardDetails, Orientation, TemplateId } from "@/lib/types";
import { TEMPLATE_ORIENTATION } from "@/lib/types";

export type TemplateProps = {
  details: CardDetails;
  photoDataUrl: string | null;
  qrValue: string;
  /** Optional override for the photo slot — e.g. a live Webcam element. */
  avatarNode?: ReactNode;
  className?: string;
};

export function TemplateCard({
  template,
  ...props
}: TemplateProps & { template: TemplateId }) {
  if (template === "aurora") return <AuroraTemplate {...props} />;
  if (template === "mono") return <MonoTemplate {...props} />;
  if (template === "sunset") return <SunsetTemplate {...props} />;
  if (template === "neon") return <NeonTemplate {...props} />;
  if (template === "forest") return <ForestTemplate {...props} />;
  return <NoirTemplate {...props} />;
}

export type TemplateMeta = {
  id: TemplateId;
  name: string;
  tagline: string;
  orientation: Orientation;
  mood: string;
};

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "aurora",
    name: "Aurora",
    tagline: "Cool gradient, professional",
    orientation: TEMPLATE_ORIENTATION.aurora,
    mood: "Professional",
  },
  {
    id: "mono",
    name: "Mono",
    tagline: "Clean, minimal, corporate",
    orientation: TEMPLATE_ORIENTATION.mono,
    mood: "Minimal",
  },
  {
    id: "sunset",
    name: "Sunset",
    tagline: "Warm, creative, friendly",
    orientation: TEMPLATE_ORIENTATION.sunset,
    mood: "Creative",
  },
  {
    id: "neon",
    name: "Neon",
    tagline: "Bold, playful, glowing",
    orientation: TEMPLATE_ORIENTATION.neon,
    mood: "Playful",
  },
  {
    id: "forest",
    name: "Forest",
    tagline: "Grounded, natural, calm",
    orientation: TEMPLATE_ORIENTATION.forest,
    mood: "Nature",
  },
  {
    id: "noir",
    name: "Noir",
    tagline: "Luxury, executive, timeless",
    orientation: TEMPLATE_ORIENTATION.noir,
    mood: "Luxury",
  },
];

/* ─────────────────────────────────────────────────────────────── */
/*                          LANDSCAPE                              */
/* ─────────────────────────────────────────────────────────────── */

/* ───────── Aurora — cool blue/purple gradient ───────── */
function AuroraTemplate({
  details,
  photoDataUrl,
  qrValue,
  avatarNode,
  className,
}: TemplateProps) {
  return (
    <div
      className={clsx(
        "relative aspect-[7/4] rounded-3xl overflow-hidden",
        "bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#0c4a6e]",
        className,
      )}
      style={{ containerType: "inline-size" }}
    >
      <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-[#8b5cf6] blur-3xl opacity-50" />
      <div className="absolute -bottom-24 -right-14 w-72 h-72 rounded-full bg-[#22d3ee] blur-3xl opacity-40" />

      <div className="relative h-full w-full flex items-stretch text-white p-[3%] gap-[3%]">
        <div className="h-full w-[30%] flex items-stretch">
          <PhotoFrame
            shape="rect"
            src={photoDataUrl}
            className="w-full h-full ring-2 ring-white/50"
          >
            {avatarNode}
          </PhotoFrame>
        </div>

        <div className="flex-1 min-w-0 flex flex-col py-[1%]">
          <div>
            <p className="text-[clamp(24px,5.6cqw,72px)] font-bold leading-[1.05] tracking-tight truncate">
              {details.fullName || "Your Name"}
            </p>
            <p className="mt-[1%] text-[clamp(16px,3.4cqw,40px)] font-medium text-white leading-tight truncate">
              {details.title || "Title"}
            </p>
            <p className="text-[clamp(14px,3.2cqw,36px)] text-white/65 leading-tight truncate">
              {details.company || "Company"}
            </p>
          </div>

          <div className="my-[3.5%] h-[2px] bg-white/20 rounded-full" />

          <div className="space-y-[3%] text-[clamp(14px,3cqw,30px)] font-medium">
            <Row icon={<Phone size={24} strokeWidth={2} />} value={details.phone} placeholder="Phone" />
            <Row icon={<Mail size={24} strokeWidth={2} />} value={details.email} placeholder="Email" />
            <Row icon={<Globe size={24} strokeWidth={2} />} value={details.website} placeholder="Website" />
          </div>

          <div className="mt-auto text-[clamp(10px,1.3cqw,14px)] uppercase tracking-[0.3em] text-white/55">
            Digital Card
          </div>
        </div>

        <div className="h-full w-[30%] flex items-center justify-center">
          <QRPanel value={qrValue} />
        </div>
      </div>
    </div>
  );
}

/* ───────── Mono — minimal white ───────── */
function MonoTemplate({
  details,
  photoDataUrl,
  qrValue,
  avatarNode,
  className,
}: TemplateProps) {
  return (
    <div
      className={clsx(
        "relative aspect-[7/4] rounded-3xl overflow-hidden bg-white text-neutral-900",
        className,
      )}
      style={{ containerType: "inline-size" }}
    >
      <div className="h-full w-full flex flex-col p-[4%] gap-[2%]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[clamp(18px,3.6cqw,34px)] font-semibold tracking-tight leading-tight truncate">
              {details.fullName || "Your Name"}
            </p>
            <p className="text-[clamp(11px,2.1cqw,18px)] text-neutral-600 mt-1 truncate">
              {details.title || "Title"}
            </p>
          </div>
          <PhotoFrame
            shape="circle"
            src={photoDataUrl}
            className="w-[18%] h-auto aspect-square flex-none"
          >
            {avatarNode}
          </PhotoFrame>
        </div>

        <div className="h-px bg-neutral-200" />

        <div className="flex items-center gap-2 text-[clamp(11px,2cqw,16px)] text-neutral-700">
          <Building2 size={14} />
          <span className="truncate">{details.company || "Company"}</span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3">
          <div className="grid grid-cols-1 gap-[2px] text-[clamp(11px,1.9cqw,15px)] text-neutral-700 min-w-0">
            <Row icon={<Phone size={13} />} value={details.phone} placeholder="Phone" dark />
            <Row icon={<Mail size={13} />} value={details.email} placeholder="Email" dark />
            <Row icon={<Globe size={13} />} value={details.website} placeholder="Website" dark />
          </div>
          <QRBox value={qrValue} />
        </div>
      </div>
    </div>
  );
}

/* ───────── Sunset — warm creative gradient ───────── */
function SunsetTemplate({
  details,
  photoDataUrl,
  qrValue,
  avatarNode,
  className,
}: TemplateProps) {
  return (
    <div
      className={clsx(
        "relative aspect-[7/4] rounded-3xl overflow-hidden",
        "bg-gradient-to-br from-[#ea580c] via-[#f97316] to-[#ec4899]",
        className,
      )}
      style={{ containerType: "inline-size" }}
    >
      <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-[#fde047] blur-3xl opacity-35" />
      <div className="absolute -bottom-24 -left-14 w-72 h-72 rounded-full bg-[#a855f7] blur-3xl opacity-35" />

      <div className="relative h-full w-full flex items-stretch text-white p-[3%] gap-[3%]">
        <div className="h-full w-[30%] flex items-stretch">
          <PhotoFrame
            shape="rect"
            src={photoDataUrl}
            className="w-full h-full ring-[3px] ring-white/70"
          >
            {avatarNode}
          </PhotoFrame>
        </div>

        <div className="flex-1 min-w-0 flex flex-col py-[1%]">
          <div>
            <p className="text-[clamp(24px,5.6cqw,72px)] font-bold leading-[1.05] tracking-tight truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
              {details.fullName || "Your Name"}
            </p>
            <p className="mt-[1%] text-[clamp(16px,3.4cqw,40px)] font-semibold text-white leading-tight truncate">
              {details.title || "Title"}
            </p>
            <p className="text-[clamp(14px,3.2cqw,36px)] text-white/80 leading-tight truncate italic">
              {details.company || "Company"}
            </p>
          </div>

          <div className="my-[3.5%] h-[2px] bg-white/40 rounded-full" />

          <div className="space-y-[3%] text-[clamp(14px,3cqw,30px)] font-medium">
            <Row icon={<Phone size={24} strokeWidth={2} />} value={details.phone} placeholder="Phone" />
            <Row icon={<Mail size={24} strokeWidth={2} />} value={details.email} placeholder="Email" />
            <Row icon={<Globe size={24} strokeWidth={2} />} value={details.website} placeholder="Website" />
          </div>

          <div className="mt-auto text-[clamp(10px,1.3cqw,14px)] uppercase tracking-[0.3em] text-white/75 font-semibold">
            Say Hello ☀
          </div>
        </div>

        <div className="h-full w-[30%] flex items-center justify-center">
          <QRPanel value={qrValue} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*                           PORTRAIT                              */
/* ─────────────────────────────────────────────────────────────── */

/* ───────── Neon — bold glowing portrait ───────── */
function NeonTemplate({
  details,
  photoDataUrl,
  qrValue,
  avatarNode,
  className,
}: TemplateProps) {
  return (
    <div
      className={clsx(
        "relative aspect-[5/7] rounded-3xl overflow-hidden",
        "bg-[#050510] text-white",
        className,
      )}
      style={{ containerType: "inline-size" }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(236,72,153,0.3), transparent 45%), linear-gradient(-135deg, rgba(34,211,238,0.26), transparent 45%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative h-full w-full flex flex-col items-center text-center p-[6%] gap-[3%]">
        <PhotoFrame
          shape="circle"
          src={photoDataUrl}
          className="w-[56%] aspect-square shadow-[0_0_80px_-8px_rgba(236,72,153,0.85)] ring-2 ring-white/20"
        >
          {avatarNode}
        </PhotoFrame>

        <div className="w-full">
          <p className="text-[clamp(18px,6.4cqw,48px)] font-black tracking-tight leading-[1.05] truncate">
            <span className="bg-gradient-to-r from-[#ec4899] via-[#a78bfa] to-[#22d3ee] bg-clip-text text-transparent">
              {details.fullName || "Your Name"}
            </span>
          </p>
          <p className="mt-[1%] text-[clamp(12px,3.8cqw,26px)] font-medium text-white/90 truncate">
            {details.title || "Title"}
          </p>
          <p className="text-[clamp(11px,3.4cqw,22px)] text-white/55 truncate">
            {details.company || "Company"}
          </p>
        </div>

        <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-[#22d3ee] to-transparent" />

        <div className="w-full space-y-[2.5%] text-[clamp(11px,3cqw,20px)] text-left font-medium">
          <Row icon={<Phone size={20} strokeWidth={2} />} value={details.phone} placeholder="Phone" />
          <Row icon={<Mail size={20} strokeWidth={2} />} value={details.email} placeholder="Email" />
          <Row icon={<Globe size={20} strokeWidth={2} />} value={details.website} placeholder="Website" />
        </div>

        <div className="mt-auto w-full flex items-end justify-between gap-3">
          <div className="text-[clamp(8px,1.8cqw,12px)] uppercase tracking-[0.3em] text-[#22d3ee] text-left">
            Tap · Scan · Connect
          </div>
          <div className="w-[32%] shrink-0">
            <QRPanel value={qrValue} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── Forest — grounded, natural ───────── */
function ForestTemplate({
  details,
  photoDataUrl,
  qrValue,
  avatarNode,
  className,
}: TemplateProps) {
  return (
    <div
      className={clsx(
        "relative aspect-[5/7] rounded-3xl overflow-hidden",
        "bg-gradient-to-b from-[#065f46] via-[#064e3b] to-[#052e16]",
        className,
      )}
      style={{ containerType: "inline-size" }}
    >
      <div className="absolute -top-16 -left-20 w-80 h-80 rounded-full bg-[#10b981] blur-3xl opacity-25" />
      <div className="absolute -bottom-20 -right-10 w-72 h-72 rounded-full bg-[#84cc16] blur-3xl opacity-20" />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, white 1px, transparent 1.5px), radial-gradient(circle at 70% 60%, white 1px, transparent 1.5px)",
          backgroundSize: "40px 40px, 55px 55px",
        }}
      />

      <div className="relative h-full w-full flex flex-col p-[5%] gap-[3%] text-emerald-50">
        <div className="flex items-start gap-[4%]">
          <div className="w-[55%] aspect-[4/5]">
            <PhotoFrame
              shape="rect"
              src={photoDataUrl}
              className="w-full h-full ring-2 ring-emerald-300/40"
            >
              {avatarNode}
            </PhotoFrame>
          </div>
          <div className="flex-1 shrink-0 flex items-start justify-end">
            <div className="w-full">
              <QRPanel value={qrValue} />
            </div>
          </div>
        </div>

        <div>
          <p className="text-[clamp(18px,6cqw,44px)] font-bold leading-[1.1] tracking-tight text-white">
            {details.fullName || "Your Name"}
          </p>
          <p className="mt-[1%] text-[clamp(12px,3.6cqw,24px)] font-medium text-emerald-100/90 truncate">
            {details.title || "Title"}
          </p>
          <p className="text-[clamp(11px,3.2cqw,22px)] text-emerald-200/65 truncate">
            {details.company || "Company"}
          </p>
        </div>

        <div className="h-[2px] bg-emerald-300/25 rounded-full" />

        <div className="space-y-[2.5%] text-[clamp(12px,3cqw,22px)] font-medium">
          <Row icon={<Phone size={22} strokeWidth={2} />} value={details.phone} placeholder="Phone" />
          <Row icon={<Mail size={22} strokeWidth={2} />} value={details.email} placeholder="Email" />
          <Row icon={<Globe size={22} strokeWidth={2} />} value={details.website} placeholder="Website" />
        </div>

        <div className="mt-auto text-[clamp(8px,1.8cqw,12px)] uppercase tracking-[0.3em] text-emerald-200/50">
          ◆ Grow together
        </div>
      </div>
    </div>
  );
}

/* ───────── Noir — black & gold luxury ───────── */
function NoirTemplate({
  details,
  photoDataUrl,
  qrValue,
  avatarNode,
  className,
}: TemplateProps) {
  return (
    <div
      className={clsx(
        "relative aspect-[5/7] rounded-3xl overflow-hidden",
        "bg-[#0a0a0a] text-white",
        className,
      )}
      style={{ containerType: "inline-size" }}
    >
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #d4af37 1px, transparent 1px), linear-gradient(45deg, #d4af37 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />
      <div className="absolute inset-[3%] rounded-2xl border border-[#d4af37]/30 pointer-events-none" />

      <div className="relative h-full w-full flex flex-col items-center text-center p-[7%] gap-[3%]">
        <div className="text-[clamp(8px,1.8cqw,12px)] uppercase tracking-[0.4em] text-[#d4af37]">
          ◆ Established ◆
        </div>

        <PhotoFrame
          shape="circle"
          src={photoDataUrl}
          className="w-[62%] aspect-square ring-[3px] ring-[#d4af37]/70 shadow-[0_0_40px_-8px_rgba(212,175,55,0.5)]"
        >
          {avatarNode}
        </PhotoFrame>

        <div className="w-full">
          <p
            className="text-[clamp(16px,5.6cqw,42px)] font-light uppercase tracking-[0.15em] leading-[1.1] text-white truncate"
            style={{ fontFamily: '"Times New Roman", Georgia, serif' }}
          >
            {details.fullName || "Your Name"}
          </p>
          <div className="mx-auto my-[3%] w-[25%] h-[1px] bg-[#d4af37]" />
          <p className="text-[clamp(12px,3.2cqw,22px)] text-[#d4af37] tracking-[0.2em] uppercase truncate">
            {details.title || "Title"}
          </p>
          <p className="mt-[1%] text-[clamp(11px,3cqw,20px)] text-white/60 italic truncate">
            {details.company || "Your Company"}
          </p>
        </div>

        <div className="w-full space-y-[2.5%] text-[clamp(11px,2.9cqw,20px)] text-left font-light">
          <Row icon={<Phone size={20} strokeWidth={1.5} />} value={details.phone} placeholder="Phone" />
          <Row icon={<Mail size={20} strokeWidth={1.5} />} value={details.email} placeholder="Email" />
          <Row icon={<Globe size={20} strokeWidth={1.5} />} value={details.website} placeholder="Website" />
        </div>

        <div className="mt-auto w-full flex items-end justify-between gap-3">
          <div className="text-[clamp(8px,1.8cqw,12px)] uppercase tracking-[0.3em] text-[#d4af37]/60 text-left">
            By Invitation
          </div>
          <div className="w-[30%] shrink-0">
            <QRPanel value={qrValue} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*                         SHARED PRIMITIVES                       */
/* ─────────────────────────────────────────────────────────────── */

/**
 * Photo slot. Renders:
 *   - `children` if provided (live webcam, etc.)
 *   - `<img>` if `src` is set
 *   - a subtle "Photo" placeholder otherwise
 */
function PhotoFrame({
  shape,
  src,
  className,
  children,
}: {
  shape: "circle" | "rect";
  src: string | null;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden shrink-0 bg-white/10",
        shape === "circle" ? "rounded-full" : "rounded-2xl",
        className,
      )}
    >
      {children ? (
        <div className="absolute inset-0">{children}</div>
      ) : src ? (
        <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-white/45 text-xs">
          Photo
        </div>
      )}
    </div>
  );
}

function Row({
  icon,
  value,
  placeholder,
  dark,
}: {
  icon: React.ReactNode;
  value: string;
  placeholder: string;
  dark?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex items-center gap-[3%] min-w-0",
        dark ? "text-neutral-700" : "text-white",
      )}
    >
      <span
        className={clsx(
          "shrink-0",
          dark ? "text-neutral-500" : "text-white/80",
        )}
      >
        {icon}
      </span>
      <span className="truncate">
        {value || <span className="opacity-50">{placeholder}</span>}
      </span>
    </div>
  );
}

function QRBox({ value }: { value: string }) {
  return (
    <div className="p-[6px] rounded-lg bg-white shrink-0">
      <div className="w-[clamp(40px,10cqw,90px)] h-[clamp(40px,10cqw,90px)] grid place-items-center">
        <QRCodeSVG value={value} size={72} level="M" style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}

/** Big square QR that fills its column (used in Aurora/Neon landscape). */
function QRPanel({ value }: { value: string }) {
  return (
    <div className="w-full aspect-square p-[6%] rounded-2xl bg-white flex items-center justify-center">
      <QRCodeSVG
        value={value}
        size={256}
        level="M"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
