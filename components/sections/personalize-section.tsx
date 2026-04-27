"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Keyboard, X, Check, Pencil } from "lucide-react";
import clsx from "clsx";
import { useWizard } from "@/lib/store";
import type { CardDetails } from "@/lib/types";
import { withFallback, hasRealDetails } from "@/lib/fake-data";
import { buildVcard } from "@/lib/vcard";
import { SectionFrame } from "./section-frame";
import { PrimaryButton, GhostButton } from "../ui";
import { TemplateCard } from "../templates/card-templates";
import { UnifiedScanner } from "../scanners/unified-scanner";
import { DetailsForm } from "../forms/details-form";

type ViewMode = "idle" | "scanning" | "form";

type Props = {
  state: "idle" | "active" | "done";
};

export function PersonalizeSection({ state }: Props) {
  const details = useWizard((s) => s.details);
  const photo = useWizard((s) => s.photoDataUrl);
  const sessionId = useWizard((s) => s.sessionId);
  const setDetails = useWizard((s) => s.setDetails);
  const replaceDetails = useWizard((s) => s.replaceDetails);
  const displayMode = useWizard((s) => s.mode);

  const [view, setView] = useState<ViewMode>("idle");

  const isReal = hasRealDetails(details);
  const displayDetails = withFallback(details);
  const qrValue = buildVcard(displayDetails, sessionId);
  const isKiosk = displayMode === "kiosk";

  const idleCardWrapper = isKiosk
    ? "w-[96%] max-w-[1400px]"
    : "w-[92%] max-w-[760px]";
  const splitCardMaxWidth = isKiosk ? "max-w-[700px]" : "max-w-[520px]";
  const splitGrid = isKiosk
    ? "grid-cols-1 md:grid-cols-2"
    : "grid-cols-1";

  const handleScanResult = (partial: Partial<CardDetails>) => {
    replaceDetails({
      fullName: partial.fullName ?? details.fullName ?? "",
      title: partial.title ?? details.title ?? "",
      company: partial.company ?? details.company ?? "",
      phone: partial.phone ?? details.phone ?? "",
      email: partial.email ?? details.email ?? "",
      website: partial.website ?? details.website ?? "",
    });
    setView("form");
  };

  return (
    <SectionFrame
      index={2}
      title="Make it yours"
      subtitle={
        view === "scanning"
          ? "Show a business card or QR code to the camera"
          : isReal
            ? "Looking good — review and continue"
            : "Scan a card, scan a QR code, or type your details"
      }
      state={state}
    >
      <AnimatePresence mode="wait">
        {view === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4"
          >
            <div className={clsx(idleCardWrapper, "flex items-center justify-center")}>
              <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 24 }}
                className="relative w-full"
              >
                <TemplateCard
                  template="aurora"
                  details={displayDetails}
                  photoDataUrl={photo}
                  qrValue={qrValue}
                />
              </motion.div>
            </div>

            <div className="flex-none flex items-center justify-center gap-3 flex-wrap">
              <PrimaryButton onClick={() => setView("scanning")} className="px-8">
                <Camera size={20} /> {isReal ? "Rescan" : "Scan card or QR code"}
              </PrimaryButton>
              <GhostButton onClick={() => setView("form")}>
                {isReal ? (
                  <>
                    <Pencil size={16} /> Edit manually
                  </>
                ) : (
                  <>
                    <Keyboard size={16} /> Type manually
                  </>
                )}
              </GhostButton>
              {isReal && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 text-xs">
                  <Check size={14} /> Details ready
                </span>
              )}
            </div>
          </motion.div>
        )}

        {view === "scanning" && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4"
          >
            <div className={clsx(idleCardWrapper, "flex items-center justify-center")}>
              <div className="relative w-full">
                <TemplateCard
                  template="aurora"
                  details={displayDetails}
                  photoDataUrl={photo}
                  qrValue={qrValue}
                />

                {/* Camera blooms open from where the contact info usually
                    sits — the Aurora template's info column lives between
                    36% and 64% of the card width with the standard 3-3-30
                    flex layout. Spring-scaled in so it feels like the
                    middle "opens up" on tap, not a panel sliding in. */}
                <motion.div
                  initial={{ scale: 0.45, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.45, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 240, damping: 22 }}
                  className="absolute z-20 rounded-2xl overflow-hidden ring-2 ring-[#22d3ee]/45 shadow-[0_24px_70px_-15px_rgba(34,211,238,0.5)] bg-[#050510]"
                  style={{ left: "36%", right: "36%", top: "5%", bottom: "5%" }}
                >
                  <UnifiedScanner onResult={handleScanResult} />
                </motion.div>
              </div>
            </div>

            <div className="flex-none flex items-center justify-center">
              <GhostButton onClick={() => setView("idle")}>
                <X size={16} /> Cancel scan
              </GhostButton>
            </div>
          </motion.div>
        )}

        {view === "form" && (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 min-h-0 flex flex-col gap-3"
          >
            <div className={clsx("flex-1 min-h-0 grid gap-4 items-stretch", splitGrid)}>
              <div className="flex items-center justify-center min-w-0">
                <div className={clsx("w-full", splitCardMaxWidth)}>
                  <TemplateCard
                    template="aurora"
                    details={displayDetails}
                    photoDataUrl={photo}
                    qrValue={qrValue}
                  />
                </div>
              </div>
              <div className="min-w-0 overflow-auto">
                <DetailsForm value={details} onChange={setDetails} />
              </div>
            </div>
            <div className="flex-none flex items-center justify-between">
              <GhostButton onClick={() => setView("idle")}>
                <X size={16} /> Done editing
              </GhostButton>
              <GhostButton onClick={() => setView("scanning")}>
                <Camera size={14} /> Rescan
              </GhostButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SectionFrame>
  );
}
