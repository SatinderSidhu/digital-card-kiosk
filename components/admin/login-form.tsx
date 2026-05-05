"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";
import { PrimaryButton, Field, TextInput } from "../ui";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Login failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      // Refresh re-runs the server layout, which will now see the cookie
      // and render the admin shell instead of this form.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-dvh w-full flex items-center justify-center px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm flex flex-col gap-5 rounded-2xl glass p-6"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#7c5cff] to-[#22d3ee] grid place-items-center">
            <Lock size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-shimmer">
            Admin sign-in
          </h1>
          <p className="text-xs text-white/55">
            Enter the admin password to continue.
          </p>
        </div>

        <Field label="Password">
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            autoFocus
          />
        </Field>

        {error && (
          <div className="rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        <PrimaryButton
          type="submit"
          disabled={submitting || !password}
          className="w-full"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </PrimaryButton>
      </form>
    </main>
  );
}
