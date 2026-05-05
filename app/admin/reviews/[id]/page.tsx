"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, ExternalLink } from "lucide-react";
import { ResendEmail } from "@/components/admin/resend-email";

type ReviewRecord = {
  id: string;
  name: string;
  title: string | null;
  email: string;
  videoUrl: string;
  videoMimeType: string;
  createdAt: number;
  expiresAt: number;
};

export default function ReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<ReviewRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/reviews/${id}`, {
          cache: "no-store",
        });
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

  const created = new Date(data.createdAt * 1000);
  const expires = new Date(data.expiresAt * 1000);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/45">
          Review · {data.id}
        </p>
        <h1 className="text-2xl font-bold tracking-tight mt-0.5">
          {data.name || "—"}
        </h1>
        {data.title && (
          <p className="text-sm text-white/55">{data.title}</p>
        )}
      </div>

      <div className="grid md:grid-cols-[1fr_320px] gap-6">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-black aspect-video max-w-2xl">
            <video
              src={data.videoUrl}
              controls
              playsInline
              className="w-full h-full object-contain bg-black"
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold mb-3">Details</h3>
            <DetailGrid
              rows={[
                ["Name", data.name],
                ["Title", data.title],
                ["Email", data.email],
                ["MIME type", data.videoMimeType],
                ["Recorded", created.toLocaleString()],
                ["Expires", expires.toLocaleString()],
              ]}
            />
            <div className="mt-3 flex items-center gap-3 text-xs">
              <a
                href={data.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#22d3ee] hover:underline"
              >
                Open in new tab <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>

        <ResendEmail
          endpoint={`/api/admin/reviews/${data.id}/email`}
          defaultEmail={data.email}
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
