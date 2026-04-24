"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { parseScannedCode } from "@/lib/parse-card";
import type { CardDetails } from "@/lib/types";

type Props = {
  onResult: (partial: Partial<CardDetails>, rawText: string) => void;
};

export function QRScanner({ onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let stopped = false;
    let controls: { stop: () => void } | null = null;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const el = videoRef.current;
        if (!el) return;
        controls = await reader.decodeFromVideoDevice(undefined, el, (result) => {
          if (result && !stopped) {
            stopped = true;
            const text = result.getText();
            setDone(true);
            onResult(parseScannedCode(text), text);
            setTimeout(() => controls?.stop(), 200);
          }
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Camera unavailable");
      }
    })();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [onResult]);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden glass">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative w-56 h-56">
            <Corner pos="tl" />
            <Corner pos="tr" />
            <Corner pos="bl" />
            <Corner pos="br" />
            <motion.div
              initial={{ y: 0 }}
              animate={{ y: "14rem" }}
              transition={{ duration: 1.6, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
              className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#22d3ee] to-transparent"
            />
          </div>
        </div>
        <AnimatePresence>
          {done && (
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
      {error && <p className="text-sm text-red-300">{error}</p>}
      <p className="text-center text-xs text-white/50">
        Point the rear camera at a QR code — it will auto-capture.
      </p>
    </div>
  );
}

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const map = {
    tl: "top-0 left-0 border-l-4 border-t-4 rounded-tl-xl",
    tr: "top-0 right-0 border-r-4 border-t-4 rounded-tr-xl",
    bl: "bottom-0 left-0 border-l-4 border-b-4 rounded-bl-xl",
    br: "bottom-0 right-0 border-r-4 border-b-4 rounded-br-xl",
  }[pos];
  return <div className={`absolute w-8 h-8 border-[#22d3ee] ${map}`} />;
}
