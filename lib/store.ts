"use client";

import { create } from "zustand";
import { type CardDetails, type TemplateId, emptyCard } from "./types";

export type Step = 0 | 1 | 2 | 3;

type State = {
  step: Step;
  photoDataUrl: string | null;
  details: CardDetails;
  template: TemplateId | null;
  sessionId: string;

  ensureSession: () => void;
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

export const useWizard = create<State>((set, get) => ({
  step: 0,
  photoDataUrl: null,
  details: { ...emptyCard },
  template: null,
  // Must stay deterministic for SSR hydration; populated by ensureSession on mount.
  sessionId: "",

  ensureSession: () => {
    if (!get().sessionId) set({ sessionId: newSessionId() });
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
