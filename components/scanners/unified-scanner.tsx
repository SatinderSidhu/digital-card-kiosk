"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Camera, CheckCircle2, QrCode, Sparkles } from "lucide-react";
import { parseScannedCode } from "@/lib/parse-card";
import { useWizard } from "@/lib/store";
import type { CardDetails } from "@/lib/types";

type Status = "starting" | "watching-qr" | "extracting" | "done" | "error";

type Props = {
  onResult: (partial: Partial<CardDetails>, source: "qr" | "ai") => void;
};

/** Downscale a JPEG data URL so the API request stays small (~75% smaller
 *  for typical webcam frames) without hurting Gemini's ability to read
 *  the card. Returns the original URL if the source is already small. */
async function downscaleDataUrl(
  dataUrl: string,
  maxWidth = 1280,
  quality = 0.85,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.width <= maxWidth) {
        resolve(dataUrl);
        return;
      }
      const ratio = maxWidth / img.width;
      const canvas = document.createElement("canvas");
      canvas.width = maxWidth;
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () =>
      reject(new Error("Could not decode the captured frame."));
    img.src = dataUrl;
  });
}

/**
 * Single camera view that simultaneously:
 *   - continuously scans for QR codes via ZXing (auto-accepts on first hit)
 *   - lets the user tap "Capture card" to extract structured contact data
 *     from the current frame via Gemini 2.5 Flash (server-side route)
 * Whichever resolves first calls `onResult`.
 */
