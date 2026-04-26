"use client";

import { useCallback, useRef, useState } from "react";
import Webcam from "react-webcam";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, RefreshCw, ImageOff, ArrowRight } from "lucide-react";
import { useWizard } from "@/lib/store";
import { withFallback } from "@/lib/fake-data";
import { buildVcard } from "@/lib/vcard";
import { SectionFrame } from "./section-frame";
import { PrimaryButton, GhostButton } from "../ui";
import { TemplateCard } from "../templates/card-templates";

type Props = {
  state: "idle" | "active" | "done";
};

export function PhotoSection({ state }: Props) {
  const photo = useWizard((s) => s.photoDataUrl);
  const setPhoto = useWizard((s) => s.setPhoto);
  const details = useWizard((s) => s.details);
  const sessionId = useWizard((s) => s.sessionId);
  const next = useWizard((s) => s.next);
  const mode = useWizard((s) => s.mode);
  const webcamRef = useRef<Webcam>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const displayDetails = withFallback(details);
  const qrValue = buildVcard(displayDetails, sessionId);
  const isKiosk = mode === "kiosk";

  const capture = useCallback(() => {
    const dataUrl = webcamRef.current?.getScreenshot();
    if (!dataUrl) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    setPhoto(dataUrl);
  }, [setPhoto]);

  const liveAvatar =
    !photo && !error ? (
      <Webcam
        ref={webcamRef}
        audio={false}
        mirrored
        screenshotFormat="image/jpeg"
        videoConstraints={{ facingMode: "user" }}
        onUserMedia={() => setReady(true)}
        onUserMediaError={(e) =>
          setError(typeof e === "string" ? e : e?.message ?? "Permission denied")
        }
        className="absolute inset-0 w-full h-full object-cover"
      />
    ) : !photo && error ? (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-3">
        <ImageOff size={22} className="text-white/55" />
        <p className="text-[11px] text-white/70">Camera unavailable</p>
      </div>
    ) : undefined;

  return (
    <SectionFrame
      index={1}
      title="Your live card"
      subtitle={
        photo
          ? isKiosk
            ? "Looks great — tap Update Info to add your details"
            : "Looks great — tap Continue to add your details"
          : "Smile! Tap capture when you're ready"
      }
      state={state}
    >
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4">
        <div
          className={
            isKiosk
              ? "w-[96%] max-w-[1400px] flex items-center justify-center"
              : "w-[92%] max-w-[760px] flex items-center justify-center"
          }
        >
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
              avatarNode={liveAvatar}
            />

            <AnimatePresence>
              {flash && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 rounded-3xl bg-white pointer-events-none"
                />
              )}
            </AnimatePresence>

            {/* Inline-on-card overlays only in kiosk mode. Compact uses
                the row of buttons below the card + the StepNav footer. */}
            {isKiosk && (
              <AnimatePresence>
                {photo && (
                  <>
                    {/* Retake — tucked onto the photo, top-left */}
                    <motion.button
                      key="retake"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: 0.1 }}
                      onClick={() => setPhoto(null)}
                      className="absolute top-[4%] left-[4%] z-10 inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/25 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-black/70 active:scale-95 transition"
                    >
                      <RefreshCw size={14} /> Retake
                    </motion.button>

                    {/* Update Info — sits where DIGITAL CARD tag would be, inside the info column */}
                    <motion.button
                      key="continue"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        delay: 0.2,
                        type: "spring",
                        stiffness: 260,
                        damping: 22,
                      }}
                      onClick={next}
                      className="absolute z-10 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-[#7c5cff] via-[#8b5cf6] to-[#22d3ee] shadow-[0_10px_32px_-10px_rgba(124,92,255,0.8)] hover:scale-[1.03] active:scale-95 transition"
                      style={{ bottom: "4%", left: "36%" }}
                    >
                      Update Info <ArrowRight size={16} />
                    </motion.button>
                  </>
                )}
              </AnimatePresence>
            )}
          </motion.div>
        </div>

        <div className="flex-none flex items-center justify-center gap-3">
          {photo ? (
            !isKiosk && (
              <GhostButton onClick={() => setPhoto(null)}>
                <RefreshCw size={18} /> Retake
              </GhostButton>
            )
          ) : (
            <PrimaryButton onClick={capture} disabled={!ready} className="px-10">
              <Camera size={20} /> Capture
            </PrimaryButton>
          )}
        </div>
      </div>
    </SectionFrame>
  );
}
