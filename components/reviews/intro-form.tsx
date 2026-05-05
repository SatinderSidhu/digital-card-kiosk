"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Video, ChevronDown, Check } from "lucide-react";
import clsx from "clsx";
import { useReview } from "@/lib/review-store";
import { REVIEW_QUESTIONS, REVIEW_TOTAL_SECONDS } from "@/lib/review-questions";
import { PrimaryButton, Field, TextInput } from "../ui";

type Device = { deviceId: string; label: string };

export function IntroForm() {
  const name = useReview((s) => s.name);
  const title = useReview((s) => s.title);
  const email = useReview((s) => s.email);
  const cameraDeviceId = useReview((s) => s.cameraDeviceId);
  const setName = useReview((s) => s.setName);
  const setTitle = useReview((s) => s.setTitle);
  const setEmail = useReview((s) => s.setEmail);
  const setCameraDeviceId = useReview((s) => s.setCameraDeviceId);
  const setPhase = useReview((s) => s.setPhase);

  const [devices, setDevices] = useState<Device[]>([]);
  const [showDevices, setShowDevices] = useState(false);

  // Ask once for permission so device labels populate. Without this the
  // dropdown shows "Camera abc123…" anonymous IDs.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        stream.getTracks().forEach((t) => t.stop());
        const all = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        const videos = all
          .filter((d) => d.kind === "videoinput")
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Camera ${d.deviceId.slice(0, 6)}`,
          }));
        setDevices(videos);
      } catch {
        // permission denied or no devices — start button is disabled below
        // until the user retries via the browser permission UI.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canStart = name.trim().length >= 2 && emailValid;

  const totalMin = Math.ceil(REVIEW_TOTAL_SECONDS / 60);
  const selectedLabel =
    devices.find((d) => d.deviceId === cameraDeviceId)?.label ??
    "Default camera";

  return (
    <div className="flex flex-col gap-5 px-6 py-6 max-w-[460px] mx-auto w-full">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#7c5cff] to-[#22d3ee] grid place-items-center">
          <Video size={22} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-shimmer">
          Share a video review
        </h1>
        <p className="text-sm text-white/55 max-w-[340px]">
          {REVIEW_QUESTIONS.length} quick questions, about {totalMin} minutes
          total. We&apos;ll email you a copy when you&apos;re done.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Field label="Your name">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First and last"
            autoComplete="name"
          />
        </Field>
        <Field label="Title / role" hint="Shown on the lower-third overlay">
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="CEO, Acme Co."
            autoComplete="organization-title"
          />
        </Field>
        <Field label="Email">
          <TextInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </Field>

        <div className="relative">
          <button
            onClick={() => setShowDevices((o) => !o)}
            className="w-full flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-left hover:bg-white/10 transition-colors"
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <Camera size={16} className="text-[#22d3ee] shrink-0" />
              <span className="flex flex-col min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-white/45">
                  Camera
                </span>
                <span className="text-sm text-white/85 truncate">
                  {selectedLabel}
                </span>
              </span>
            </span>
            <ChevronDown
              size={16}
              className={clsx(
                "text-white/45 transition-transform",
                showDevices && "rotate-180",
              )}
            />
          </button>

          {showDevices && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute z-20 left-0 right-0 top-full mt-1.5 rounded-xl glass p-1.5 shadow-2xl max-h-64 overflow-auto"
            >
              <DeviceOption
                label="Default camera"
                selected={cameraDeviceId === null}
                onSelect={() => {
                  setCameraDeviceId(null);
                  setShowDevices(false);
                }}
              />
              {devices.map((d) => (
                <DeviceOption
                  key={d.deviceId}
                  label={d.label}
                  selected={cameraDeviceId === d.deviceId}
                  onSelect={() => {
                    setCameraDeviceId(d.deviceId);
                    setShowDevices(false);
                  }}
                />
              ))}
              {devices.length === 0 && (
                <p className="text-[11px] text-white/45 px-3 py-3">
                  Allow camera access in your browser to see device options.
                </p>
              )}
            </motion.div>
          )}
        </div>
      </div>

      <PrimaryButton
        onClick={() => setPhase("recording")}
        disabled={!canStart}
        className="mt-2 w-full"
      >
        <Video size={18} /> Start recording
      </PrimaryButton>

      <p className="text-[11px] text-white/40 text-center px-4 leading-relaxed">
        By tapping Start, you consent to being recorded. Your review will be
        stored and emailed to the address above.
      </p>
    </div>
  );
}

function DeviceOption({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={clsx(
        "flex items-center gap-2 w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
        selected ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5",
      )}
    >
      <span className="w-3 h-3 rounded-full border border-white/30 grid place-items-center shrink-0">
        {selected && <Check size={9} className="text-[#22d3ee]" />}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}
