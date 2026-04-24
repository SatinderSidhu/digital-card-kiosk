"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Keyboard, X, Check, Pencil } from "lucide-react";
import { useWizard } from "@/lib/store";
import type { CardDetails } from "@/lib/types";
import { withFallback, hasRealDetails } from "@/lib/fake-data";
import { buildVcard } from "@/lib/vcard";
import { SectionFrame } from "./section-frame";
import { PrimaryButton, GhostButton } from "../ui";
import { TemplateCard } from "../templates/card-templates";
import { UnifiedScanner } from "../scanners/unified-scanner";
import { DetailsForm } from "../forms/details-form";

type Mode = "idle" | "scanning" | "form";

type Props = {
  state: "idle" | "active" | "done";
};

export function PersonalizeSection({ state }: Props) {
  const details = useWizard((s) => s.details);
  const photo = useWizard((s) => s.photoDataUrl);
  const sessionId = useWizard((s) => s.sessionId);
  const setDetails = useWizard((s) => s.setDetails);
  const replaceDetails = useWizard((s) => s.replaceDetails);

  const [mode, setMode] = useState<Mode>("idle");

  const isReal = hasRealDetails(details);
  const displayDetails = withFallback(details);
  const qrValue = buildVcard(displayDetails, sessionId);

  const handleScanResult = (partial: Partial<CardDetails>) => {
    replaceDetails({
      fullName: partial.fullName ?? details.fullName ?? "",
      title: partial.title ?? details.title ?? "",
      company: partial.company ?? details.company ?? "",
      phone: partial.phone ?? details.phone ?? "",
      email: partial.email ?? details.email ?? "",
      website: partial.website ?? details.website ?? "",
    });
    setMode("form");
  };

  return (
    <SectionFrame
      index={2}
      title="Make it yours"
      subtitle={
        mode === "scanning"
          ? "Show a business card or QR code to the camera"
          : isReal
            ? "Looking good — review and continue"
            : "Scan a card, scan a QR code, or type your details"
      }
      state={state}
    >
      <AnimatePresence mode="wait">
        {mode === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4"
          >
            <div className="w-[96%] max-w-[1400px] flex items-center justify-center">
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
              <PrimaryButton onClick={() => setMode("scanning")} className="px-8">
                <Camera size={20} /> {isReal ? "Rescan" : "Scan card or QR code"}
              </PrimaryButton>
              <GhostButton onClick={() => setMode("form")}>
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

        {mode === "scanning" && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 min-h-0 flex flex-col gap-3"
          >
            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              <div className="flex items-center justify-center min-w-0">
                <div className="w-full max-w-[700px]">
                  <TemplateCard
                    template="aurora"
                    details={displayDetails}
                    photoDataUrl={photo}
                    qrValue={qrValue}
                  />
                </div>
              </div>
              <div className="min-w-0 min-h-[320px]">
                <UnifiedScanner onResult={handleScanResult} />
              </div>
            </div>
            <div className="flex-none flex items-center justify-center">
              <GhostButton onClick={() => setMode("idle")}>
                <X size={16} /> Cancel scan
              </GhostButton>
            </div>
          </motion.div>
        )}

        {mode === "form" && (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 min-h-0 flex flex-col gap-3"
          >
            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              <div className="flex items-center justify-center min-w-0">
                <div className="w-full max-w-[700px]">
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
              <GhostButton onClick={() => setMode("idle")}>
                <X size={16} /> Done editing
              </GhostButton>
              <GhostButton onClick={() => setMode("scanning")}>
                <Camera size={14} /> Rescan
              </GhostButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SectionFrame>
  );
}
