"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  Mail,
  Loader2,
  Check,
  Smartphone,
  Sparkles,
  RotateCcw,
  MessageSquare,
} from "lucide-react";
import { useWizard } from "@/lib/store";
import { TEMPLATE_ORIENTATION } from "@/lib/types";
import { buildVcard } from "@/lib/vcard";
import { SectionFrame } from "./section-frame";
import { Field, TextInput, PrimaryButton, GhostButton } from "../ui";
import { TemplateCard } from "../templates/card-templates";
import { mockCreateSession, mockSendEmail, mockSendSms } from "@/lib/mock-backend";

const AUTO_RESET_MS = 25000;

type Props = {
  state: "idle" | "active" | "done";
};

export function ShareSection({ state }: Props) {
  const details = useWizard((s) => s.details);
  const photo = useWizard((s) => s.photoDataUrl);
  const template = useWizard((s) => s.template);
  const sessionId = useWizard((s) => s.sessionId);
  const reset = useWizard((s) => s.reset);

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [email, setEmail] = useState(details.email);
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phone, setPhone] = useState(details.phone);
  const [smsState, setSmsState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [smsError, setSmsError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const qrValue = buildVcard(details, sessionId);

  useEffect(() => {
    if (!template) {
      setShareUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await mockCreateSession({
        sessionId,
        details,
        template,
        photoDataUrl: photo,
      });
      if (!cancelled) setShareUrl(res.url);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, details, template, photo]);

  const shared = emailState === "sent" || smsState === "sent";

  useEffect(() => {
    if (!shared) return;
    setCelebrate(true);
    setCountdown(Math.round(AUTO_RESET_MS / 1000));
    const tick = setInterval(() => {
      setCountdown((c) => (c === null ? null : Math.max(0, c - 1)));
    }, 1000);
    const t = setTimeout(() => reset(), AUTO_RESET_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(t);
    };
  }, [shared, reset]);

  const handleSendEmail = async () => {
    if (!template) return;
    setEmailError(null);
    setEmailState("sending");
    try {
      await mockSendEmail(email.trim(), {
        sessionId,
        details,
        template,
        photoDataUrl: photo,
      });
      setEmailState("sent");
    } catch (e) {
      setEmailState("error");
      setEmailError(e instanceof Error ? e.message : "Could not send");
    }
  };

  const handleSendSms = async () => {
    if (!template) return;
    setSmsError(null);
    setSmsState("sending");
    try {
      await mockSendSms(phone.trim(), {
        sessionId,
        details,
        template,
        photoDataUrl: photo,
      });
      setSmsState("sent");
    } catch (e) {
      setSmsState("error");
      setSmsError(e instanceof Error ? e.message : "Could not send");
    }
  };

  const phoneDigits = phone.replace(/\D/g, "").length;

  if (!template) {
    return (
      <SectionFrame
        index={4}
        title="Take it with you"
        subtitle="Pick a style above to unlock sharing"
        state={state}
      >
        <div className="rounded-2xl p-6 glass text-center text-sm text-white/45">
          Your card, QR, text, and email options will appear here.
        </div>
      </SectionFrame>
    );
  }

  return (
    <SectionFrame
      index={4}
      title="Take it with you"
      subtitle="Scan, text, or email the link to yourself"
      state={state}
    >
      <div className="flex flex-col gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
          className="w-[96%] mx-auto"
          style={{
            maxWidth:
              TEMPLATE_ORIENTATION[template] === "portrait" ? 420 : 1400,
          }}
        >
          <TemplateCard
            template={template}
            details={details}
            photoDataUrl={photo}
            qrValue={qrValue}
          />
        </motion.div>

        <div className="w-[96%] max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl p-4 glass">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone size={18} className="text-[#22d3ee]" />
              <h3 className="font-semibold">Scan to phone</h3>
            </div>
            {shareUrl ? (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white shrink-0">
                  <QRCodeSVG value={shareUrl} size={96} level="M" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/65 leading-snug">
                    Point your camera at this code to open the card on your phone.
                  </p>
                  <p className="text-[11px] text-white/35 mt-1 break-all">{shareUrl}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <Loader2 size={16} className="animate-spin" /> Generating link...
              </div>
            )}
          </div>

          <div className="rounded-2xl p-4 glass">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={18} className="text-[#22d3ee]" />
              <h3 className="font-semibold">Text me the link</h3>
            </div>
            <Field label="Phone number">
              <TextInput
                inputMode="tel"
                placeholder="+1 555 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={smsState === "sending" || smsState === "sent"}
              />
            </Field>
            {smsError && <p className="mt-2 text-xs text-red-300">{smsError}</p>}
            <div className="mt-3">
              <PrimaryButton
                onClick={handleSendSms}
                disabled={
                  phoneDigits < 7 || smsState === "sending" || smsState === "sent"
                }
                className="w-full"
              >
                {smsState === "sending" && (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Sending...
                  </>
                )}
                {smsState === "sent" && (
                  <>
                    <Check size={18} /> Sent
                  </>
                )}
                {(smsState === "idle" || smsState === "error") && (
                  <>
                    <MessageSquare size={18} /> Send text
                  </>
                )}
              </PrimaryButton>
            </div>
          </div>

          <div className="rounded-2xl p-4 glass">
            <div className="flex items-center gap-2 mb-3">
              <Mail size={18} className="text-[#a78bfa]" />
              <h3 className="font-semibold">Email me</h3>
            </div>
            <Field label="Email address">
              <TextInput
                inputMode="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={emailState === "sending" || emailState === "sent"}
              />
            </Field>
            {emailError && <p className="mt-2 text-xs text-red-300">{emailError}</p>}
            <div className="mt-3">
              <PrimaryButton
                onClick={handleSendEmail}
                disabled={
                  !email.includes("@") || emailState === "sending" || emailState === "sent"
                }
                className="w-full"
              >
                {emailState === "sending" && (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Sending...
                  </>
                )}
                {emailState === "sent" && (
                  <>
                    <Check size={18} /> Sent
                  </>
                )}
                {(emailState === "idle" || emailState === "error") && (
                  <>
                    <Mail size={18} /> Send email
                  </>
                )}
              </PrimaryButton>
            </div>
          </div>
        </div>

        <div className="w-[96%] max-w-[1400px] mx-auto flex items-center justify-between gap-2">
          <GhostButton onClick={reset}>
            <RotateCcw size={14} /> Start over
          </GhostButton>
          {countdown !== null && (
            <span className="text-xs text-white/50">Restarting in {countdown}s</span>
          )}
        </div>
      </div>

      <AnimatePresence>{celebrate && <Confetti />}</AnimatePresence>
    </SectionFrame>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 40 });
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      <div className="absolute inset-x-0 top-24 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          className="glass rounded-full px-5 py-2 flex items-center gap-2 text-sm"
        >
          <Sparkles size={16} className="text-[#22d3ee]" />
          Card sent!
        </motion.div>
      </div>
      {pieces.map((_, i) => {
        const x = Math.random() * 100;
        const delay = Math.random() * 0.3;
        const duration = 1.4 + Math.random() * 1.2;
        const colors = ["#7c5cff", "#22d3ee", "#ec4899", "#f59e0b", "#10b981"];
        const bg = colors[i % colors.length];
        return (
          <motion.span
            key={i}
            initial={{ y: -40, x: `${x}vw`, rotate: 0, opacity: 0 }}
            animate={{ y: "105vh", rotate: 360 * (Math.random() > 0.5 ? 1 : -1), opacity: 1 }}
            transition={{ duration, delay, ease: "easeIn" }}
            style={{ background: bg }}
            className="absolute top-0 w-2 h-3 rounded-sm"
          />
        );
      })}
    </motion.div>
  );
}
