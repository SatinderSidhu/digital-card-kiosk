"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, ChevronRight, Loader2, Mail } from "lucide-react";
import { PrimaryButton, GhostButton } from "@/components/ui";

type ListItem = {
  id: string;
  name: string;
  subject: string;
  updatedAt: number;
};

export default function MarketingPage() {
  const router = useRouter();
  const [data, setData] = useState<{ items: ListItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<"blank" | "starter" | null>(null);

  useEffect(() => {
    // Async IIFE — setState inside is in a microtask, which keeps the
    // react-hooks/set-state-in-effect lint rule happy.
    void (async () => {
      try {
        const res = await fetch("/api/admin/marketing/templates", {
          cache: "no-store",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load");
      }
    })();
  }, []);

  const create = async (fromStarter: boolean) => {
    setCreating(fromStarter ? "starter" : "blank");
    try {
      const res = await fetch("/api/admin/marketing/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fromStarter ? { fromStarter: true } : {}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      const t = (await res.json()) as { id: string };
      router.push(`/admin/marketing/templates/${t.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create");
      setCreating(null);
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
          <p className="text-sm text-white/55 mt-0.5">
            Email templates with merge tags ({"{{ firstName }}"}, etc.). Send a
            test or fire to every contact on file.
          </p>
        </div>
        <PrimaryButton onClick={() => create(false)} disabled={creating !== null}>
          {creating === "blank" ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Creating…
            </>
          ) : (
            <>
              <Plus size={16} /> New template
            </>
          )}
        </PrimaryButton>
      </div>

      {data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 flex flex-col items-center text-center gap-3">
          <Mail size={24} className="text-white/35" />
          <h3 className="text-base font-semibold">No templates yet</h3>
          <p className="text-sm text-white/55 max-w-md">
            Start from the included example — a short, rich-HTML re-engagement
            email reminding cardholders they can edit their card any time.
          </p>
          <GhostButton onClick={() => create(true)} disabled={creating !== null}>
            {creating === "starter" ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Creating…
              </>
            ) : (
              <>
                <Sparkles size={16} /> Start from example
              </>
            )}
          </GhostButton>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.02] border-b border-white/10">
              <tr>
                <th className="text-left text-[10px] uppercase tracking-wider text-white/45 font-medium px-4 py-2.5">
                  Name
                </th>
                <th className="text-left text-[10px] uppercase tracking-wider text-white/45 font-medium px-4 py-2.5">
                  Subject
                </th>
                <th className="text-left text-[10px] uppercase tracking-wider text-white/45 font-medium px-4 py-2.5">
                  Updated
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.04] transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/marketing/templates/${t.id}`}
                      className="block font-medium text-white/90"
                    >
                      {t.name || "Untitled"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-white/65">
                    <Link
                      href={`/admin/marketing/templates/${t.id}`}
                      className="block truncate max-w-[400px]"
                    >
                      {t.subject || "(no subject)"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-white/55">
                    {relativeTime(t.updatedAt)}
                  </td>
                  <td className="px-3">
                    <Link
                      href={`/admin/marketing/templates/${t.id}`}
                      className="text-white/40 hover:text-white"
                    >
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function relativeTime(unixSec: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSec;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(unixSec * 1000).toLocaleDateString();
}
