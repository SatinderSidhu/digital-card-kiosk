"use client";

import { useCallback, useRef, useState } from "react";
import Webcam from "react-webcam";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  RefreshCw,
  ImageOff,
  ArrowRight,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useWizard } from "@/lib/store";
import { withFallback } from "@/lib/fake-data";
import { buildVcard } from "@/lib/vcard";
import { SectionFrame } from "./section-frame";
import { PrimaryButton, GhostButton } from "../ui";
import { TemplateCard } from "../templates/card-templates";

type Props = {
  state: "idle" | "active" | "done";
};

type PhotoOp = "bg" | "ai" | null;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

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

  // Photo-edit state machine. Only one operation runs at a time.
  const [op, setOp] = useState<PhotoOp>(null);
  const [bgRemoved, setBgRemoved] = useState(false);
  const [aiEnhanced, setAiEnhanced] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);

  // Bumped on every capture / retake / op-start so a stale async result
  // never overwrites a fresher photo.
  const captureIdRef = useRef(0);

  const displayDetails = withFallback(details);
  const qrValue = buildVcard(displayDetails, sessionId);
  const isKiosk = mode === "kiosk";

  const capture = useCallback(() => {
    const dataUrl = webcamRef.current?.getScreenshot();
    if (!dataUrl) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 180);

    captureIdRef.current++;
    setOp(null);
    setBgRemoved(false);
    setAiEnhanced(false);
    setOpError(null);
    setPhoto(dataUrl);
  }, [setPhoto]);

  const retake = useCallback(() => {
    captureIdRef.current++;
    setOp(null);
    setBgRemoved(false);
    setAiEnhanced(false);
    setOpError(null);
    setPhoto(null);
  }, [setPhoto]);

  const handleRemoveBackground = useCallback(() => {
    if (!photo || op !== null || bgRemoved) return;
    const myId = ++captureIdRef.current;
    setOp("bg");
    setOpError(null);
    void (async () => {
      try {
        const { removeBackground } = await import(
          "@imgly/background-removal"
        );
        const blob = await removeBackground(photo);
        if (captureIdRef.current !== myId) return;
        const transparentUrl = await blobToDataUrl(blob);
        if (captureIdRef.current !== myId) return;
        setPhoto(transparentUrl);
        setBgRemoved(true);
      } catch (err) {
        console.warn("Background removal failed:", err);
        if (captureIdRef.current === myId) {
          setOpError("Couldn't remove background — try again");
        }
      } finally {
        if (captureIdRef.current === myId) setOp(null);
      }
    })();
  }, [photo, op, bgRemoved, setPhoto]);

  const handleAiEnhance = useCallback(() => {
    if (!photo || op !== null || aiEnhanced) return;
    const myId = ++captureIdRef.current;
    setOp("ai");
    setOpError(null);
    void (async () => {
      try {
        const res = await fetch("/api/enhance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: photo }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? `Server returned ${res.status}`);
        }
        const data = (await res.json()) as { image?: string };
        if (!data.image) throw new Error("No image returned.");
        if (captureIdRef.current !== myId) return;
        setPhoto(data.image);
        setAiEnhanced(true);
      } catch (err) {
        console.warn("AI enhance failed:", err);
        if (captureIdRef.current === myId) {
          setOpError(
            err instanceof Error ? err.message : "AI enhance failed",
          );
        }
      } finally {
        if (captureIdRef.current === myId) setOp(null);
      }
    })();
  }, [photo, op, aiEnhanced, setPhoto]);

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

  const subtitle = (() => {
    if (!photo) return "Smile! Tap capture when you're ready";
    if (op === "bg") return "Removing the background...";
    if (op === "ai") return "Polishing your headshot with AI...";
    if (opError) return opError;
    return isKiosk
      ? "Looks great — tap Update Info to add your details"
      : "Looks great — tap Continue to add your details";
  })();

  return (
    <SectionFrame
      index={1}
      title="Your live card"
      subtitle={subtitle}
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

            {/* Photo-edit floating buttons — bottom-right of the photo
                column. Anchored via Aurora template percentages so they
                track the photo edge in both modes. */}
            {photo && (
              <div
                className="absolute z-10 flex items-center gap-2"
                style={{ bottom: "5%", right: "70%" }}
              >
                {!aiEnhanced && (
                  <PhotoOpButton
                    label="AI studio polish"
                    icon={<Wand2 size={16} className="text-[#22d3ee]" />}
                    busyIcon={
                      <Loader2 size={16} className="animate-spin text-[#22d3ee]" />
                    }
                    busy={op === "ai"}
                    disabled={op !== null}
                    onClick={handleAiEnhance}
                  />
                )}
                {!bgRemoved && (
                  <PhotoOpButton
                    label="Remove background"
                    icon={<Sparkles size={16} className="text-[#a78bfa]" />}
                    busyIcon={
                      <Loader2 size={16} className="animate-spin text-[#a78bfa]" />
                    }
                    busy={op === "bg"}
                    disabled={op !== null}
                    onClick={handleRemoveBackground}
                  />
                )}
              </div>
            )}

            {/* Inline-on-card overlays only in kiosk mode. */}
            {isKiosk && (
              <AnimatePresence>
                {photo && (
                  <>
                    <motion.button
                      key="retake"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: 0.1 }}
                      onClick={retake}
                      className="absolute top-[4%] left-[4%] z-10 inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/25 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-black/70 active:scale-95 transition"
                    >
                      <RefreshCw size={14} /> Retake
                    </motion.button>

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
              <GhostButton onClick={retake}>
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

function PhotoOpButton({
  label,
  icon,
  busyIcon,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  busyIcon: React.ReactNode;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ delay: 0.15 }}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex items-center justify-center w-9 h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/30 text-white shadow-lg hover:bg-black/75 active:scale-95 transition disabled:opacity-70 disabled:cursor-progress"
    >
      {busy ? busyIcon : icon}
    </motion.button>
  );
}
