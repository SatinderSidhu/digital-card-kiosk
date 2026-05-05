"use client";

import { useState } from "react";
import { RotateCcw, Send, Loader2 } from "lucide-react";
import { useReview } from "@/lib/review-store";
import { PrimaryButton, GhostButton } from "../ui";
import { SizePills } from "../size-pills";

export function Playback() {
  const videoUrl = useReview((s) => s.videoUrl);
  const videoBlob = useReview((s) => s.videoBlob);
  const videoMimeType = useReview((s) => s.videoMimeType);
  const sessionId = useReview((s) => s.sessionId);
  const name = useReview((s) => s.name);
  const title = useReview((s) => s.title);
  const email = useReview((s) => s.email);
  const setPhase = useReview((s) => s.setPhase);
  const setUploadError = useReview((s) => s.setUploadError);
  const clearRecording = useReview((s) => s.clearRecording);
  const videoSize = useReview((s) => s.videoSize);
  const setVideoSize = useReview((s) => s.setVideoSize);

  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const handleSubmit = async () => {
    if (!videoBlob || !videoMimeType) return;
    setSubmitting(true);
    setUploadError(null);

    try {
      const presignRes = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, contentType: videoMimeType }),
      });
      if (!presignRes.ok) {
        const data = (await presignRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Presign failed (${presignRes.status})`);
      }
      const { uploadUrl, objectUrl } = (await presignRes.json()) as {
        uploadUrl: string;
        objectUrl: string;
      };

      // Direct PUT to S3. We use XMLHttpRequest instead of fetch because
      // fetch doesn't expose upload progress events.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", videoMimeType);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(ev.loaded / ev.total);
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Upload network error"));
        xhr.send(videoBlob);
      });

      const emailRes = await fetch(`/api/reviews/${sessionId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          title,
          videoUrl: objectUrl,
          videoMimeType,
        }),
      });
      if (!emailRes.ok) {
        const data = (await emailRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Email failed (${emailRes.status})`);
      }

      setPhase("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed.";
      setUploadError(msg);
      setSubmitting(false);
      setProgress(null);
    }
  };

  const handleRetake = () => {
    clearRecording();
    setPhase("recording");
  };

  if (!videoUrl) {
    return (
      <div className="px-6 py-8 text-center text-sm text-white/55">
        No recording yet.
      </div>
    );
  }

  const widthCls =
    videoSize === "S"
      ? "max-w-[520px]"
      : videoSize === "M"
        ? "max-w-[760px]"
        : "max-w-[1100px]";

  return (
    <div className={`flex flex-col gap-4 px-4 py-3 mx-auto w-full ${widthCls}`}>
      <div className="flex items-center justify-end gap-2 -mb-1">
        <span className="text-[10px] uppercase tracking-wider text-white/45">
          Size
        </span>
        <SizePills size={videoSize} onChange={setVideoSize} />
      </div>

      <div className="rounded-2xl overflow-hidden border border-white/10 bg-black aspect-video">
        <video
          src={videoUrl}
          controls
          playsInline
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex flex-col items-center gap-2 px-2">
        <p className="text-sm text-white/70 text-center">
          Looking good? Send it on its way.
        </p>
        {progress !== null && (
          <div className="w-full max-w-xs">
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#7c5cff] to-[#22d3ee] transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-white/45 text-center">
              Uploading… {Math.round(progress * 100)}%
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 flex-wrap pt-1">
        <GhostButton onClick={handleRetake} disabled={submitting}>
          <RotateCcw size={16} /> Retake
        </GhostButton>
        <PrimaryButton onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Send size={18} /> Send to my email
            </>
          )}
        </PrimaryButton>
      </div>
    </div>
  );
}
