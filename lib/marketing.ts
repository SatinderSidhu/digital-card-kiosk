import type { SessionRecord } from "./db";

/**
 * Merge tags supported in marketing email subjects and HTML bodies.
 * Each tag maps to a function that pulls a value from a session record
 * + global context. Unknown / missing tags render as empty strings (a
 * common gotcha is `{{firstName}}` for someone with no fullName — we
 * fall back gracefully rather than emailing "Hi ,").
 *
 * Tags are case-sensitive and use the `{{ identifier }}` syntax with
 * optional whitespace around the identifier.
 */
export const SUPPORTED_TAGS = [
  { tag: "firstName", description: "First word of the customer's full name" },
  { tag: "fullName", description: "Full name (BR-25)" },
  { tag: "title", description: "Job title / role" },
  { tag: "company", description: "Company name" },
  { tag: "phone", description: "Phone number" },
  { tag: "email", description: "Email address (the recipient)" },
  { tag: "website", description: "Website URL" },
  { tag: "cardUrl", description: "Public card URL — https://…/c/<id>" },
  {
    tag: "manageUrl",
    description: "Private manage link — /c/<id>/edit?t=<token> (token-gated)",
  },
  {
    tag: "cardImageUrl",
    description: "S3-hosted JPEG snapshot of the rendered card (for <img src>)",
  },
] as const;

export type MarketingTemplate = {
  /** DynamoDB partition key. */
  id: string;
  /** Operator-facing label, shown in the list and editor. Not sent to
   *  recipients. */
  name: string;
  /** Email Subject line. May contain merge tags. */
  subject: string;
  /** Email body, HTML. May contain merge tags. We don't render a
   *  multipart/alternative text fallback for marketing emails — they're
   *  HTML-first and most modern clients handle them. */
  htmlBody: string;
  /** Unix seconds. */
  createdAt: number;
  /** Unix seconds. */
  updatedAt: number;
};

export type MergeContext = {
  /** Used to compute cardUrl + manageUrl. */
  origin: string;
};

/** Build the merge values for a session row. */
export function valuesFor(
  session: SessionRecord,
  ctx: MergeContext,
): Record<string, string> {
  const d = session.details;
  const firstName = (d.fullName || "").trim().split(/\s+/)[0] ?? "";
  const origin = ctx.origin.replace(/\/$/, "");
  const cardUrl = `${origin}/c/${session.id}`;
  const manageUrl = session.editToken
    ? `${cardUrl}/edit?t=${encodeURIComponent(session.editToken)}`
    : "";
  return {
    firstName,
    fullName: d.fullName ?? "",
    title: d.title ?? "",
    company: d.company ?? "",
    phone: d.phone ?? "",
    email: d.email ?? "",
    website: d.website ?? "",
    cardUrl,
    manageUrl,
    cardImageUrl: session.cardImageUrl ?? "",
  };
}

/**
 * Replace every `{{ tag }}` in `input` with the matching value from
 * `values`. Unknown tags collapse to empty string (silently — matches
 * the leniency of most marketing tools and avoids surfacing typos to
 * recipients). Returns the rendered string.
 */
export function mergeTags(
  input: string,
  values: Record<string, string>,
): string {
  return input.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_, name) => {
    const v = values[name as keyof typeof values];
    return v ?? "";
  });
}

/** Render both the subject and HTML body for one recipient. */
export function renderTemplate(
  template: MarketingTemplate,
  session: SessionRecord,
  ctx: MergeContext,
): { subject: string; html: string; values: Record<string, string> } {
  const values = valuesFor(session, ctx);
  return {
    subject: mergeTags(template.subject, values),
    html: mergeTags(template.htmlBody, values),
    values,
  };
}

/**
 * Placeholder values used by the preview when no session is selected.
 * Mirrors `FAKE_CARD` in spirit — recognisable, well-formed, obviously
 * not a real person.
 */
export const PLACEHOLDER_VALUES: Record<string, string> = {
  firstName: "Alex",
  fullName: "Alex Rivers",
  title: "Head of Product",
  company: "Acme Studio",
  phone: "+1 555 123 4567",
  email: "alex@acme.studio",
  website: "acme.studio",
  cardUrl: "https://digitalcard.kitlabs.us/c/preview",
  manageUrl: "https://digitalcard.kitlabs.us/c/preview/edit?t=preview",
  cardImageUrl: "",
};

/**
 * Starter template offered to operators on the empty Marketing list
 * page. Short and rich — leads with the card image, then a friendly
 * paragraph, then a single primary CTA to the manage link. Designed to
 * re-engage cardholders who don't yet know they can edit their card.
 */
export const STARTER_TEMPLATE: Pick<MarketingTemplate, "name" | "subject" | "htmlBody"> = {
  name: "Edit your card any time",
  subject: "{{firstName}}, your digital card can be edited any time",
  htmlBody: `<!doctype html>
<html>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f5f7fb;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px -12px rgba(15,23,42,0.12);">
        <tr>
          <td style="padding:32px 32px 8px;">
            <h1 style="margin:0 0 10px;font-size:22px;font-weight:600;color:#0f172a;letter-spacing:-0.01em;">Hi {{firstName}},</h1>
            <p style="margin:0;font-size:15px;line-height:1.55;color:#475569;">
              Quick heads-up: your digital card isn't frozen in time. You can edit your details, swap to a different design, or re-take your photo (with AI studio polish if you want it) — updates go live the moment you save.
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:18px 32px 8px;">
            <a href="{{cardImageUrl}}" style="display:block;text-decoration:none;">
              <img src="{{cardImageUrl}}" alt="Your digital card" style="display:block;max-width:100%;width:100%;height:auto;border-radius:14px;" />
            </a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 32px 4px;">
            <a href="{{manageUrl}}" style="display:inline-block;background:#7c5cff;background-image:linear-gradient(135deg,#7c5cff 0%,#22d3ee 100%);color:#ffffff;padding:14px 36px;border-radius:9999px;text-decoration:none;font-weight:600;font-size:15px;">Manage your card</a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 28px;text-align:center;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
              The link above is private to you — anyone with it can edit your card. The public, read-only version lives at <a href="{{cardUrl}}" style="color:#7c5cff;text-decoration:none;">{{cardUrl}}</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
};
