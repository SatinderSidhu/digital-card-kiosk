"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Check, ExternalLink, Save } from "lucide-react";
import { TemplateCard } from "@/components/templates/card-templates";
import { TemplatePicker } from "@/components/template-picker";
import { PhotoCapture } from "@/components/photo-capture";
import { Field, TextInput, PrimaryButton } from "@/components/ui";
import { buildVcard } from "@/lib/vcard";
import {
  TEMPLATE_ORIENTATION,
  type CardDetails,
  type TemplateId,
} from "@/lib/types";

type Props = {
  id: string;
  editToken: string;
  initial: {
    details: CardDetails;
    template: TemplateId;
    photoDataUrl: string | null;
  };
};

const FIELDS: { key: keyof CardDetails; label: string; placeholder: string }[] =
  [
    { key: "fullName", label: "Full name", placeholder: "Jane Doe" },
    { key: "title", label: "Title", placeholder: "Head of Product" },
    { key: "company", label: "Company", placeholder: "Acme Co." },
    { key: "phone", label: "Phone", placeholder: "+1 555 123 4567" },
    { key: "email", label: "Email", placeholder: "jane@acme.co" },
    { key: "website", label: "Website", placeholder: "acme.co" },
  ];

export function EditClient({ id, editToken, initial }: Props) {
  const [details, setDetails] = useState<CardDetails>(initial.details);
  const [template, setTemplate] = useState<TemplateId>(initial.template);
  const [photo, setPhoto] = useState<string | null>(initial.photoDataUrl);
  // True once the photo has been re-taken / AI'd / removed — only then do
  // we send it on save (otherwise the server keeps what it has).
  const [photoTouched, setPhotoTouched] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardCaptureRef = useRef<HTMLDivElement>(null);

  const setField = (key: keyof CardDetails, v: string) =>
    setDetails((d) => ({ ...d, [key]: v }));

  const qrValue = buildVcard(details, id);
  const orientation = TEMPLATE_ORIENTATION[template];
  const previewMaxW = orientation === "portrait" ? 320 : 620;

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);

    // Capture a fresh card snapshot so the emailed image + OG unfurl stay
    // in sync with the edit. Best-effort — the save still goes through if
    // capture fails.
    let cardImageDataUrl: string | null = null;
    if (cardCaptureRef.current) {
      try {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(cardCaptureRef.current, {
          backgroundColor: "#0b0f1a",
          scale: 1,
          useCORS: true,
          logging: false,
        });
        cardImageDataUrl = canvas.toDataURL("image/jpeg", 0.85);
      } catch (err) {
        console.warn("[manage] card capture failed:", err);
      }
    }

    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editToken,
          details,
          template,
          // Omit the key entirely when untouched so the server keeps the
          // current photo; send the data URL (or null) when it changed.
          ...(photoTouched ? { photoDataUrl: photo } : {}),
          cardImageDataUrl,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }
      setSaved(true);
      setPhotoTouched(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-dvh w-full">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-5 py-3 backdrop-blur-md bg-[color:var(--background)]/80 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#7c5cff] to-[#22d3ee] grid place-items-center text-xs font-black text-white">
            ◆
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Manage your card
          </span>
        </div>
        <Link
          href={`/c/${id}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 text-xs text-white/55 hover:text-white"
        >
          View public card <ExternalLink size={12} />
        </Link>
      </header>

      <div
        className="w-full max-w-[640px] mx-auto px-5 py-6 flex flex-col gap-7"
        style={{ touchAction: "auto", userSelect: "text" }}
      >
        {/* Live preview */}
        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] uppercase tracking-wider text-white/45">
            Preview
          </h2>
          <div className="flex justify-center">
            <div
              ref={cardCaptureRef}
              className="w-full"
              style={{ maxWidth: `${previewMaxW}px` }}
            >
              <TemplateCard
                template={template}
                details={details}
                photoDataUrl={photo}
                qrValue={qrValue}
              />
            </div>
          </div>
        </section>

        {/* Photo */}
        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] uppercase tracking-wider text-white/45">
            Photo
          </h2>
          <PhotoCapture
            value={photo}
            onChange={(v) => {
              setPhoto(v);
              setPhotoTouched(true);
            }}
          />
        </section>

        {/* Details */}
        <section className="flex flex-col gap-3">
          <h2 className="text-[10px] uppercase tracking-wider text-white/45">
            Details
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                <TextInput
                  value={details[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              </Field>
            ))}
          </div>
        </section>

        {/* Template */}
        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] uppercase tracking-wider text-white/45">
            Template
          </h2>
          <div className="flex items-center gap-3">
            <TemplatePicker template={template} onChange={setTemplate} />
            <span className="text-xs text-white/45">
              {orientation === "portrait" ? "Vertical" : "Horizontal"}
            </span>
          </div>
        </section>

        {/* Save */}
        <div className="flex flex-col gap-3 pb-8">
          {error && (
            <div className="rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}
          {saved && !error && (
            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-200">
              <Check size={14} /> Saved — your public card is updated.
            </div>
          )}
          <PrimaryButton
            onClick={save}
            disabled={saving}
            className="self-start"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save size={18} /> Save changes
              </>
            )}
          </PrimaryButton>
        </div>
      </div>
    </main>
  );
}
