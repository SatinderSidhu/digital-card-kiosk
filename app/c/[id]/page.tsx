import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Download } from "lucide-react";
import { getSession, isDbConfigured } from "@/lib/db";
import { TEMPLATE_ORIENTATION } from "@/lib/types";
import { TemplateCard } from "@/components/templates/card-templates";
import { buildVcard } from "@/lib/vcard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!isDbConfigured()) {
    return { title: "Digital Card" };
  }
  try {
    const session = await getSession(id);
    if (!session) return { title: "Card not found" };
    const name = session.details.fullName || "Digital card";
    const subtitle = [session.details.title, session.details.company]
      .filter(Boolean)
      .join(" · ");
    return {
      title: `${name}${subtitle ? " — " + subtitle : ""}`,
      description: subtitle || "Digital business card",
    };
  } catch {
    return { title: "Digital Card" };
  }
}

export default async function CardPage({ params }: Props) {
  const { id } = await params;

  if (!isDbConfigured()) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-6 text-center">
        <div className="rounded-2xl glass p-8 max-w-md">
          <h1 className="text-xl font-semibold mb-2">Card storage isn&apos;t set up yet</h1>
          <p className="text-sm text-white/60">
            The kiosk is configured but the server database isn&apos;t connected.
            Set <code className="text-white/80">DYNAMODB_TABLE</code> and IAM
            permissions on the SSR Lambda, then redeploy.
          </p>
        </div>
      </main>
    );
  }

  const session = await getSession(id);
  if (!session) notFound();

  const vcard = buildVcard(session.details, session.id);
  const vcardDataUrl = `data:text/vcard;charset=utf-8,${encodeURIComponent(vcard)}`;
  const fileName =
    (session.details.fullName || "contact").replace(/[^a-z0-9]+/gi, "_") +
    ".vcf";
  const orientation = TEMPLATE_ORIENTATION[session.template];
  const cardMaxWidth = orientation === "portrait" ? 380 : 880;

  return (
    <main className="min-h-dvh w-full flex flex-col items-center justify-center px-4 py-10 gap-8">
      <div
        className="w-[96%] mx-auto"
        style={{ maxWidth: `${cardMaxWidth}px` }}
      >
        <TemplateCard
          template={session.template}
          details={session.details}
          photoDataUrl={session.photoDataUrl}
          qrValue={vcard}
        />
      </div>

      <div className="flex flex-col items-center gap-3">
        <a
          href={vcardDataUrl}
          download={fileName}
          className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-bold text-white bg-gradient-to-r from-[#7c5cff] via-[#8b5cf6] to-[#22d3ee] shadow-[0_12px_40px_-10px_rgba(124,92,255,0.7)] hover:scale-[1.02] active:scale-95 transition"
        >
          <Download size={18} /> Save to Contacts
        </a>
        <p className="text-xs text-white/45 text-center max-w-xs">
          Tap to open in your phone&apos;s Contacts app, or scan the QR with
          another device.
        </p>
      </div>

      <footer className="text-[10px] uppercase tracking-[0.3em] text-white/30">
        Digital Card Kiosk
      </footer>
    </main>
  );
}