export function UnifiedScanner({ onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraDeviceId = useWizard((s) => s.cameraDeviceId);
  const [status, setStatus] = useState<Status>("starting");
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const stoppedRef = useRef(false);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const detectionStreakRef = useRef(0);
  const missStreakRef = useRef(0);
  const captureCardRef = useRef<() => void>(() => {});

  useEffect(() => {
    stoppedRef.current = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const el = videoRef.current;
        if (!el) return;

        const controls = await reader.decodeFromVideoDevice(
          // Operator-selected camera from the header gear menu, or undefined
          // to let ZXing pick its default.
          cameraDeviceId ?? undefined,
          el,
          (result) => {
            if (result && !stoppedRef.current) {
              stoppedRef.current = true;
              setStatus("done");
              onResult(parseScannedCode(result.getText()), "qr");
              setTimeout(() => controls.stop(), 200);
            }
          },
        );
        controlsRef.current = controls;
        setStatus("watching-qr");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Camera unavailable");
        setStatus("error");
      }
    })();

    return () => {
      stoppedRef.current = true;
      controlsRef.current?.stop();
    };
    // Re-initialise the ZXing reader if the operator switches cameras
    // while the scanner is open.
  }, [onResult, cameraDeviceId]);

  // Auto-capture: watch the live frame for a held-up business card.
  // When a bright, text-edged region fills the centre guide for ~3
  // consecutive samples, kick off a 3-2-1 countdown and trigger the
  // capture. Pulling the card away cancels the countdown.
  useEffect(() => {
    if (status !== "watching-qr") {
      detectionStreakRef.current = 0;
      missStreakRef.current = 0;
      return;
    }

    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 96;
    sampleCanvas.height = 56;
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!sampleCtx) return;

    let cancelled = false;
    let lastSampledAt = 0;
    let raf = 0;

    const looksLikeCard = (video: HTMLVideoElement): boolean => {
      if (!video.videoWidth || !video.videoHeight) return false;
      const w = video.videoWidth;
      const h = video.videoHeight;
      // Sample the inner ~70% of the frame, which roughly matches the
      // 86%-width on-screen guide rectangle.
      const sw = w * 0.7;
      const sh = sw / 1.75;
      if (sh > h * 0.95) return false;
      const sx = (w - sw) / 2;
      const sy = (h - sh) / 2;

      sampleCtx.drawImage(
        video,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        sampleCanvas.width,
        sampleCanvas.height,
      );
      const { data } = sampleCtx.getImageData(
        0,
        0,
        sampleCanvas.width,
        sampleCanvas.height,
      );
      const cw = sampleCanvas.width;
      const chh = sampleCanvas.height;
      const N = cw * chh;

      const grays = new Uint8ClampedArray(N);
      let brightSum = 0;
      for (let i = 0, p = 0; p < N; i += 4, p++) {
        const g = (data[i] * 76 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
        grays[p] = g;
        brightSum += g;
      }
      const meanBright = brightSum / N;

      let edgeCount = 0;
      for (let y = 0; y < chh; y++) {
        for (let x = 1; x < cw; x++) {
          if (Math.abs(grays[y * cw + x] - grays[y * cw + x - 1]) > 25) {
            edgeCount++;
          }
        }
      }
      const edgeRatio = edgeCount / N;

      // Cards are bright (white-ish background) AND have moderate edge
      // density from text. Faces and plain backgrounds fail one or both.
      return meanBright > 145 && edgeRatio > 0.06 && edgeRatio < 0.45;
    };

    const tick = (now: number) => {
      if (cancelled || stoppedRef.current) return;
      if (now - lastSampledAt >= 400) {
        lastSampledAt = now;
        const v = videoRef.current;
        if (v) {
          const detected = looksLikeCard(v);
          if (detected) {
            detectionStreakRef.current += 1;
            missStreakRef.current = 0;
            if (detectionStreakRef.current >= 3) {
              setCountdown((c) => (c === null ? 3 : c));
            }
          } else {
            missStreakRef.current += 1;
            if (missStreakRef.current >= 2) {
              detectionStreakRef.current = 0;
              setCountdown((c) => (c !== null ? null : c));
            }
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [status]);

  // Countdown ticker — 900ms per number, fire capture after "1".
  useEffect(() => {
    if (countdown === null) return;
    const t = window.setTimeout(() => {
      if (countdown <= 1) {
        captureCardRef.current();
        setCountdown(null);
      } else {
        setCountdown((c) => (c === null ? null : c - 1));
      }
    }, 900);
    return () => window.clearTimeout(t);
  }, [countdown]);

  const captureCard = async () => {
    setCountdown(null);
    if (!videoRef.current || stoppedRef.current) return;
    const video = videoRef.current;
    setStatus("extracting");
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const fullDataUrl = canvas.toDataURL("image/jpeg", 0.9);

      // Downscale before sending — saves ~75% payload at no quality cost
      // for card text extraction.
      const dataUrl = await downscaleDataUrl(fullDataUrl, 1280, 0.85);

      const res = await fetch("/api/extract-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Server returned ${res.status}`);
      }
      const data = (await res.json()) as { details?: Partial<CardDetails> };
      if (!data.details) throw new Error("No details returned.");

      if (stoppedRef.current) return;
      stoppedRef.current = true;
      setStatus("done");
      onResult(data.details, "ai");
      setTimeout(() => controlsRef.current?.stop(), 200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read card");
      setStatus("error");
    }
  };

  useEffect(() => {
    captureCardRef.current = captureCard;
  });

  return (
    <div className="relative flex flex-col min-h-0 h-full gap-3">
      <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden glass">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Pulsing landscape-card silhouette tells the user what shape
            to present. Sized for a standard 3.5×2 business card and
            kept centred so a card held at arm's length naturally fills
            it. Hidden once we move past the watching state. */}
        {status === "watching-qr" && (
          <motion.div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.35, 0.9, 0.35] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="relative w-[86%] aspect-[1.75/1] rounded-xl border-2 border-white/80 shadow-[0_0_24px_rgba(34,211,238,0.35)]">
              {/* Corner accents — small brackets in cyan for a subtle
                  "viewfinder" feel on top of the card silhouette. */}
              <span className="absolute -top-px -left-px h-4 w-4 border-t-2 border-l-2 border-[#22d3ee] rounded-tl-xl" />
              <span className="absolute -top-px -right-px h-4 w-4 border-t-2 border-r-2 border-[#22d3ee] rounded-tr-xl" />
              <span className="absolute -bottom-px -left-px h-4 w-4 border-b-2 border-l-2 border-[#22d3ee] rounded-bl-xl" />
              <span className="absolute -bottom-px -right-px h-4 w-4 border-b-2 border-r-2 border-[#22d3ee] rounded-br-xl" />
            </div>
          </motion.div>
        )}

        {status === "watching-qr" && (
          <motion.div
            initial={{ y: "-100%" }}
            animate={{ y: "100%" }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
            className="pointer-events-none absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#22d3ee] to-transparent"
            style={{ top: 0 }}
          />
        )}

        {status === "watching-qr" && countdown === null && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.3 }}
            className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/55 backdrop-blur-sm text-[11px] font-medium text-white/90 ring-1 ring-white/15"
          >
            Hold a business card or QR code here
          </motion.div>
        )}

        <AnimatePresence>
          {status === "extracting" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 flex items-center justify-center overflow-hidden"
            >
              {/* Diagonal shimmer sweep, mirrors the photo-section magic
                  treatment so the kiosk has a consistent "AI working" feel. */}
              <motion.div
                className="absolute inset-y-0 w-1/2 -skew-x-12 pointer-events-none"
                initial={{ x: "-150%" }}
                animate={{ x: "300%" }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.45) 50%, transparent 100%)",
                  filter: "blur(8px)",
                }}
              />
              <div className="relative flex flex-col items-center gap-2 text-center px-4">
                <div className="relative">
                  <Sparkles
                    size={36}
                    className="text-[#a78bfa] drop-shadow-[0_0_12px_rgba(167,139,250,0.95)]"
                  />
                  <Loader2
                    className="absolute -bottom-1 -right-1 animate-spin text-[#22d3ee]"
                    size={18}
                  />
                </div>
                <p className="text-sm font-medium text-white">
                  Reading the card with AI...
                </p>
                <p className="text-[11px] text-white/60">
                  Hold steady — Gemini is extracting the fields
                </p>
              </div>
            </motion.div>
          )}
          {status === "done" && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 flex items-center justify-center"
            >
              <CheckCircle2 size={72} className="text-emerald-400" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auto-capture countdown — pulses each number in/out so a
            held-still card gets captured cleanly without the user
            hunting for the button. */}
        <AnimatePresence mode="wait">
          {countdown !== null && status === "watching-qr" && (
            <motion.div
              key={countdown}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.7, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-black/30" />
              <span className="relative text-[120px] font-black text-white drop-shadow-[0_0_30px_rgba(34,211,238,0.95)] leading-none">
                {countdown}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error ? (
        <div className="flex items-start gap-2">
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setStatus("watching-qr");
            }}
            className="text-xs text-white/70 underline underline-offset-4 hover:text-white shrink-0"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-none">
          <div className="flex items-center gap-2 text-xs text-white/60 flex-1 min-w-0">
            <QrCode size={14} className="text-[#22d3ee] shrink-0" />
            <span className="truncate">
              {status === "extracting"
                ? "Reading the card with AI..."
                : status === "done"
                  ? "Got it!"
                  : countdown !== null
                    ? `Hold steady — capturing in ${countdown}...`
                    : "Auto-scanning — hold a card or QR code in the box"}
            </span>
          </div>
          <button
            onClick={captureCard}
            disabled={status === "extracting" || status === "done"}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold bg-white/10 border border-white/15 hover:bg-white/15 disabled:opacity-60 shrink-0"
          >
            <Camera size={16} /> Capture card
          </button>
        </div>
      )}
    </div>
  );
}
