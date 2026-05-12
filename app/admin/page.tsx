"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CreditCard,
  Video,
  ChevronRight,
  Loader2,
  Mail,
  Check,
  X,
} from "lucide-react";
import clsx from "clsx";

type CardListItem = {
  id: string;
  fullName: string;
  title: string;
  company: string;
  email: string;
  template: string;
  hasPhoto: boolean;
  createdAt: number;
};

type ReviewListItem = {
  id: string;
  name: string;
  title: string | null;
  email: string;
  videoUrl: string;
  createdAt: number;
};

type Tab = "cards" | "reviews";

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("cards");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-sm text-white/55 mt-0.5">
            Cards created and reviews submitted from the kiosk.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10">
          <TabButton active={tab === "cards"} onClick={() => setTab("cards")}>
            <CreditCard size={14} /> Cards
          </TabButton>
          <TabButton active={tab === "reviews"} onClick={() => setTab("reviews")}>
            <Video size={14} /> Reviews
          </TabButton>
        </div>
      </div>

      {tab === "cards" ? <CardsPanel /> : <ReviewsPanel />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition",
        active
          ? "bg-gradient-to-r from-[#7c5cff] to-[#22d3ee] text-white"
          : "text-white/65 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function CardsPanel() {
  const [data, setData] = useState<{
    count: number;
    items: CardListItem[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/cards", { cache: "no-store" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load");
      }
    })();
  }, []);

  if (error) return <ErrorPanel message={error} />;
  if (!data) return <LoadingPanel />;

  return (
    <div className="flex flex-col gap-4">
      <CountTile label="Cards created" count={data.count} accent="from-[#7c5cff] to-[#22d3ee]" />
      {data.items.length === 0 ? (
        <EmptyState
          icon={<CreditCard size={20} />}
          message="No cards yet — they'll show up here as customers build them at the kiosk."
        />
      ) : (
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <Table
            headers={["Name", "Company", "Email", "Template", "Created"]}
            rows={data.items.map((c) => ({
              key: c.id,
              href: `/admin/cards/${c.id}`,
              cells: [
                c.fullName || "—",
                c.company || "—",
                c.email || "—",
                c.template,
                relativeTime(c.createdAt),
              ],
              action: c.email ? <FollowupButton id={c.id} /> : undefined,
            }))}
          />
        </div>
      )}
    </div>
  );
}

function ReviewsPanel() {
  const [data, setData] = useState<{
    count: number;
    items: ReviewListItem[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/reviews", { cache: "no-store" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load");
      }
    })();
  }, []);

  if (error) return <ErrorPanel message={error} />;
  if (!data) return <LoadingPanel />;

  return (
    <div className="flex flex-col gap-4">
      <CountTile
        label="Reviews submitted"
        count={data.count}
        accent="from-[#ec4899] to-[#f59e0b]"
      />
      {data.items.length === 0 ? (
        <EmptyState
          icon={<Video size={20} />}
          message="No reviews yet — they'll show up here once customers finish recording at the kiosk."
        />
      ) : (
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <Table
            headers={["Name", "Title", "Email", "Submitted"]}
            rows={data.items.map((r) => ({
              key: r.id,
              href: `/admin/reviews/${r.id}`,
              cells: [
                r.name || "—",
                r.title || "—",
                r.email || "—",
                relativeTime(r.createdAt),
              ],
            }))}
          />
        </div>
      )}
    </div>
  );
}

function CountTile({
  label,
  count,
  accent,
}: {
  label: string;
  count: number;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex items-center justify-between">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/45">
          {label}
        </p>
        <p className="text-4xl font-bold tracking-tight tabular-nums mt-1">
          {count.toLocaleString()}
        </p>
      </div>
      <div
        className={clsx(
          "h-12 w-12 rounded-2xl bg-gradient-to-br grid place-items-center",
          accent,
        )}
      >
        <span className="text-2xl">∑</span>
      </div>
    </div>
  );
}

type Row = {
  key: string;
  href: string;
  cells: (string | number)[];
  /** Optional per-row action (e.g. a "send follow-up email" button) —
   *  rendered in its own cell before the drill-in chevron. */
  action?: ReactNode;
};

function Table({ headers, rows }: { headers: string[]; rows: Row[] }) {
  const hasActions = rows.some((r) => r.action != null);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.02] border-b border-white/10">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="text-left text-[10px] uppercase tracking-wider text-white/45 font-medium px-4 py-2.5"
              >
                {h}
              </th>
            ))}
            {hasActions && <th className="w-10" />}
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              className="border-b border-white/5 last:border-0 hover:bg-white/[0.04] transition-colors"
            >
              {r.cells.map((c, i) => (
                <td key={i} className="px-4 py-3 text-white/85">
                  <Link href={r.href} className="block min-w-0 truncate">
                    {c}
                  </Link>
                </td>
              ))}
              {hasActions && (
                <td className="px-2 py-3 text-right">{r.action ?? null}</td>
              )}
              <td className="px-3">
                <Link href={r.href} className="text-white/40 hover:text-white">
                  <ChevronRight size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Per-row "send the thank-you / manage-your-card follow-up email" button.
 *  Manages its own send/sent/error state so the table doesn't need to. */
function FollowupButton({ id }: { id: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const send = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (state === "sending" || state === "sent") return;
    setState("sending");
    setErrMsg(null);
    try {
      const res = await fetch(`/api/admin/cards/${id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "followup" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setErrMsg(body.error ?? `Failed (${res.status})`);
        setState("error");
        return;
      }
      setState("sent");
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Network error");
      setState("error");
    }
  };

  return (
    <button
      onClick={send}
      disabled={state === "sending" || state === "sent"}
      title={
        state === "sent"
          ? "Follow-up email sent"
          : state === "error"
            ? errMsg ?? "Send failed"
            : "Send the thank-you / manage-your-card follow-up email"
      }
      className={clsx(
        "inline-flex items-center justify-center w-8 h-8 rounded-lg border transition",
        state === "sent"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 cursor-default"
          : state === "error"
            ? "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15"
            : "border-white/10 bg-white/5 text-white/55 hover:text-white hover:bg-white/10",
      )}
    >
      {state === "idle" && <Mail size={14} />}
      {state === "sending" && <Loader2 size={14} className="animate-spin" />}
      {state === "sent" && <Check size={14} />}
      {state === "error" && <X size={14} />}
    </button>
  );
}

function LoadingPanel() {
  return (
    <div className="flex items-center justify-center py-16 text-white/55">
      <Loader2 size={20} className="animate-spin" />
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-red-500/15 border border-red-500/30 px-4 py-3 text-sm text-red-200">
      {message}
    </div>
  );
}

function EmptyState({
  icon,
  message,
}: {
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 flex flex-col items-center gap-2 text-center">
      <span className="text-white/35">{icon}</span>
      <p className="text-sm text-white/55 max-w-sm">{message}</p>
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
