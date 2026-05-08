"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { CardDetails, TemplateId } from "@/lib/types";
import { TEMPLATE_ORIENTATION } from "@/lib/types";
import { TemplateCard } from "@/components/templates/card-templates";
import { buildVcard } from "@/lib/vcard";
import { ResendEmail } from "@/components/admin/resend-email";

type CardRecord = {
  id: string;
  details: CardDetails;
  template: TemplateId;
  photoDataUrl: string | null;
  createdAt: number;
  expiresAt: number;
};

export default function CardDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<CardRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Captured by html2canvas when the admin clicks Send. The photo on the
  // record is inlined as a data URL by the API so the capture works
  // without S3 CORS configuration.
  const cardCaptureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/cards/${id}`, { cache: "no-store" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load");
      }
    })();
  }, [id]);

  // Lazy-loaded html2canvas snapshot. JPEG @ 0.85 (was PNG) — admin
  // resends were 500-ing on the SSR Lambda because the PNG payload
  // (2-4 MB binary, 3-5 MB base64) plus the proxy hop pushed past
  // the 6 MB sync request limit and OOM'd the function. The recipient
  // still tap-and-saves to phone identically; JPEG vs PNG is
  // imperceptible at email-display sizes.
  const captureCard = async (): Promise<string | null> => {
    if (!cardCaptureRef.current) return null;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardCaptureRef.current, {
        backgroundColor: "#0b0f1a",
        scale: 1,
        useCORS: true,
        logging: false,
      });
      return canvas.toDataURL("image/jpeg", 0.85);
    } catch (err) {
      console.warn("[admin-card-capture] failed:", err);
      return null;
    }
  };

  if (error) {
    return (
      <div className="rounded-xl bg-red-500/15 border border-red-500/30 px-4 py-3 text-sm text-red-200">
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center py-16 text-white/55">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  const d = data.details;
  const created = new Date(data.createdAt * 1000);
  const expires = new Date(data.expiresAt * 1000);
  const qrValue = buildVcard(d, data.id);
  const orientation = TEMPLATE_ORIENTATION[data.template];
  // Match the production /c/[id] sizing so the captured image is the same
  // resolution the customer sees on their phone.
  const cardMaxWidth = orientation === "portrait" ? 380 : 880;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/45">
          Card · {data.id}
        </p>
        <h1 className="text-2xl font-bold tracking-tight mt-0.5">
          {d.fullName || "—"}
        </h1>
        <p className="text-sm text-white/55">
          {[d.title, d.company].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>

      {/* Hero: the actual rendered card the customer designed. */}
      <div className="flex justify-center">
        <div
          ref={cardCaptureRef}
          className="w-full"
          style={{ maxWidth: `${cardMaxWidth}px` }}
        >
          <TemplateCard
            template={data.template}
            details={d}
            photoDataUrl={data.photoDataUrl}
            qrValue={qrValue}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_320px] gap-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="text-sm font-semibold mb-3">Details</h3>
          <DetailGrid
            rows={[
              ["Full name", d.fullName],
              ["Title", d.title],
              ["Company", d.company],
              ["Phone", d.phone],
              ["Email", d.email],
              ["Website", d.website],
              ["Template", data.template],
              ["Created", created.toLocaleString()],
              ["Expires", expires.toLocaleString()],
            ]}
          />
          <div className="mt-3 flex items-center gap-3 text-xs">
            <Link
              href={`/c/${data.id}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-[#22d3ee] hover:underline"
            >
              Open public card <ExternalLink size={12} />
            </Link>
          </div>
        </div>

        <ResendEmail
          endpoint={`/api/admin/cards/${data.id}/email`}
          defaultEmail={d.email}
          attachImage={captureCard}
        />
      </div>
    </div>
  );
}

function DetailGrid({ rows }: { rows: [string, string | number | null][] }) {
  return (
    <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-white/45">{label}</dt>
          <dd className="text-white/85 break-words">
            {value === null || value === "" ? (
              <span className="text-white/30">—</span>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
