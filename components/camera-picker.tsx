"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Camera, Check } from "lucide-react";
import clsx from "clsx";
import { useWizard } from "@/lib/store";

type Device = {
  deviceId: string;
  label: string;
};

export function CameraPicker() {
  const cameraDeviceId = useWizard((s) => s.cameraDeviceId);
  const setCameraDeviceId = useWizard((s) => s.setCameraDeviceId);

  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [labelsMissing, setLabelsMissing] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Enumerate devices when the popover opens (and on devicechange events
  // while it's open, so unplugging / plugging a USB cam updates live).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const enumerate = async () => {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        const videos = all
          .filter((d) => d.kind === "videoinput")
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Camera ${d.deviceId.slice(0, 6) || "(unknown)"}`,
          }));
        setDevices(videos);
        setLabelsMissing(
          videos.length > 0 && videos.every((d) => !d.label.includes(" ")),
        );
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not list cameras",
        );
      }
    };

    void enumerate();
    navigator.mediaDevices.addEventListener("devicechange", enumerate);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener("devicechange", enumerate);
    };
  }, [open]);

  // Optional one-shot permission prompt to populate device labels. Only used
  // if the user explicitly clicks "Show camera names" — we don't want to
  // auto-prompt for permission just because they opened the picker.
  const requestLabels = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      const all = await navigator.mediaDevices.enumerateDevices();
      const videos = all
        .filter((d) => d.kind === "videoinput")
        .map((d) => ({ deviceId: d.deviceId, label: d.label }));
      setDevices(videos);
      setLabelsMissing(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Camera permission denied",
      );
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Camera"
        aria-label="Camera settings"
        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
      >
        <Settings size={14} className="text-white/70" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-30 w-72 rounded-2xl glass p-3 shadow-2xl"
          >
            <div className="flex items-center gap-2 mb-2">
              <Camera size={14} className="text-[#22d3ee]" />
              <h3 className="text-sm font-semibold">Camera</h3>
            </div>

            {error && (
              <p className="text-xs text-red-300 mb-2 px-1">{error}</p>
            )}

            <div className="flex flex-col gap-1 max-h-64 overflow-auto">
              <CameraOption
                label="Use default"
                hint="Browser picks based on the page"
                selected={cameraDeviceId === null}
                onSelect={() => {
                  setCameraDeviceId(null);
                  setOpen(false);
                }}
              />
              {devices.length === 0 ? (
                <p className="text-[11px] text-white/45 px-2 py-3">
                  No cameras detected yet. Tap Capture once to grant
                  permission, then reopen this menu.
                </p>
              ) : (
                devices.map((d) => (
                  <CameraOption
                    key={d.deviceId || d.label}
                    label={d.label}
                    selected={cameraDeviceId === d.deviceId}
                    onSelect={() => {
                      setCameraDeviceId(d.deviceId);
                      setOpen(false);
                    }}
                  />
                ))
              )}
            </div>

            {labelsMissing && (
              <button
                onClick={requestLabels}
                className="mt-2 w-full text-[11px] text-white/55 hover:text-white/80 underline underline-offset-4"
              >
                Show camera names (asks for permission)
              </button>
            )}

            <p className="mt-2 text-[10px] text-white/35 px-1">
              Saved to this browser. Applies to capture and card scan.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CameraOption({
  label,
  hint,
  selected,
  onSelect,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={clsx(
        "flex items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors w-full",
        selected ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5",
      )}
    >
      <span className="w-3 h-3 rounded-full border border-white/30 flex items-center justify-center mt-0.5 shrink-0">
        {selected && <Check size={9} className="text-[#22d3ee]" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {hint && (
          <span className="block text-white/40 text-[10px]">{hint}</span>
        )}
      </span>
    </button>
  );
}
