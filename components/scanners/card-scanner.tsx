"use client";

import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { motion, AnimatePresence } from "framer-motion";
import { ScanLine, Loader2, CheckCircle2 } from "lucide-react";
import { parseCardText } from "@/lib/parse-card";
import { type CardDetails } from "@/lib/types";

type Props = {
  onResult: (partial: Partial<CardDetails>, rawText: string) => void;
};

export function CardScanner({ onResult }: Props) {
  const webcamRef = useRef<Webcam>(null);
  const [status, setStatus] = useState<"idle" | "scanning" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const scan = async () => {
    const dataUrl = webcamRef.current?.getScreenshot();
    if (!dataUrl) return;
    setStatus("scanning");
    setProgress(0);
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const { data } = await Tesseract.recognize(dataUrl, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      const parsed = parseCardText(data.text || "");
      setStatus("done");
      onResult(parsed, data.text || "");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Scan failed");
    }
  };

  useEffect(() => {
    if (status === "done") {
      const t = setTimeout(() => setStatus("idle"), 1200);
      return () => clearTimeout(t);
    }
  }, [status]);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden glass">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={{ facingMode: "environment" }}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-white/40" />
        {status === "scanning" && (
          <motion.div
            initial={{ y: "-100%" }}
            animate={{ y: "100%" }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
            className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#22d3ee] to-transparent"
            style={{ top: 0 }}
          />
        )}
        <AnimatePresence>
          {status === "done" && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/40"
            >
              <CheckCircle2 size={72} className="text-emerald-400" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {errorMsg && <p className="text-sm text-red-300">{errorMsg}</p>}

      <button
        onClick={scan}
        disabled={status === "scanning"}
        className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 font-semibold text-white bg-white/10 border border-white/15 hover:bg-white/15 disabled:opacity-60"
      >
        {status === "scanning" ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Scanning {progress}%
          </>
        ) : (
          <>
            <ScanLine size={18} /> Scan business card
          </>
        )}
      </button>
    </div>
  );
}
