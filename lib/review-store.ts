"use client";

import { create } from "zustand";

export type ReviewPhase = "intro" | "recording" | "playback" | "done";
export type VideoSize = "S" | "M" | "L";

const CAMERA_STORAGE_KEY = "digital-card-kiosk:camera-device-id";

type State = {
  phase: ReviewPhase;
  sessionId: string;
  name: string;
  title: string;
  email: string;
  cameraDeviceId: string | null;
  videoSize: VideoSize;
  videoBlob: Blob | null;
  videoUrl: string | null;
  videoMimeType: string | null;
  uploadError: string | null;

  ensureSession: () => void;
  initCamera: () => void;
  setCameraDeviceId: (id: string | null) => void;
  setVideoSize: (s: VideoSize) => void;
  setName: (name: string) => void;
  setTitle: (title: string) => void;
  setEmail: (email: string) => void;
  setPhase: (phase: ReviewPhase) => void;
  setRecording: (blob: Blob, mimeType: string) => void;
  clearRecording: () => void;
  setUploadError: (msg: string | null) => void;
  reset: () => void;
};

function newSessionId() {
  return Math.random().toString(36).slice(2, 12);
}

export const useReview = create<State>((set, get) => ({
  phase: "intro",
  sessionId: "",
  name: "",
  title: "",
  email: "",
  cameraDeviceId: null,
  videoSize: "L",
  videoBlob: null,
  videoUrl: null,
  videoMimeType: null,
  uploadError: null,

  ensureSession: () => {
    if (!get().sessionId) set({ sessionId: newSessionId() });
  },
  initCamera: () => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(CAMERA_STORAGE_KEY);
      if (stored) set({ cameraDeviceId: stored });
    } catch {
      // localStorage may be unavailable.
    }
  },
  setCameraDeviceId: (id) => {
    set({ cameraDeviceId: id });
    if (typeof window === "undefined") return;
    try {
      if (id) window.localStorage.setItem(CAMERA_STORAGE_KEY, id);
      else window.localStorage.removeItem(CAMERA_STORAGE_KEY);
    } catch {
      // ignore
    }
  },
  setVideoSize: (videoSize) => set({ videoSize }),
  setName: (name) => set({ name }),
  setTitle: (title) => set({ title }),
  setEmail: (email) => set({ email }),
  setPhase: (phase) => set({ phase }),
  setRecording: (blob, mimeType) => {
    const prev = get().videoUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({
      videoBlob: blob,
      videoUrl: URL.createObjectURL(blob),
      videoMimeType: mimeType,
    });
  },
  clearRecording: () => {
    const prev = get().videoUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({ videoBlob: null, videoUrl: null, videoMimeType: null });
  },
  setUploadError: (uploadError) => set({ uploadError }),
  reset: () => {
    const prev = get().videoUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({
      phase: "intro",
      sessionId: newSessionId(),
      name: "",
      title: "",
      email: "",
      videoBlob: null,
      videoUrl: null,
      videoMimeType: null,
      uploadError: null,
    });
  },
}));
