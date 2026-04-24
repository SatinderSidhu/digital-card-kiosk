"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { useWizard } from "@/lib/store";
import { hasRealDetails } from "@/lib/fake-data";
import { PhotoSection } from "@/components/sections/photo-section";
import { PersonalizeSection } from "@/components/sections/personalize-section";
import { BuildSection } from "@/components/sections/build-section";
import { ShareSection } from "@/components/sections/share-section";
import { MarketingSlot } from "@/components/marketing-slot";
import { PrimaryButton, GhostButton } from "@/components/ui";

export default function Page() {
  const step = useWizard((s) => s.step);
  const photo = useWizard((s) => s.photoDataUrl);
  const details = useWizard((s) => s.details);
  const template = useWizard((s) => s.template);
  const next = useWizard((s) => s.next);
  const back = useWizard((s) => s.back);
  const reset = useWizard((s) => s.reset);
  const ensureSession = useWizard((s) => s.ensureSession);

  useEffect(() => {
    ensureSession();
  }, [ensureSession]);

  const photoDone = !!photo;
  const detailsDone = hasRealDetails(details);
  const templateDone = !!template;

  const stateOf = (i: 0 | 1 | 2 | 3): "idle" | "active" | "done" => {
    if (i < step) return "done";
    if (i === step) return "active";
    return "idle";
  };

  const canContinue =
    step === 0 ? photoDone : step === 1 ? detailsDone : step === 2 ? templateDone : false;

  return (
    <main className="h-dvh w-full flex flex-col overflow-hidden">
      <div className="h-1/2 w-full flex flex-col min-h-0 overflow-hidden">
        <header className="flex-none flex items-center justify-between px-8 py-2.5 backdrop-blur-md bg-[color:var(--background)]/60 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#7c5cff] to-[#22d3ee] grid place-items-center text-xs font-black">
              ◆
            </div>
            <span className="text-sm font-semibold tracking-tight">Digital Card</span>
          </div>
          <StepPills
            labels={["Photo", "Details", "Style", "Share"]}
            states={[stateOf(0), stateOf(1), stateOf(2), stateOf(3)]}
          />
        </header>

        <div className="flex-1 min-h-0 flex flex-col px-6 md:px-10 py-4 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -28 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="flex-1 min-h-0 flex flex-col"
            >
              {step === 0 && <PhotoSection state="active" />}
              {step === 1 && <PersonalizeSection state="active" />}
              {step === 2 && <BuildSection state="active" />}
              {step === 3 && <ShareSection state="active" />}
            </motion.div>
          </AnimatePresence>

          {step > 0 && (
            <StepNav
              step={step}
              canContinue={canContinue}
              onBack={back}
              onNext={next}
              onReset={reset}
            />
          )}
        </div>
      </div>

      <MarketingSlot className="h-1/2 w-full" />
    </main>
  );
}

function StepNav({
  step,
  canContinue,
  onBack,
  onNext,
  onReset,
}: {
  step: 0 | 1 | 2 | 3;
  canContinue: boolean;
  onBack: () => void;
  onNext: () => void;
  onReset: () => void;
}) {
  const nextLabel =
    step === 0 ? "Continue" : step === 1 ? "Pick a style" : step === 2 ? "Share it" : "";

  return (
    <div className="flex-none mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
      {step > 0 ? (
        <GhostButton onClick={onBack}>
          <ArrowLeft size={18} /> Back
        </GhostButton>
      ) : (
        <span className="h-10" />
      )}

      {step < 3 ? (
        <PrimaryButton onClick={onNext} disabled={!canContinue}>
          {nextLabel} <ArrowRight size={18} />
        </PrimaryButton>
      ) : (
        <GhostButton onClick={onReset}>
          <RotateCcw size={14} /> Start over
        </GhostButton>
      )}
    </div>
  );
}

function StepPills({
  labels,
  states,
}: {
  labels: string[];
  states: ("idle" | "active" | "done")[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      {states.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span
            className={
              "h-1.5 rounded-full transition-all " +
              (s === "active"
                ? "w-8 bg-gradient-to-r from-[#7c5cff] to-[#22d3ee]"
                : s === "done"
                  ? "w-4 bg-[#22d3ee]"
                  : "w-1.5 bg-white/15")
            }
          />
          {s === "active" && (
            <span className="text-[10px] uppercase tracking-wider text-white/70 hidden sm:inline">
              {labels[i]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
