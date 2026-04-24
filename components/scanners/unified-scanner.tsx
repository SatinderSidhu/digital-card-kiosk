"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Camera, CheckCircle2, QrCode } from "lucide-react";
import { parseScannedCode, parseCardText } from "@/lib/parse-card";
import type { CardDetails } from "@/lib/types";

type Status = "starting" | "watching-qr" | "running-ocr" | "done" | "error";

type Props = {
  onResult: (partial: Partial<CardDetails>, source: "qr" | "ocr") => void;
};

/**
 * Single camera view that simultaneously:
 *   - continuously scans for QR codes via ZXing (auto-accepts on first hit)
 *   - lets the user tap "Capture card" to OCR the current frame via Tesseract
 * Whichever resolves first calls `onResult`.
 */
export function UnifiedScanner({ onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [progress, setProgress] = useState(0);
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

        const controls = await reader.decodeFromVideoDevice(undefined, el, (result) => {
          if (result && !stoppedRef.current) {
            stoppedRef.current = true;
            setStatus("done");
            onResult(parseScannedCode(result.getText()), "qr");
            setTimeout(() => controls.stop(), 200);
          }
        });
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
  }, [onResult]);

  const captureForOCR = async () => {
    if (!videoRef.current || stoppedRef.current) return;
    const video = videoRef.current;
    setStatus("running-ocr");
    setProgress(0);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

      const Tesseract = (await import("tesseract.js")).default;
      const { data } = await Tesseract.recognize(dataUrl, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      if (stoppedRef.current) return;
      stoppedRef.current = true;
      setStatus("done");
      onResult(parseCardText(data.text || ""), "ocr");
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

        <div className="pointer-events-none absolute inset-4 rounded-2xl border-2 border-white/35" />

        {status === "watching-qr" && (
          <motion.div
            initial={{ y: "-100%" }}
            animate={{ y: "100%" }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
            className="pointer-events-none absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#22d3ee] to-transparent"
            style={{ top: 0 }}
          />
        )}

        <AnimatePresence>
          {status === "running-ocr" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/55 flex items-center justify-center"
            >
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-[#22d3ee]" size={40} />
                <p className="text-sm text-white">Reading card... {progress}%</p>
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
        <p className="text-sm text-red-300">{error}</p>
      ) : (
        <div className="flex items-center gap-2 flex-none">
          <div className="flex items-center gap-2 text-xs text-white/60 flex-1 min-w-0">
            <QrCode size={14} className="text-[#22d3ee] shrink-0" />
            <span className="truncate">
              {status === "running-ocr"
                ? "Reading card..."
                : status === "done"
                  ? "Got it!"
                  : "Auto-scanning for a QR code..."}
            </span>
          </div>
          <button
            onClick={captureForOCR}
            disabled={status === "running-ocr" || status === "done"}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold bg-white/10 border border-white/15 hover:bg-white/15 disabled:opacity-60 shrink-0"
          >
            <Camera size={16} /> Capture card
          </button>
        </div>
      )}
    </div>
  );
}
