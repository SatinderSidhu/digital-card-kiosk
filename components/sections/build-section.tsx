"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, Loader2 } from "lucide-react";
import { useWizard } from "@/lib/store";
import { PAGE_TEMPLATES, TEMPLATE_ORIENTATION, type TemplateId } from "@/lib/types";
import { buildVcard } from "@/lib/vcard";
import { SectionFrame } from "./section-frame";
import { TemplateCard, TEMPLATES } from "../templates/card-templates";

type Phase = "choose" | "building" | "done";
const BUILD_MS = 1600;

type Props = {
  state: "idle" | "active" | "done";
};

export function BuildSection({ state }: Props) {
  const details = useWizard((s) => s.details);
  const photo = useWizard((s) => s.photoDataUrl);
  const template = useWizard((s) => s.template);
  const setTemplate = useWizard((s) => s.setTemplate);
  const sessionId = useWizard((s) => s.sessionId);
  const displayMode = useWizard((s) => s.mode);
  const isKiosk = displayMode === "kiosk";

  const [phase, setPhase] = useState<Phase>(template ? "done" : "choose");
  const buildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer if the component unmounts mid-build.
  useEffect(
    () => () => {
      if (buildTimerRef.current) clearTimeout(buildTimerRef.current);
    },
    [],
  );

  const qrValue = buildVcard(details, sessionId);
  const meta = (id: TemplateId) => TEMPLATES.find((t) => t.id === id);

  const landscapeIds = PAGE_TEMPLATES.filter(
    (id) => TEMPLATE_ORIENTATION[id] === "landscape",
  );
  const portraitIds = PAGE_TEMPLATES.filter(
    (id) => TEMPLATE_ORIENTATION[id] === "portrait",
  );

  const handlePick = (id: TemplateId) => {
    if (phase === "building") return;
    setTemplate(id);
    setPhase("building");
    if (buildTimerRef.current) clearTimeout(buildTimerRef.current);
    buildTimerRef.current = setTimeout(() => setPhase("done"), BUILD_MS);
  };

  const handleReset = () => {
    if (buildTimerRef.current) {
      clearTimeout(buildTimerRef.current);
      buildTimerRef.current = null;
    }
    setTemplate(null);
    setPhase("choose");
  };

  const chosenMeta = template ? meta(template) : undefined;
  const chosenOrientation = chosenMeta?.orientation ?? "landscape";
  const chosenMaxW = isKiosk
    ? chosenOrientation === "portrait" ? 360 : 640
    : chosenOrientation === "portrait" ? 240 : 460;
  const pickerOuter = isKiosk
    ? "max-w-[1200px] w-[96%]"
    : "max-w-[800px] w-[96%]";
  const landscapeGrid = isKiosk
    ? "grid-cols-1 md:grid-cols-3"
    : "grid-cols-1 md:grid-cols-2";
  const portraitGrid = isKiosk
    ? "grid-cols-2 md:grid-cols-3"
    : "grid-cols-2 md:grid-cols-3";

  return (
    <SectionFrame
      index={3}
      title="Pick your style"
      subtitle={
        phase === "choose"
          ? "Tap the card you love — horizontal or vertical"
          : phase === "building"
            ? "Building your card..."
            : "Your card is ready"
      }
      state={state}
    >
      <AnimatePresence mode="wait">
        {phase === "choose" && (
          <motion.div
            key="choose"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className={`mx-auto flex flex-col gap-5 overflow-auto ${pickerOuter}`}
          >
            <TemplateGroup
              label="Horizontal"
              ids={landscapeIds}
              meta={meta}
              details={details}
              photo={photo}
              qrValue={qrValue}
              onPick={handlePick}
              className={landscapeGrid}
            />
            <TemplateGroup
              label="Vertical"
              ids={portraitIds}
              meta={meta}
              details={details}
              photo={photo}
              qrValue={qrValue}
              onPick={handlePick}
              className={portraitGrid}
            />
          </motion.div>
        )}

        {phase === "building" && template && (
          <motion.div
            key="building"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative"
          >
            <div
              className="mx-auto w-[92%] relative"
              style={{ maxWidth: `${chosenMaxW}px` }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="relative"
              >
                <TemplateCard
                  template={template}
                  details={details}
                  photoDataUrl={photo}
                  qrValue={qrValue}
                />
                <BuildOverlay />
              </motion.div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-white/70">
              <Loader2 size={16} className="animate-spin text-[#22d3ee]" />
              <span>Assembling your card...</span>
            </div>
          </motion.div>
        )}

        {phase === "done" && template && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
              className="mx-auto w-[92%]"
              style={{ maxWidth: `${chosenMaxW}px` }}
            >
              <TemplateCard
                template={template}
                details={details}
                photoDataUrl={photo}
                qrValue={qrValue}
              />
            </motion.div>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 text-xs">
              <Check size={14} /> {chosenMeta?.name} selected
            </div>
            <button
              onClick={handleReset}
              className="mt-2 text-xs text-white/45 hover:text-white/80 underline underline-offset-4"
            >
              Change style
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </SectionFrame>
  );
}

function TemplateGroup({
  label,
  ids,
  meta,
  details,
  photo,
  qrValue,
  onPick,
  className,
}: {
  label: string;
  ids: TemplateId[];
  meta: (id: TemplateId) => ReturnType<typeof TEMPLATES.find>;
  details: Parameters<typeof TemplateCard>[0]["details"];
  photo: string | null;
  qrValue: string;
  onPick: (id: TemplateId) => void;
  className: string;
}) {
  if (ids.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-white/45">
        <span className="h-px flex-none w-6 bg-white/20" />
        {label}
      </div>
      <div className={`grid gap-3 ${className}`}>
        {ids.map((tid) => {
          const m = meta(tid);
          return (
            <motion.button
              key={tid}
              onClick={() => onPick(tid)}
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -3 }}
              className="rounded-2xl p-2 bg-white/[0.04] ring-1 ring-white/10 text-left hover:ring-[#7c5cff]/60 transition-all"
            >
              <TemplateCard
                template={tid}
                details={details}
                photoDataUrl={photo}
                qrValue={qrValue}
              />
              <div className="px-1 pt-2 pb-1 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{m?.name}</p>
                  <p className="text-[10px] text-white/50 leading-tight truncate">
                    {m?.tagline}
                  </p>
                </div>
                <span className="text-[9px] uppercase tracking-widest text-white/35 shrink-0">
                  {m?.mood}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function BuildOverlay() {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ delay: 1.2, duration: 0.4 }}
    >
      <motion.div
        initial={{ y: "-120%" }}
        animate={{ y: "120%" }}
        transition={{ duration: 1.1, ease: "easeInOut" }}
        className="absolute inset-x-0 h-24"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(34,211,238,0.5) 50%, transparent 100%)",
          filter: "blur(10px)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 1, 0], scale: [0.4, 1.2, 1.6] }}
        transition={{ duration: 1.3, times: [0, 0.6, 1] }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <Sparkles size={72} className="text-white drop-shadow-[0_0_24px_rgba(124,92,255,0.9)]" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.4, 0] }}
        transition={{ duration: 1.4 }}
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />
    </motion.div>
  );
}
