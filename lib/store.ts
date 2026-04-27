"use client";

import { create } from "zustand";
import { type CardDetails, type TemplateId, emptyCard } from "./types";

export type Step = 0 | 1 | 2 | 3;
export type Mode = "kiosk" | "compact";

const MODE_STORAGE_KEY = "digital-card-kiosk:mode";
const CAMERA_STORAGE_KEY = "digital-card-kiosk:camera-device-id";

type State = {
  step: Step;
  mode: Mode;
  photoDataUrl: string | null;
  details: CardDetails;
  template: TemplateId | null;
  sessionId: string;
  /** Selected camera deviceId (from MediaDevices.enumerateDevices). null
   *  means "let the browser choose" — we then fall back to facingMode
   *  hints (front for capture, rear for scanner). */
  cameraDeviceId: string | null;

  ensureSession: () => void;
  initMode: () => void;
  initCamera: () => void;
  setMode: (m: Mode) => void;
  setCameraDeviceId: (id: string | null) => void;
  setStep: (s: Step) => void;
  next: () => void;
  back: () => void;
  setPhoto: (dataUrl: string | null) => void;
  setDetails: (patch: Partial<CardDetails>) => void;
  replaceDetails: (next: CardDetails) => void;
  setTemplate: (t: TemplateId | null) => void;
  reset: () => void;
};

function newSessionId() {
  return Math.random().toString(36).slice(2, 10);
}

function detectInitialMode(): Mode {
  if (typeof window === "undefined") return "kiosk";

  // 1. URL param (?mode=kiosk | ?mode=compact)
  const urlMode = new URLSearchParams(window.location.search).get("mode");
  if (urlMode === "kiosk" || urlMode === "compact") return urlMode;

  // 2. localStorage preference
  try {
    const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (stored === "kiosk" || stored === "compact") return stored;
  } catch {
    // localStorage may be unavailable (privacy mode); fall through.
  }

  // 3. Viewport orientation — taller-than-wide ⇒ kiosk display.
  if (window.matchMedia("(orientation: portrait)").matches) return "kiosk";
  return "compact";
}

export const useWizard = create<State>((set, get) => ({
  step: 0,
  // Default deterministic for SSR; resolved by initMode() on mount.
  mode: "kiosk",
  photoDataUrl: null,
  details: { ...emptyCard },
  template: null,
  // Same SSR-safety pattern as `mode` — populated on mount.
  sessionId: "",
  cameraDeviceId: null,

  ensureSession: () => {
    if (!get().sessionId) set({ sessionId: newSessionId() });
  },
  initMode: () => {
    set({ mode: detectInitialMode() });
  },
  initCamera: () => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(CAMERA_STORAGE_KEY);
      if (stored) set({ cameraDeviceId: stored });
    } catch {
      // localStorage may be unavailable; keep the SSR-safe null default.
    }
  },
  setMode: (m) => {
    set({ mode: m });
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(MODE_STORAGE_KEY, m);
      } catch {
        // ignore
      }
    }
  },
  setCameraDeviceId: (id) => {
    set({ cameraDeviceId: id });
    if (typeof window !== "undefined") {
      try {
        if (id) window.localStorage.setItem(CAMERA_STORAGE_KEY, id);
        else window.localStorage.removeItem(CAMERA_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  },
  setStep: (s) => set({ step: s }),
  next: () => {
    const s = get().step;
    if (s < 3) set({ step: (s + 1) as Step });
  },
  back: () => {
    const s = get().step;
    if (s > 0) set({ step: (s - 1) as Step });
  },
  setPhoto: (dataUrl) => set({ photoDataUrl: dataUrl }),
  setDetails: (patch) => set((st) => ({ details: { ...st.details, ...patch } })),
  replaceDetails: (next) => set({ details: next }),
  setTemplate: (t) => set({ template: t }),
  reset: () =>
    set({
      step: 0,
      photoDataUrl: null,
      details: { ...emptyCard },
      template: null,
      sessionId: newSessionId(),
    }),
}));
