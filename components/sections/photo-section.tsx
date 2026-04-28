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
  SkipForward,
} from "lucide-react";
import { useWizard } from "@/lib/store";
import { withFallback } from "@/lib/fake-data";
import { buildVcard } from "@/lib/vcard";
import { SectionFrame } from "./section-frame";
import { PrimaryButton, GhostButton } from "../ui";
import { TemplateCard } from "../templates/card-templates";
import { OrientationPills } from "../orientation-pills";

// Experimental: surface a Landscape / Portrait picker at step 1 so
// the user can preview the orientation right away and skip ahead with
// it pre-selected for step 3. Flip to false (or delete the pills block
// + this flag + the OrientationPills import) to roll the experiment
// back with no other code touched.
const EXPERIMENTAL_ORIENTATION_AT_STEP_1 = true;

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
  const cameraDeviceId = useWizard((s) => s.cameraDeviceId);
  const template = useWizard((s) => s.template);
  const setTemplate = useWizard((s) => s.setTemplate);
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
        screenshotQuality={0.95}
        // Crucial: by default, getScreenshot() sizes the canvas to the video
        // element's *display* size (~420 px wide here), discarding the
        // camera's actual HD resolution. forceScreenshotSourceSize tells it
        // to capture at videoWidth × videoHeight instead, matching what the
        // live preview is showing.
        forceScreenshotSourceSize
        // If the operator picked a specific camera in the header gear menu,
        // honour that exactly. Otherwise fall back to the front-facing hint
        // (relevant on phones; on a laptop it just picks a default).
        videoConstraints={{
          ...(cameraDeviceId
            ? { deviceId: { exact: cameraDeviceId } }
            : { facingMode: "user" }),
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }}
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
              template={
                EXPERIMENTAL_ORIENTATION_AT_STEP_1 ? template ?? "aurora" : "aurora"
              }
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

            {/* "Magic happening" overlay over the photo column while either
                AI enhance or bg removal is processing — shimmer sweep,
                floating sparkles, glowing border. */}
            <AnimatePresence>
              {photo && op !== null && <MagicOverlay op={op} />}
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

        <div className="flex-none flex items-center justify-center gap-3 flex-wrap">
          {photo ? (
            !isKiosk && (
              <GhostButton onClick={retake}>
                <RefreshCw size={18} /> Retake
              </GhostButton>
            )
          ) : (
            <>
              <PrimaryButton onClick={capture} disabled={!ready} className="px-10">
                <Camera size={20} /> Capture
              </PrimaryButton>
              <GhostButton onClick={next} title="Continue without a photo">
                <SkipForward size={16} /> Skip photo
              </GhostButton>
            </>
          )}
        </div>

        {EXPERIMENTAL_ORIENTATION_AT_STEP_1 && (
          <div className="flex-none flex flex-col items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-white/45">
              Card style
            </span>
            <OrientationPills template={template} onChange={setTemplate} />
          </div>
        )}
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

/**
 * Animated overlay shown over the photo column while an AI / bg-removal
 * operation is in flight. Tints toward cyan for AI, lavender for bg. Combines
 * a diagonal shimmer sweep, a few floating sparkles, and a pulsing glow
 * border for an unmistakable "magic happening" feel.
 *
 * Position uses Aurora's photo column percentages: left 3% / top 3% /
 * bottom 3% / right 67% (= 33% from card-left, the photo column edge).
 */
function MagicOverlay({ op }: { op: PhotoOp }) {
  const isAi = op === "ai";
  const primary = isAi ? "rgba(34, 211, 238, 0.55)" : "rgba(167, 139, 250, 0.55)";
  const secondary = isAi
    ? "rgba(124, 92, 255, 0.45)"
    : "rgba(34, 211, 238, 0.45)";
  const sparkleColor = isAi ? "text-cyan-300" : "text-violet-300";
  const sparkleGlow = isAi
    ? "drop-shadow-[0_0_10px_rgba(34,211,238,0.95)]"
    : "drop-shadow-[0_0_10px_rgba(167,139,250,0.95)]";

  const sparkles = [
    { x: "18%", y: "12%", delay: 0, size: 22 },
    { x: "72%", y: "28%", delay: 0.4, size: 18 },
    { x: "32%", y: "55%", delay: 0.9, size: 26 },
    { x: "68%", y: "72%", delay: 1.3, size: 20 },
    { x: "20%", y: "88%", delay: 1.8, size: 16 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute z-10 pointer-events-none rounded-2xl overflow-hidden"
      style={{ left: "3%", right: "67%", top: "3%", bottom: "3%" }}
    >
      {/* Backdrop tint so the photo dims slightly while the magic runs. */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.35) 100%)",
        }}
      />

      {/* Pulsing glow border. */}
      <motion.div
        className="absolute inset-0 rounded-2xl"
        animate={{
          boxShadow: [
            `inset 0 0 24px ${primary}`,
            `inset 0 0 56px ${secondary}`,
            `inset 0 0 24px ${primary}`,
          ],
        }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Diagonal shimmer sweep. */}
      <motion.div
        className="absolute inset-y-0 w-1/2 -skew-x-12"
        initial={{ x: "-150%" }}
        animate={{ x: "300%" }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${primary} 50%, transparent 100%)`,
          filter: "blur(8px)",
        }}
      />

      {/* Floating sparkles. */}
      {sparkles.map((s, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: s.x, top: s.y }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1.1, 0],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 2,
            delay: s.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Sparkles size={s.size} className={`${sparkleColor} ${sparkleGlow}`} />
        </motion.div>
      ))}
    </motion.div>
  );
}
