# Digital Card Kiosk

[![CI](https://github.com/SatinderSidhu/digital-card-kiosk/actions/workflows/ci.yml/badge.svg)](https://github.com/SatinderSidhu/digital-card-kiosk/actions/workflows/ci.yml)

**Live demo:** <https://digitalcard.kitlabs.us>
**Release history:** [CHANGELOG.md](CHANGELOG.md)

A self-service kiosk that lets a walk-up customer build and share a digital
business card in under a minute, **plus** record a short video review and an
admin dashboard for staff. Built with **Next.js 16 (App Router) · React 19 ·
TypeScript · Tailwind v4**, deployed on **AWS Amplify Hosting**.

The kiosk has three surfaces:

| Route | Audience | What it is |
|---|---|---|
| `/` | Walk-up customer | Build a digital business card (photo → details → card + share) |
| `/reviews` | Walk-up customer | Record a 6-question video review with broadcast-style overlay |
| `/admin` | Venue staff | Password-gated dashboard: count + list + detail of cards and reviews; resend emails |

![Hero](docs/screenshots/00-hero.png)

---

## The card flow (`/`)

The customer-facing flow has **three logical steps**:

| # | Step | What happens |
|---|---|---|
| 1 | **Photo** | Live card preview with the webcam slotted into the photo frame. Capture, retake, optional **AI studio polish** (Gemini) and **remove background** (in-browser WebGPU). Pick orientation, size, and a default template right here. |
| 2 | **Details** | The card preview *is* the form. Each text field (name, title, company, phone, email, website) is an editable input directly on the Aurora template. Or tap **Scan a paper card** to fill via camera + OCR (Tesseract) or QR (ZXing). |
| 3 | **Card + Share** | Final card on top, share options below: **Scan to phone** (QR) and **Email me** (auto-fired to the address from step 2). **Change style** returns to the template picker; **Clear my session** wipes everything. |

Behind the scenes the flow is implemented as four wizard steps internally
(Photo, Details, Style picker, Share) but the customer never lands on the
picker as a standalone screen — picking a template auto-advances through a
short build animation directly into Card + Share.

### Email behaviour

When the customer reaches the share screen, an email is **automatically**
sent to the address they entered in step 2. The email contains:

- A personalized "Hi {firstName}," greeting and a friendly intro.
- The **rendered card image** inline (PNG/JPEG snapshot captured client-side
  via `html2canvas`) — so the email looks like the card they just designed.
- A **downloadable PNG/JPEG** attachment of the same card (for "save to phone").
- A `.vcf` (vCard) attachment that opens directly in the phone's Contacts app.
- A **View on web** button linking to the public card at `/c/[id]`.

The form below stays usable for sending to a different address (e.g. a
colleague).

### The six templates

Three landscape (7:4) and three portrait (5:7) designs:

| Template | Orientation | Layout summary |
|---|---|---|
| **Aurora** | landscape | Photo + name as a wide hero row, title/company/contact + QR sharing the row below. Indigo → violet → cyan gradient. Edit-mode is the same shape so long names always fit. |
| **Mono** | landscape | QR-first minimal — large QR on the left, name on the right. Clean white + neutral-900. No photo or contact rows; everything's encoded in the QR. |
| **Sunset** | landscape | Same wide-name layout as Aurora with a warm orange → fuchsia → purple palette and italic company line. |
| **Neon** | portrait | QR-first minimal — large centered QR with the gradient name underneath. No photo. Best for a "name-tag with QR" feel. |
| **Forest** | portrait | Photo + QR top, name + title + company + contact rows below. Emerald → deep green gradient. |
| **Noir** | portrait | Centered circular photo with gold accents on a black canvas. Times New Roman serif for the name; uppercase tracking. **The default portrait template.** |

All templates use CSS container queries (`cqw` units) so typography scales
proportionally at every render size — the same design works at the picker
thumbnail (~250 px wide) and the share-screen hero (1400 px wide).

---

## The video review flow (`/reviews`)

Standalone broadcast-style video capture. Independent of the card flow.

1. **Intro form** — name, title (shown on the lower-third overlay),
   email, camera picker.
2. **Recording** — live video with overlays:
   - Step pips at top (`01 → 06`)
   - Countdown ring + current question prompt
   - Broadcast-style **lower-third** (red accent stripe + name + title +
     pulsing LIVE badge)
   - **Up next** preview between the video and controls
   - **Stop** button + **Next question** button
3. **Playback** — review the recording with **Retake** or **Send**.
4. **Done** — confetti + auto-reset (25 s).

Recording uses `MediaRecorder` (WebM on Chrome/Firefox, MP4 on Safari).
The blob uploads directly to S3 via a server-issued presigned PUT URL — no
streaming through Lambda. SES email confirmation with the playback link
follows on success.

Questions are configured in
[`lib/review-questions.ts`](lib/review-questions.ts) with per-question
durations.

---

## The admin dashboard (`/admin`)

Password-gated (HMAC cookie session, driven by `ADMIN_PASSWORD`).
Two tabs:

- **Cards** — count tile + table of all card sessions. Click a row to open
  the detail page with the **rendered card preview** (the actual designed
  template), the data grid, a link to the public card, and a **Resend
  email** form. Submitting captures the rendered card as PNG and ships it
  to the customer's email (or any address you type).
- **Reviews** — count tile + table of all submitted reviews. Detail page
  shows an embedded video player, full record, and a resend-email form.

The admin layout is a Next.js Server Component — it checks the auth
cookie on every request and returns the login form if missing. After
login, `router.refresh()` re-runs the layout and the dashboard appears.

---

## Quick start

**Requirements:** Node 20+, npm 10+. Camera needs **HTTPS or localhost**
(browser `mediaDevices` constraint).

```bash
git clone https://github.com/SatinderSidhu/digital-card-kiosk.git
cd digital-card-kiosk
npm install
npm run dev
```

Open <http://localhost:3000>. Allow camera permission when prompted.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3000 (Turbopack). |
| `npm run build` | Production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | ESLint. |
| `npx tsc --noEmit` | Type-check without emitting. |

---

## Deploy to AWS Amplify

The repo is pre-configured for AWS Amplify Hosting (Next.js SSR mode).
Build spec lives in [`amplify.yml`](amplify.yml).

1. **Sign in to the [AWS Amplify console](https://console.aws.amazon.com/amplify/)** → _Create new app → Host web app_.
2. **Connect GitHub** → authorize Amplify → pick `SatinderSidhu/digital-card-kiosk` → branch `main`.
3. Amplify auto-detects Next.js. Leave the build settings alone —
   `amplify.yml` declares phases, artifacts, and the env-var bridge into
   `.env.production` (Amplify console env vars are build-time-only; the
   shim makes them available at runtime to the SSR Lambda).
4. **Environment variables** under _App settings → Environment variables_:

   | Var | Required | Used for |
   |---|---|---|
   | `GEMINI_API_KEY` | Optional | AI studio polish + AI card extraction. Without it, those features 503 with a clear message; bg-removal + manual entry still work. |
   | `DYNAMODB_TABLE` | Yes for `/c/[id]` | Sessions table for cards (e.g. `digital-card-kiosk-sessions`). |
   | `DYNAMODB_REVIEWS_TABLE` | Yes for `/admin` reviews | Reviews table (e.g. `digital-card-kiosk-reviews`). |
   | `S3_PHOTO_BUCKET` | Yes for photos | Bucket name for kiosk-uploaded photos. |
   | `S3_REVIEW_BUCKET` | Yes for `/reviews` | Bucket name for uploaded review videos. |
   | `SES_FROM_EMAIL` | Yes for emails | Verified-in-SES sender (e.g. `noreply@kitlabs.us`). |
   | `ADMIN_PASSWORD` | Yes for `/admin` | Shared admin password (HMAC'd into the session cookie). |
   | `NEXT_PUBLIC_SITE_URL` | Recommended | Used by OG image and share URLs. |
   | `AWS_REGION` | Auto | Amplify usually injects this; override only if your AWS resources are in a different region. |

5. **Save and deploy.** Every push to `main` auto-deploys.
6. _(Optional)_ Add a custom domain under _App settings → Custom domains_.

> **Reminder:** when you add a *new* server-side env var, also append a
> line to the `.env.production` block in [`amplify.yml`](amplify.yml) so
> the SSR Lambda sees it at runtime. Forgetting this is the most common
> "env var is set but the app says it isn't" pitfall.

### AWS resource setup (one-time)

#### DynamoDB

Two tables, both with partition key `id` (String) and TTL attribute
`expiresAt`, on-demand billing:

- **Cards table** — `digital-card-kiosk-sessions` (or whatever
  `DYNAMODB_TABLE` is set to).
- **Reviews table** — `digital-card-kiosk-reviews` (or whatever
  `DYNAMODB_REVIEWS_TABLE` is set to).

After creating each, enable TTL (Additional settings → Time to live →
attribute name `expiresAt`).

#### S3

Two buckets, both in the same region as `AWS_REGION`:

- **Photos bucket** (`S3_PHOTO_BUCKET`) — public-read on the
  `photos/*` prefix so the public card page at `/c/[id]` can render
  them. Lifecycle rule expiring `photos/` after 30 days is a good
  match for the DynamoDB TTL.
- **Reviews bucket** (`S3_REVIEW_BUCKET`) — needs **CORS allowing
  `PUT`** from the kiosk origin (the client uploads directly via
  presigned URL) and a public-read policy on `reviews/*` so the
  emailed playback link works.

#### IAM (the Amplify SSR compute role)

The SSR Lambda runs under a role like `digital-card-kiosk-compute-role`.
Attach an inline policy granting:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/digital-card-kiosk-sessions",
        "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/digital-card-kiosk-reviews"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": [
        "arn:aws:s3:::digital-card-kiosk-photos/photos/*",
        "arn:aws:s3:::digital-card-kiosk-reviews/reviews/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["ses:SendRawEmail", "ses:SendEmail"],
      "Resource": "*"
    }
  ]
}
```

`dynamodb:Scan` is required by the admin dashboard to list cards/reviews.
`s3:GetObject` on photos is required by the admin card detail page to
inline the photo as a data URL for the html2canvas capture.

#### SES

1. Verify the sender domain or address (SES → Verified identities). Use
   the verified address as `SES_FROM_EMAIL`.
2. **Request production access** (Account dashboard → Request production
   access) to send to non-verified addresses. Sandbox mode caps you at
   200 emails/day, 1/sec, recipients-must-be-verified — fine for
   testing, blocks real customers.

The kiosk auto-emails the card on share, attaching both a PNG snapshot
and a `.vcf`. Email payload is well under the 10 MB SES limit (typical
~600 KB).

---

## Project structure

```
app/
  layout.tsx                root viewport / metadata
  page.tsx                  card builder (Photo / Details / Style / Share)
  globals.css               theme tokens, keyframes, glass/shimmer
  c/[id]/page.tsx           public card landing
  reviews/page.tsx          video review flow
  admin/
    layout.tsx              auth gate (LoginForm or AdminShell)
    page.tsx                Cards / Reviews tabs + count tiles + tables
    cards/[id]/page.tsx     card detail with rendered preview + send-with-PNG
    reviews/[id]/page.tsx   review detail with embedded player + send
  api/
    sessions/               cards CRUD (DynamoDB + S3 + SES)
    reviews/                review presigned upload + email
    admin/                  admin endpoints (login/logout + cards/reviews list/detail/email)
    enhance/                AI studio polish (Gemini)
    extract-card/           AI card-data extraction (Gemini)

components/
  ui.tsx                          shared buttons, inputs, segmented control
  marketing-slot.tsx              bottom 50% promo video
  template-picker.tsx             step-1 popover for choosing default template
  orientation-pills.tsx           step-1 landscape/portrait toggle
  size-pills.tsx                  step-1 S/M/L preview size
  camera-picker.tsx               header gear, persisted device id
  ai-polish-menu.tsx              AI studio polish style picker
  sections/                       photo / personalize / build / share + frame
  scanners/                       unified scanner (OCR + QR)
  forms/details-form.tsx          legacy form (kept for the scan-result merge)
  templates/card-templates.tsx    all six designs + shared PhotoFrame / QR
  reviews/                        intro-form / recorder / playback / done /
                                   question-overlay / lower-third
  admin/                          login-form / admin-shell / resend-email

lib/
  store.ts                        zustand wizard store
  review-store.ts                 zustand reviews store
  types.ts                        CardDetails, TemplateId, FACTORY_DEFAULT_TEMPLATE
  review-questions.ts             review question config + durations
  fake-data.ts                    FAKE_CARD + withFallback merger
  vcard.ts                        buildVcard(details, sessionId)
  parse-card.ts                   OCR + vCard / MECARD parsers
  mock-backend.ts                 client-side API helpers (historical naming)
  s3.ts                           uploadPhoto + presignReviewUpload
  db.ts                           saveSession / getSession / listSessions
                                   + saveReview / getReview / listReviews
  admin-auth.ts                   HMAC cookie session helpers

public/
  DigitalCardPromo.mp4            bundled marketing video

docs/
  BRD.md                          business requirements
  TRD.md                          technical requirements + API contract
  screenshots/                    README assets
```

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 App Router (Turbopack) |
| Language | TypeScript (strict) |
| Styling | Tailwind v4 (`@theme inline` tokens, CSS container queries) |
| State | `zustand` (separate stores: `useWizard` for cards, `useReview` for reviews) |
| Animation | `framer-motion` |
| Icons | `lucide-react` |
| Camera | `react-webcam` + native `getUserMedia` (for `MediaRecorder` in `/reviews`) |
| OCR | `tesseract.js` (dynamic-imported on first scan) |
| QR decode | `@zxing/browser` |
| QR encode | `qrcode.react` |
| Card snapshot | `html2canvas` (lazy-loaded; PNG/JPEG depending on caller) |
| Background removal | `@imgly/background-removal` (in-browser WebGPU/WASM) |
| AI image polish | Google Gemini 2.5 Flash Image (server-side) |
| AWS SDK | `@aws-sdk/client-{dynamodb,s3,ses,sns}`, `@aws-sdk/s3-request-presigner` |

---

## Runtime requirements

- **HTTPS or localhost** for camera + microphone.
- Tesseract.js downloads wasm + English traineddata on first scan
  (~10 MB). Bundle locally before production for offline kiosks.
- Touch-first (no hover-only affordances). Zoom disabled, overscroll
  blocked, text-selection blocked except in admin (which opts out
  inline).
- Optimized for a **tall portrait display** (~1080 × 1920+) but
  responsive enough to also work on a laptop.

---

## Requirements docs

- [`docs/BRD.md`](docs/BRD.md) — business requirements, goals, metrics, risks
- [`docs/TRD.md`](docs/TRD.md) — technical design, data model, API contract
- [`CHANGELOG.md`](CHANGELOG.md) — release history

## License

No license specified yet. Add one before distributing or deploying
externally.
