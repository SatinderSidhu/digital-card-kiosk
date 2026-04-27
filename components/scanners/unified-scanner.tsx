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
  const stoppedRef = useRef(false);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

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

  const captureCard = async () => {
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

        {status === "watching-qr" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
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
                  : "Auto-scanning for a QR code..."}
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
