"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  Save,
  Send,
  Trash2,
  Mail,
  Sparkles,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import { PrimaryButton, GhostButton, Field, TextInput } from "@/components/ui";
import { SUPPORTED_TAGS } from "@/lib/marketing";

type Template = {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  createdAt: number;
  updatedAt: number;
};

type Contact = {
  id: string;
  fullName: string;
  email: string;
};

type PreviewResult = {
  subject: string;
  html: string;
  contactName: string | null;
};

type SendResult = {
  sent: number;
  failed: number;
  totalEligible?: number;
  totalContacts?: number;
};

export default function TemplateEditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [t, setT] = useState<Template | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Draft state — what the operator's editing.
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Preview state.
  const [previewContactId, setPreviewContactId] = useState<string>("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Send state.
  const [testEmail, setTestEmail] = useState("");
  const [sendBusy, setSendBusy] = useState<null | "test" | "all">(null);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Initial load.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const [tplRes, contactsRes] = await Promise.all([
          fetch(`/api/admin/marketing/templates/${id}`, { cache: "no-store" }),
          fetch(`/api/admin/cards`, { cache: "no-store" }),
        ]);
        if (!tplRes.ok) {
          const body = (await tplRes.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `Failed (${tplRes.status})`);
        }
        const tpl = (await tplRes.json()) as Template;
        if (cancelled) return;
        setT(tpl);
        setName(tpl.name);
        setSubject(tpl.subject);
        setHtmlBody(tpl.htmlBody);
        if (contactsRes.ok) {
          const c = (await contactsRes.json()) as {
            items: { id: string; fullName: string; email: string }[];
          };
          setContacts(
            c.items
              .filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email))
              .map((x) => ({ id: x.id, fullName: x.fullName, email: x.email })),
          );
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Could not load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Debounced preview render — fires 400ms after the operator stops typing
  // or changes the merge contact.
  const previewKey = useMemo(
    () => `${subject}::${htmlBody}::${previewContactId}`,
    [subject, htmlBody, previewContactId],
  );

  const refreshPreview = useCallback(async () => {
    setPreviewError(null);
    try {
      const res = await fetch(
        `/api/admin/marketing/templates/${id}/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: previewContactId || undefined,
            draft: { subject, htmlBody },
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Preview failed (${res.status})`);
      }
      setPreview((await res.json()) as PreviewResult);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed");
    }
  }, [id, previewContactId, subject, htmlBody]);

  useEffect(() => {
    if (!t) return;
    const handle = setTimeout(() => void refreshPreview(), 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, t]);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/marketing/templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, htmlBody }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Save failed (${res.status})`);
      }
      const updated = (await res.json()) as Template;
      setT(updated);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim())) {
      setSendError("Enter a valid test email address.");
      return;
    }
    setSendBusy("test");
    setSendError(null);
    setSendResult(null);
    try {
      // Save unsaved edits first so the sent email matches what's on screen.
      await save();
      const res = await fetch(`/api/admin/marketing/templates/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "test",
          testEmail: testEmail.trim(),
          contactId: previewContactId || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Send failed (${res.status})`);
      }
      setSendResult((await res.json()) as SendResult);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSendBusy(null);
    }
  };

  const sendToAll = async () => {
    const eligible = contacts.length;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Send this email to ${eligible} contact${eligible === 1 ? "" : "s"} with a valid email? This can't be undone.`,
      )
    ) {
      return;
    }
    setSendBusy("all");
    setSendError(null);
    setSendResult(null);
    try {
      await save();
      const res = await fetch(`/api/admin/marketing/templates/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "all" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Send failed (${res.status})`);
      }
      setSendResult((await res.json()) as SendResult);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSendBusy(null);
    }
  };

  const del = async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Delete this template? This can't be undone.")
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/marketing/templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      router.push("/admin/marketing");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const insertTag = (tag: string) => {
    const t = `{{${tag}}}`;
    const el = bodyTextareaRef.current;
    if (!el) {
      setHtmlBody((prev) => prev + t);
      return;
    }
    const start = el.selectionStart ?? htmlBody.length;
    const end = el.selectionEnd ?? htmlBody.length;
    const next = htmlBody.slice(0, start) + t + htmlBody.slice(end);
    setHtmlBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + t.length, start + t.length);
    });
  };

  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  if (loadError) {
    return (
      <div className="rounded-xl bg-red-500/15 border border-red-500/30 px-4 py-3 text-sm text-red-200">
        {loadError}
      </div>
    );
  }
  if (!t) {
    return (
      <div className="flex items-center justify-center py-16 text-white/55">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/45">
            Template · {t.id}
          </p>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">
            {name || "Untitled"}
          </h1>
        </div>
        <button
          onClick={del}
          className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-red-300 px-2 py-1.5"
        >
          <Trash2 size={13} /> Delete
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── Editor ────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Field label="Template name (operator only)">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Re-engagement — Edit your card"
            />
          </Field>

          <Field label="Subject line (supports tags)">
            <TextInput
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="{{firstName}}, your digital card can be edited any time"
            />
          </Field>

          <div>
            <label className="block">
              <span className="block text-xs font-medium uppercase tracking-wider text-white/50 mb-1.5">
                HTML body (supports tags)
              </span>
              <textarea
                ref={bodyTextareaRef}
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                rows={18}
                spellCheck={false}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-white placeholder-white/30 focus:border-[#7c5cff] focus:bg-white/10 transition-colors font-mono text-xs leading-relaxed"
              />
            </label>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/45 mb-1.5">
              Merge tags (click to insert)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUPPORTED_TAGS.map((s) => (
                <button
                  key={s.tag}
                  onClick={() => insertTag(s.tag)}
                  title={s.description}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-mono bg-white/5 border border-white/10 text-white/75 hover:bg-white/10 hover:text-white transition-colors"
                >
                  {`{{${s.tag}}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <PrimaryButton onClick={save} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save size={16} /> Save
                </>
              )}
            </PrimaryButton>
            {saved && !saveError && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                <Check size={13} /> Saved
              </span>
            )}
            {saveError && (
              <span className="inline-flex items-center gap-1.5 text-xs text-red-300">
                <X size={13} /> {saveError}
              </span>
            )}
          </div>

          <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Send size={16} className="text-[#22d3ee]" />
              <h3 className="text-sm font-semibold">Send</h3>
            </div>

            <Field
              label="Send a test to one address"
              hint="Merges with the contact picked above (or placeholder data)."
            >
              <TextInput
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              <GhostButton onClick={sendTest} disabled={sendBusy !== null}>
                {sendBusy === "test" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Sending test…
                  </>
                ) : (
                  <>
                    <Mail size={16} /> Send test
                  </>
                )}
              </GhostButton>

              <button
                onClick={sendToAll}
                disabled={sendBusy !== null || contacts.length === 0}
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 font-medium text-white bg-gradient-to-r from-[#ec4899] to-[#f59e0b] shadow-[0_8px_24px_-10px_rgba(236,72,153,0.5)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sendBusy === "all" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Send to all ({contacts.length})
                  </>
                )}
              </button>
            </div>

            {sendError && (
              <div className="rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs text-red-200 inline-flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{sendError}</span>
              </div>
            )}
            {sendResult && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-200">
                Sent <strong>{sendResult.sent}</strong>
                {typeof sendResult.totalEligible === "number" &&
                  ` of ${sendResult.totalEligible} eligible (${sendResult.totalContacts} total contacts)`}
                . {sendResult.failed > 0 && `${sendResult.failed} failed.`}
              </div>
            )}
          </div>
        </div>

        {/* ── Preview ──────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-semibold">Preview</h3>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-white/45">
                Render with
              </span>
              <select
                value={previewContactId}
                onChange={(e) => setPreviewContactId(e.target.value)}
                className="rounded-full bg-white/5 border border-white/10 text-xs text-white/85 px-3 py-1.5"
              >
                <option value="">Placeholder data</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName || c.email} — {c.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
              <p className="text-[10px] uppercase tracking-wider text-white/45">
                Subject
              </p>
              <p className="text-sm font-medium text-white/90 truncate">
                {preview?.subject || "—"}
              </p>
            </div>
            {previewError ? (
              <div className="p-4 text-xs text-red-300">{previewError}</div>
            ) : preview ? (
              <iframe
                title="Email preview"
                srcDoc={preview.html}
                sandbox=""
                className="w-full bg-white"
                style={{ height: 600, border: 0 }}
              />
            ) : (
              <div className="p-6 flex items-center justify-center text-white/55">
                <Loader2 size={16} className="animate-spin" />
              </div>
            )}
          </div>
          <p className="text-[11px] text-white/40 leading-relaxed">
            Preview renders the unsaved draft. The actual email is sent via
            SES using the saved version — clicking <em>Send test</em> or{" "}
            <em>Send to all</em> saves first.
          </p>
        </div>
      </div>
    </div>
  );
}
