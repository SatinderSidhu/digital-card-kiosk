"use client";

import { useCallback, useRef, useState } from "react";
import Webcam from "react-webcam";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  RefreshCw,
  ImageOff,
  Loader2,
  Sparkles,
  Wand2,
  Undo2,
  Trash2,
} from "lucide-react";
import { AiPolishMenu, type PolishStyle } from "./ai-polish-menu";

type PhotoOp = "bg" | "ai" | null;

type Props = {
  /** Current photo as a data URL (or an https URL for an already-uploaded
   *  photo — in which case "remove background" / undo start from there). */
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  /** Selected camera deviceId (from MediaDevices). null ⇒ browser default
   *  with a front-facing hint. */
  cameraDeviceId?: string | null;
  /** Aspect ratio of the capture box. Default 4:3. */
  aspect?: string;
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Standalone photo-capture widget — webcam capture + AI studio polish
 * (Gemini, via /api/enhance) + in-browser background removal
 * (@imgly/background-removal) + an undo stack. Same machinery as the
 * kiosk's step-1 photo column, but with a plain value/onChange interface
 * so it can be dropped into the manage page (or anywhere else).
 */
export function PhotoCapture({
  value,
  onChange,
  cameraDeviceId,
  aspect = "aspect-[4/3]",
}: Props) {
  const webcamRef = useRef<Webcam>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const [op, setOp] = useState<PhotoOp>(null);
  const [bgRemoved, setBgRemoved] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);
  const [polishMenuOpen, setPolishMenuOpen] = useState(false);

  // Undo stack of previous data URLs. Cleared on capture / retake.
  const historyRef = useRef<string[]>([]);
  const [historyDepth, setHistoryDepth] = useState(0);
  // Bumped on every capture / retake / op-start so a stale async result
  // never overwrites a fresher photo.
  const captureIdRef = useRef(0);

  const pushHistory = useCallback((url: string) => {
    historyRef.current.push(url);
    setHistoryDepth(historyRef.current.length);
  }, []);

  const resetEditState = useCallback(() => {
    captureIdRef.current++;
    setOp(null);
    setBgRemoved(false);
    setOpError(null);
    historyRef.current = [];
    setHistoryDepth(0);
  }, []);

  const capture = useCallback(() => {
    const dataUrl = webcamRef.current?.getScreenshot();
    if (!dataUrl) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    resetEditState();
    onChange(dataUrl);
  }, [onChange, resetEditState]);

  const retake = useCallback(() => {
    resetEditState();
    onChange(null);
  }, [onChange, resetEditState]);

  const handleUndo = useCallback(() => {
    const previous = historyRef.current.pop();
    if (!previous) return;
    setHistoryDepth(historyRef.current.length);
    captureIdRef.current++;
    setOp(null);
    setOpError(null);
    setBgRemoved(false);
    onChange(previous);
  }, [onChange]);

  const handleRemoveBackground = useCallback(() => {
    if (!value || op !== null || bgRemoved) return;
    const previous = value;
    const myId = ++captureIdRef.current;
    setOp("bg");
    setOpError(null);
    void (async () => {
      try {
        const { removeBackground } = await import("@imgly/background-removal");
        const blob = await removeBackground(value);
        if (captureIdRef.current !== myId) return;
        const transparentUrl = await blobToDataUrl(blob);
        if (captureIdRef.current !== myId) return;
        pushHistory(previous);
        onChange(transparentUrl);
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
  }, [value, op, bgRemoved, onChange, pushHistory]);

  const handleAiEnhance = useCallback(
    (style?: PolishStyle) => {
      if (!value || op !== null) return;
      const previous = value;
      const myId = ++captureIdRef.current;
      setOp("ai");
      setOpError(null);
      void (async () => {
        try {
          const res = await fetch("/api/enhance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: value, style }),
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
          pushHistory(previous);
          onChange(data.image);
        } catch (err) {
          console.warn("AI enhance failed:", err);
          if (captureIdRef.current === myId) {
            setOpError(err instanceof Error ? err.message : "AI enhance failed");
          }
        } finally {
          if (captureIdRef.current === myId) setOp(null);
        }
      })();
    },
    [value, op, onChange, pushHistory],
  );

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`relative w-full ${aspect} rounded-2xl overflow-hidden border border-white/10 bg-black`}
      >
        {!value && !error && (
          <Webcam
            ref={webcamRef}
            audio={false}
            mirrored
            screenshotFormat="image/jpeg"
            screenshotQuality={0.95}
            forceScreenshotSourceSize
            videoConstraints={{
              ...(cameraDeviceId
                ? { deviceId: { exact: cameraDeviceId } }
                : { facingMode: "user" }),
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            }}
            onUserMedia={() => setReady(true)}
            onUserMediaError={(e) =>
              setError(
                typeof e === "string" ? e : e?.message ?? "Permission denied",
              )
            }
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {!value && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-3">
            <ImageOff size={22} className="text-white/55" />
            <p className="text-[11px] text-white/70">Camera unavailable</p>
          </div>
        )}
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Your photo"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        <AnimatePresence>
          {flash && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white pointer-events-none"
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {value && op !== null && <MagicOverlay op={op} />}
        </AnimatePresence>

        <AnimatePresence>
          {polishMenuOpen && value && op === null && (
            <AiPolishMenu
              onApply={(style) => {
                setPolishMenuOpen(false);
                handleAiEnhance(style);
              }}
              onClose={() => setPolishMenuOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {!value ? (
          <button
            onClick={capture}
            disabled={!ready}
            className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-[#7c5cff] via-[#8b5cf6] to-[#22d3ee] shadow-[0_8px_28px_-10px_rgba(124,92,255,0.7)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Camera size={18} /> Take photo
          </button>
        ) : (
          <>
            <PhotoOpButton
              label="Retake"
              icon={<RefreshCw size={15} />}
              onClick={retake}
              disabled={op !== null}
            />
            <PhotoOpButton
              label={op === "ai" ? "Polishing…" : "AI studio polish"}
              icon={
                op === "ai" ? (
                  <Loader2 size={15} className="animate-spin text-[#22d3ee]" />
                ) : (
                  <Wand2 size={15} className="text-[#22d3ee]" />
                )
              }
              onClick={() => setPolishMenuOpen(true)}
              disabled={op !== null}
            />
            {!bgRemoved && (
              <PhotoOpButton
                label={op === "bg" ? "Removing…" : "Remove background"}
                icon={
                  op === "bg" ? (
                    <Loader2 size={15} className="animate-spin text-[#a78bfa]" />
                  ) : (
                    <Sparkles size={15} className="text-[#a78bfa]" />
                  )
                }
                onClick={handleRemoveBackground}
                disabled={op !== null}
              />
            )}
            {historyDepth > 0 && op === null && (
              <PhotoOpButton
                label={`Undo (${historyDepth})`}
                icon={<Undo2 size={15} />}
                onClick={handleUndo}
                disabled={false}
              />
            )}
            <PhotoOpButton
              label="Remove photo"
              icon={<Trash2 size={15} className="text-red-300" />}
              onClick={() => {
                resetEditState();
                onChange(null);
              }}
              disabled={op !== null}
            />
          </>
        )}
      </div>

      {opError && (
        <p className="text-xs text-red-300 text-center">{opError}</p>
      )}
    </div>
  );
}

function PhotoOpButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-white/85 bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {icon} {label}
    </button>
  );
}

/** "Magic happening" overlay shown over the photo while AI / bg removal
 *  runs — shimmer sweep + floating sparkles + glowing border. Tints cyan
 *  for AI, lavender for background removal. */
function MagicOverlay({ op }: { op: PhotoOp }) {
  const isAi = op === "ai";
  const primary = isAi ? "rgba(34,211,238,0.55)" : "rgba(167,139,250,0.55)";
  const secondary = isAi ? "rgba(124,92,255,0.45)" : "rgba(34,211,238,0.45)";
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
      className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-2xl"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.35) 100%)",
        }}
      />
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
