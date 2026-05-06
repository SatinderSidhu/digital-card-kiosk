"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, X, Check } from "lucide-react";
import clsx from "clsx";
import { useWizard } from "@/lib/store";
import type { CardDetails } from "@/lib/types";
import { withFallback, hasRealDetails } from "@/lib/fake-data";
import { buildVcard } from "@/lib/vcard";
import { SectionFrame } from "./section-frame";
import { GhostButton } from "../ui";
import { TemplateCard } from "../templates/card-templates";
import { UnifiedScanner } from "../scanners/unified-scanner";

type ViewMode = "edit" | "scanning";

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

  const [view, setView] = useState<ViewMode>("edit");

  const isReal = hasRealDetails(details);
  const displayDetails = withFallback(details);
  const qrValue = buildVcard(displayDetails, sessionId);
  const isKiosk = displayMode === "kiosk";

  const cardWrapper = isKiosk
    ? "w-[96%] max-w-[1400px]"
    : "w-[92%] max-w-[760px]";

  const handleScanResult = (partial: Partial<CardDetails>) => {
    replaceDetails({
      fullName: partial.fullName ?? details.fullName ?? "",
      title: partial.title ?? details.title ?? "",
      company: partial.company ?? details.company ?? "",
      phone: partial.phone ?? details.phone ?? "",
      email: partial.email ?? details.email ?? "",
      website: partial.website ?? details.website ?? "",
    });
    setView("edit");
  };

  return (
    <SectionFrame
      index={2}
      title="Make it yours"
      subtitle={
        view === "scanning"
          ? "Show a business card or QR code to the camera"
          : isReal
            ? "Looking good — review, tweak, and continue"
            : "Tap any field to type — or scan a card to fill it in for you"
      }
      state={state}
    >
      <AnimatePresence mode="wait">
        {view === "edit" && (
          <motion.div
            key="edit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4"
          >
            <div className={clsx(cardWrapper, "flex items-center justify-center")}>
              <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 24 }}
                className="relative w-full"
              >
                {/* Inline-editable card. Each text field becomes a styled
                    input that writes through to the wizard store. The
                    photo and QR remain read-only — those are set in
                    other steps. */}
                <TemplateCard
                  template="aurora"
                  details={details}
                  photoDataUrl={photo}
                  qrValue={qrValue}
                  onEdit={setDetails}
                />
              </motion.div>
            </div>

            <div className="flex-none flex items-center justify-center gap-3 flex-wrap">
              <GhostButton onClick={() => setView("scanning")}>
                <Camera size={16} /> {isReal ? "Rescan card" : "Scan a paper card"}
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
            <div className={clsx(cardWrapper, "flex items-center justify-center")}>
              <div className="relative w-full">
                <TemplateCard
                  template="aurora"
                  details={displayDetails}
                  photoDataUrl={photo}
                  qrValue={qrValue}
                />

                {/* Camera blooms open from where the contact info usually
                    sits — Aurora's info column is between 30% and 70% of
                    the card width, so the camera overlays it with a touch
                    of overhang into the photo and QR columns. */}
                <motion.div
                  initial={{ scale: 0.45, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.45, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 240, damping: 22 }}
                  className="absolute z-20 rounded-2xl overflow-hidden ring-2 ring-[#22d3ee]/45 shadow-[0_24px_70px_-15px_rgba(34,211,238,0.5)] bg-[#050510]"
                  style={{ left: "27%", right: "27%", top: "3%", bottom: "3%" }}
                >
                  <UnifiedScanner onResult={handleScanResult} />
                </motion.div>
              </div>
            </div>

            <div className="flex-none flex items-center justify-center">
              <GhostButton onClick={() => setView("edit")}>
                <X size={16} /> Cancel scan
              </GhostButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SectionFrame>
  );
}
