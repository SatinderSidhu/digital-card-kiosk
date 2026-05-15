import { getSession, isDbConfigured } from "@/lib/db";
import { timingSafeEqual } from "crypto";
import { EditClient } from "@/components/manage/edit-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
};

export const metadata = {
  title: "Manage your card",
  robots: { index: false, follow: false },
};

function tokensMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh w-full flex items-center justify-center px-6 text-center">
      <div className="rounded-2xl glass p-8 max-w-md flex flex-col gap-2">
        {children}
      </div>
    </main>
  );
}

export default async function EditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { t } = await searchParams;

  if (!isDbConfigured()) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Card storage isn&apos;t set up</h1>
        <p className="text-sm text-white/60">
          Set <code className="text-white/80">DYNAMODB_TABLE</code> and IAM
          permissions on the SSR Lambda, then redeploy.
        </p>
      </Shell>
    );
  }

  if (!t) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">This link is incomplete</h1>
        <p className="text-sm text-white/60">
          Open the &quot;Manage your card&quot; link from your email — it
          carries the private token that unlocks editing.
        </p>
      </Shell>
    );
  }

  const session = await getSession(id);
  if (!session) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Card not found</h1>
        <p className="text-sm text-white/60">
          It may have expired — cards are kept for 30 days.
        </p>
      </Shell>
    );
  }

  if (!session.editToken || !tokensMatch(t, session.editToken)) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">This edit link isn&apos;t valid</h1>
        <p className="text-sm text-white/60">
          The token doesn&apos;t match. Use the most recent
          &quot;Manage your card&quot; link from your email.
        </p>
      </Shell>
    );
  }

  // Inline the photo as a data URL so the editor can preview it, run AI /
  // background-removal on it, and capture the card snapshot with
  // html2canvas — none of which work on a cross-origin S3 URL without CORS.
  const inlinedPhoto = await inlinePhoto(session.photoDataUrl);

  return (
    <EditClient
      id={id}
      editToken={t}
      initial={{
        details: session.details,
        template: session.template,
        photoDataUrl: inlinedPhoto,
      }}
    />
  );
}

/** Inline the photo as a data URL when it's small enough — lets the
 *  editor preview it, run AI / bg-removal on it, and capture the card
 *  snapshot without S3 CORS. For larger photos (PNG with transparency
 *  after bg-removal, hi-res webcam captures), inlining the base64
 *  bytes into the SSR response would push past Amplify's 6 MB sync
 *  Lambda response cap and the page would 413. Above the threshold we
 *  fall back to the S3 URL — display still works; html2canvas capture
 *  needs CORS on the photos bucket. */
const INLINE_MAX_BYTES = 1_000_000;
async function inlinePhoto(value: string | null): Promise<string | null> {
  if (!value) return null;
  if (!value.startsWith("http")) return value; // already a data URL
  try {
    const res = await fetch(value);
    if (!res.ok) return value;
    const len = res.headers.get("content-length");
    if (len && Number(len) > INLINE_MAX_BYTES) return value;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > INLINE_MAX_BYTES) return value;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return value;
  }
}
