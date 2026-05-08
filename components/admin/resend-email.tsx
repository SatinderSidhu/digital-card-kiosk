"use client";

import { useState } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { PrimaryButton, Field, TextInput } from "../ui";

type Props = {
  endpoint: string;
  defaultEmail: string;
  /** Optional getter, called right before the POST. The returned data URL
   *  is sent as `cardImageDataUrl`, and the server attaches it to the
   *  email. Used by the cards detail page to ship a fresh PNG snapshot
   *  of the rendered card. */
  attachImage?: () => Promise<string | null>;
};

export function ResendEmail({ endpoint, defaultEmail, attachImage }: Props) {
  const [email, setEmail] = useState(defaultEmail);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSentTo(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      let cardImageDataUrl: string | null = null;
      if (attachImage) {
        try {
          cardImageDataUrl = await attachImage();
        } catch (err) {
          console.warn("[resend] image capture failed:", err);
        }
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, cardImageDataUrl }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      setSentTo(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3"
    >
      <div>
        <h3 className="text-sm font-semibold">Resend email</h3>
        <p className="text-xs text-white/55 mt-0.5">
          {attachImage
            ? "Sends the card link, vCard, and a PNG of the rendered card the customer can save to their phone."
            : "Sends the same email the customer received originally."}
        </p>
      </div>

      <Field label="Send to">
        <TextInput
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setSentTo(null);
            setError(null);
          }}
          placeholder="customer@example.com"
        />
      </Field>

      {error && (
        <div className="rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      {sentTo && (
        <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-200">
          <CheckCircle2 size={14} /> Sent to {sentTo}
        </div>
      )}

      <PrimaryButton
        type="submit"
        disabled={submitting || !email}
        className="self-start"
      >
        {submitting ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Sending…
          </>
        ) : (
          <>
            <Send size={16} /> Send email
          </>
        )}
      </PrimaryButton>
    </form>
  );
}
