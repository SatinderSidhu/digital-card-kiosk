"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Square, AlertCircle, ChevronRight } from "lucide-react";
import { useReview } from "@/lib/review-store";
import { REVIEW_QUESTIONS } from "@/lib/review-questions";
import { QuestionOverlay } from "./question-overlay";
import { LowerThird } from "./lower-third";
import { SizePills } from "../size-pills";

/**
 * Pick the best supported MIME type for MediaRecorder. WebM/VP9 is the
 * default on Chrome/Firefox; iOS Safari only supports MP4.
 */
function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "video/webm";
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "video/webm";
}

/** Strip codec parameters so the server-side allow-list matches. */
function baseMime(mime: string): string {
  return mime.split(";")[0].trim();
}

export function Recorder() {
  const cameraDeviceId = useReview((s) => s.cameraDeviceId);
  const name = useReview((s) => s.name);
  const title = useReview((s) => s.title);
  const videoSize = useReview((s) => s.videoSize);
  const setVideoSize = useReview((s) => s.setVideoSize);
  const setRecording = useReview((s) => s.setRecording);
  const setPhase = useReview((s) => s.setPhase);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const finalizedRef = useRef(false);

  // Per-question timing. We track the active question index and the moment
  // it started so the rAF tick can be a pure function of (now - questionStart).
  // Manually advancing just resets questionStartedAtRef and the index — the
  // tick keeps running unchanged.
  const questionIndexRef = useRef(0);
  const questionStartedAtRef = useRef(0);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(
    REVIEW_QUESTIONS[0]?.durationSec ?? 0,
  );
  const [recElapsed, setRecElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recordingReady, setRecordingReady] = useState(false);

  // Acquire camera + mic, attach to <video>, start MediaRecorder.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: cameraDeviceId
            ? { deviceId: { exact: cameraDeviceId } }
            : { facingMode: "user" },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {
            // autoplay blocked — the muted attribute on the element
            // should let it through, but we ignore the rejection just in case.
          });
        }

        const mimeType = pickMimeType();
        const recorder = new MediaRecorder(stream, { mimeType });
        recorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
        };
        recorder.onstop = () => {
          if (finalizedRef.current) return;
          finalizedRef.current = true;
          const blob = new Blob(chunksRef.current, { type: baseMime(mimeType) });
          setRecording(blob, baseMime(mimeType));
          setPhase("playback");
        };

        recorder.start(1000); // 1s timeslice for smooth ondataavailable
        const t0 = performance.now();
        startedAtRef.current = t0;
        questionStartedAtRef.current = t0;
        setRecordingReady(true);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not access camera or mic.";
        setError(msg);
      }
    })();

    return () => {
      cancelled = true;
      try {
        recorderRef.current?.stop();
      } catch {
        // noop
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // We intentionally only run this on mount. cameraDeviceId is captured
    // from the store at start; switching mid-recording isn't a flow we
    // support.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advance = () => {
    const idx = questionIndexRef.current;
    if (idx >= REVIEW_QUESTIONS.length - 1) {
      // Last question — stop the recording (onstop transitions to playback).
      try {
        recorderRef.current?.stop();
      } catch {
        // noop
      }
      return;
    }
    const nextIdx = idx + 1;
    questionIndexRef.current = nextIdx;
    questionStartedAtRef.current = performance.now();
    setQuestionIndex(nextIdx);
    setProgress(0);
    setSecondsLeft(REVIEW_QUESTIONS[nextIdx].durationSec);
  };

  // Drive the question timer. rAF tick reads from refs so it doesn't need to
  // re-run when questionIndex changes (which would tear the timer).
  useEffect(() => {
    if (!recordingReady) return;

    let raf = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const now = performance.now();
      const idx = questionIndexRef.current;
      const q = REVIEW_QUESTIONS[idx];
      const localElapsed = (now - questionStartedAtRef.current) / 1000;

      setRecElapsed((now - startedAtRef.current) / 1000);

      if (localElapsed >= q.durationSec) {
        advance();
      } else {
        setProgress(Math.min(1, localElapsed / q.durationSec));
        setSecondsLeft(q.durationSec - localElapsed);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [recordingReady]);

  const stopEarly = () => {
    try {
      recorderRef.current?.stop();
    } catch {
      // noop
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <AlertCircle size={28} className="text-red-300" />
        <p className="text-sm text-white/80">{error}</p>
        <button
          onClick={() => setPhase("intro")}
          className="text-xs text-white/55 underline underline-offset-4"
        >
          Back to start
        </button>
      </div>
    );
  }

  const isLastQuestion = questionIndex === REVIEW_QUESTIONS.length - 1;
  const nextQuestion = REVIEW_QUESTIONS[questionIndex + 1];

  const widthCls =
    videoSize === "S"
      ? "max-w-[520px]"
      : videoSize === "M"
        ? "max-w-[760px]"
        : "max-w-[1100px]";

  return (
    <div className={`flex flex-col gap-3 px-4 py-3 mx-auto w-full ${widthCls}`}>
      <div className="flex items-center justify-end gap-2 -mb-1">
        <span className="text-[10px] uppercase tracking-wider text-white/45">
          Size
        </span>
        <SizePills size={videoSize} onChange={setVideoSize} />
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {recordingReady && (
          <>
            <QuestionOverlay
              questionIndex={questionIndex}
              progress={progress}
              secondsLeft={secondsLeft}
            />
            <LowerThird name={name} title={title} />
          </>
        )}

        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/90 text-white text-[10px] font-bold uppercase tracking-wider">
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="block w-1.5 h-1.5 rounded-full bg-white"
          />
          REC {formatTimer(recElapsed)}
        </div>
      </div>

      {nextQuestion && (
        <div className="flex items-center gap-2 px-1 -mt-1">
          <span className="text-[9px] uppercase tracking-[0.2em] text-white/45 shrink-0">
            Up next
          </span>
          <span className="text-xs text-white/70 truncate">
            {nextQuestion.prompt}
          </span>
        </div>
      )}

      <div className="flex items-center justify-center gap-4 pt-1">
        <button
          onClick={stopEarly}
          aria-label="Stop recording"
          className="grid place-items-center w-16 h-16 rounded-full bg-white/10 border border-white/20 hover:bg-white/15 active:scale-95 transition shrink-0"
        >
          <span className="grid place-items-center w-12 h-12 rounded-full bg-red-500">
            <Square size={20} className="text-white fill-white" />
          </span>
        </button>

        <motion.button
          onClick={advance}
          whileTap={{ scale: 0.96 }}
          aria-label={isLastQuestion ? "Finish recording" : "Next question"}
          className="inline-flex items-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-[#7c5cff] via-[#8b5cf6] to-[#22d3ee] shadow-[0_10px_32px_-10px_rgba(124,92,255,0.7)]"
        >
          {isLastQuestion ? "Finish" : "Next question"}
          <ChevronRight size={18} />
        </motion.button>
      </div>

      <p className="text-[11px] text-white/40 text-center">
        {isLastQuestion
          ? "Last one — tap Finish when you're done"
          : "Tap Next when you've answered, or let the timer advance"}
      </p>
    </div>
  );
}

function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
