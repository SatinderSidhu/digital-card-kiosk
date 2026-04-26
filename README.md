# Digital Card Kiosk

[![CI](https://github.com/SatinderSidhu/digital-card-kiosk/actions/workflows/ci.yml/badge.svg)](https://github.com/SatinderSidhu/digital-card-kiosk/actions/workflows/ci.yml)

**Live demo:** <https://digitalcard.kitlabs.us>

A self-service kiosk that lets a walk-up customer build and share a digital
business card in under a minute — take a photo, scan an existing card or QR
code (or type), pick one of six designs, and send the result to your phone
via QR, SMS, or email.

Built with **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4**.
Camera capture, OCR, and QR decoding all run on-device. AI studio polish
runs server-side via **Google Gemini 2.5 Flash Image**, deployed on **AWS
Amplify Hosting**.

![Hero](docs/screenshots/00-hero.png)

---

## The four-step flow

| # | Step | What it does |
|---|---|---|
| 1 | **Photo** | Live card preview with the webcam slotted into the photo frame. Tap **Capture**, then **Update Info** to advance. |
| 2 | **Details** | Big card preview on the left; on the right, a unified camera that auto-detects QR codes (ZXing) and captures for OCR (Tesseract). Editable form after either. |
| 3 | **Style** | Pick one of six templates across **three landscape** and **three portrait** designs. A 1.6 s "Assembling your card..." animation bridges to the final state. |
| 4 | **Share** | Final card + three share channels: **Scan to phone** (QR), **Text me the link** (SMS), **Email me**. Confetti on success, auto-reset after 25 s. |

Below each step content sits a dedicated **marketing slot** (bottom 50 % of
the kiosk viewport) for a looping brand video or ad — swap the placeholder in
[`components/marketing-slot.tsx`](components/marketing-slot.tsx) for a `<video>`
element when the asset is ready.

## Screenshots

| Step 1 — Capture | Step 2 — Details |
|---|---|
| ![Step 1](docs/screenshots/01-capture.png) | ![Step 2](docs/screenshots/02-details.png) |

| Step 3 — Pick a style | Step 4 — Share |
|---|---|
| ![Step 3](docs/screenshots/03-style.png) | ![Step 4](docs/screenshots/04-share.png) |

> Drop PNGs into [`docs/screenshots/`](docs/screenshots/) using those filenames
> to replace the placeholders.

## The six designs

Three **landscape** (7:4) and three **portrait** (5:7) templates, each with a
distinct mood:

| Template | Orientation | Mood | Palette |
|---|---|---|---|
| **Aurora** | landscape | Professional | indigo → violet → cyan |
| **Mono** | landscape | Minimal | white / neutral-900 |
| **Sunset** | landscape | Creative | orange → fuchsia → purple |
| **Neon** | portrait | Playful | black + pink/cyan glow |
| **Forest** | portrait | Nature | emerald → deep green |
| **Noir** | portrait | Luxury | black + gold accents |

All templates use CSS container queries (`cqw` units) so typography scales
proportionally at every render size — from the 1400 px step-1 hero down to
the ~300 px picker thumbnail.

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

### Photo edit features (after capture)

Two opt-in floating buttons sit on the bottom-right of the photo card:

- **✨ Remove background** — runs `@imgly/background-removal` entirely
  in the browser (WebGPU/WASM). No API key, no upload. ~30 MB model
  download on first click, cached after.
- **🪄 AI studio polish** — POSTs the photo to a Next.js route handler
  at `/api/enhance` which calls **Google Gemini 2.5 Flash Image**.
  Returns a polished studio headshot in 5–15 s.

The AI polish requires a Gemini API key:

```bash
# .env.local (dev) or Amplify env vars (prod)
GEMINI_API_KEY=your_key_from_google_ai_studio
```

Without the key the route returns 503 with a helpful message; the
sparkles bg-removal button still works (it's all local).

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

The repo is pre-configured for AWS Amplify Hosting (Next.js SSR mode — keeps
server-side route handlers possible for future API calls). Build spec lives
in [`amplify.yml`](amplify.yml).

1. **Sign in to the [AWS Amplify console](https://console.aws.amazon.com/amplify/)** and click _Create new app → Host web app_.
2. **Connect GitHub** → authorize Amplify → pick `SatinderSidhu/digital-card-kiosk` → branch `main`.
3. Amplify auto-detects Next.js. Leave the build settings alone — `amplify.yml`
   already declares the correct phases and artifact path.
4. **Environment variables** under _App settings → Environment variables_:
   - `GEMINI_API_KEY` — required for the AI studio-polish button on the
     photo card and for AI card-extraction in step 2. Without it those
     features return 503 with a helpful message; bg-removal still works
     (all local).
   - `DYNAMODB_TABLE` — name of the DynamoDB table backing the public
     card pages (e.g. `digital-card-kiosk-sessions`). Without it the QR
     "Scan to phone" code points at a server that 503s.
   - `SES_FROM_EMAIL` — the verified-in-SES sender address used by the
     "Email me" button (e.g. `noreply@kitlabs.us`). Without it the
     email button returns 503 with a helpful message.
   - `NEXT_PUBLIC_SITE_URL` — recommended. Used by the OG image, vCard
     QR, and the share URL the kiosk hands out (e.g.
     `https://digitalcard.kitlabs.us`).
   - `AWS_REGION` — usually injected by Amplify automatically. Override
     only if your DynamoDB / SES / SNS resources are in a different
     region.
5. **Save and deploy.** First build takes ~3–4 min. You'll get a URL like
   `https://main.d2xxxxxx.amplifyapp.com`. Every push to `main` auto-deploys.
6. _(Optional)_ Add a custom domain under _App settings → Custom domains_.
   ACM certificate + HTTPS are free.

### DynamoDB setup (one-time, for Scan-to-phone + future SMS/email)

The public card page at `/c/[id]` reads session rows from DynamoDB.

1. **Create the table** in the DynamoDB console (or via the AWS CLI):
   - Name: `digital-card-kiosk-sessions`
   - Partition key: `id` (String)
   - Capacity mode: **On-demand** (cheapest at low traffic; scales to zero)
   - Once the table is _Active_, open it → _Additional settings_ → _Time to
     live (TTL)_ → enable, attribute name `expiresAt`. Sessions are saved
     with a 30-day TTL by default.
2. **Grant the Amplify SSR Lambda access.** Find the role under IAM that
   Amplify created for SSR (named like
   `amplifyconsole-backend-ServiceRole-…`) and attach an inline policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["dynamodb:GetItem", "dynamodb:PutItem"],
         "Resource": "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/digital-card-kiosk-sessions"
       }
     ]
   }
   ```
3. **Set `DYNAMODB_TABLE`** in Amplify env vars (step 4 above) and
   redeploy.

The kiosk's `/api/sessions` route handler returns 503 with a clear
message until both pieces (table + IAM) are in place, so partial setup
is safe to ship.

### SES setup (one-time, for the "Email me" button)

1. **Verify the sender** — SES console → _Verified identities_ →
   _Create identity_. Either verify a single email (e.g.
   `noreply@kitlabs.us`) or, better, verify the whole domain so any
   address on it works (DKIM records get added to your DNS).
2. **Request production access** if you want to email arbitrary
   recipients. The SES sandbox lets you only send to verified
   addresses — fine for testing, blocks real customers. Use the
   _Account dashboard → Request production access_ form; usually
   approved in under 24 h.
3. **Set `SES_FROM_EMAIL`** in Amplify env vars to that verified
   address.
4. **Grant the SSR Lambda `ses:SendRawEmail` permission** by
   extending the inline IAM policy from above:
   ```json
   {
     "Effect": "Allow",
     "Action": ["ses:SendRawEmail"],
     "Resource": "*"
   }
   ```

### SNS setup (one-time, for the "Text me the link" button)

1. **Leave the SMS sandbox.** SNS → _Mobile → Text messaging (SMS) →
   Sandbox destination phone numbers_. Either verify the phone
   numbers you'll test from, or _Request production access_ via the
   _Origination numbers_ workflow — same idea as SES.
2. **No env var to set** — SNS publishes directly to a phone number
   so there's nothing to configure beyond IAM.
3. **Grant the SSR Lambda `sns:Publish` permission**:
   ```json
   {
     "Effect": "Allow",
     "Action": ["sns:Publish"],
     "Resource": "*"
   }
   ```
4. (Optional) Set a custom Sender ID or Origination Number in SNS if
   you want SMS to come from "DIGICARD" instead of an Amazon pool
   number — costs vary by country and isn't supported in the US.

US SMS via SNS is **~$0.0075 per message**. Email via SES is
**~$0.10 per 1,000 messages**. Both are well within "rounding error"
for kiosk volume.

Camera, OCR, and QR decoding all need HTTPS — Amplify provides it by default
on both the auto-generated `*.amplifyapp.com` URL and any custom domain.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 App Router (client-rendered single page, Turbopack) |
| Language | TypeScript (strict) |
| Styling | Tailwind v4 (`@theme inline` tokens, CSS container queries) |
| State | `zustand` (one wizard store) |
| Animation | `framer-motion` |
| Icons | `lucide-react` |
| Camera | `react-webcam` |
| OCR | `tesseract.js` (dynamic-imported on first scan) |
| QR decode | `@zxing/browser` |
| QR encode | `qrcode.react` |

## Project structure

```
app/
  layout.tsx       kiosk viewport / metadata
  page.tsx         step switcher + sticky progress pills + step nav
  globals.css      theme tokens, keyframes, glass/shimmer

components/
  marketing-slot.tsx           bottom 50 % ad/video placeholder
  ui.tsx                       shared buttons, inputs, segmented control
  sections/
    section-frame.tsx          numbered badge + title + idle/active/done
    photo-section.tsx          step 1 — live card + capture
    personalize-section.tsx    step 2 — idle / scanning / form modes
    build-section.tsx          step 3 — pick + build animation
    share-section.tsx          step 4 — card + scan / sms / email
  scanners/
    unified-scanner.tsx        ZXing continuous QR + Tesseract capture
  forms/details-form.tsx       6-field form bound to store
  templates/card-templates.tsx all six designs + shared PhotoFrame / QR

lib/
  store.ts          zustand store (step, photo, details, template, session)
  types.ts          CardDetails, TemplateId, Orientation, section constants
  fake-data.ts      FAKE_CARD placeholder + withFallback merger
  vcard.ts          buildVcard(details, sessionId)
  parse-card.ts     OCR-text + vCard + MECARD parsers
  mock-backend.ts   mockCreateSession / mockSendEmail / mockSendSms

docs/
  BRD.md            business requirements
  TRD.md            technical requirements + API contract
  screenshots/      README assets
```

## Backend integration

Right now the share actions are mocked in
[`lib/mock-backend.ts`](lib/mock-backend.ts). Each function is a drop-in
replacement boundary:

| Mock function | Replace with |
|---|---|
| `mockCreateSession` | `POST /sessions` → returns `{ url }` (public landing for the card) |
| `mockSendEmail` | `POST /sessions/:id/email` with `{ email }` |
| `mockSendSms` | `POST /sessions/:id/sms` with `{ phone }` |

The scan-to-phone QR points at `${origin}/c/<sessionId>` — that public card
page needs to be implemented on the backend side.

Full API contract + retention / security notes are in [`docs/TRD.md`](docs/TRD.md) §6.

## Runtime requirements

- **HTTPS or localhost** for camera access.
- Tesseract.js downloads wasm + English traineddata on first scan (~10 MB).
  Plan to bundle `tessdata` locally before production.
- Touch-first (no hover-only affordances). Zoom disabled, overscroll blocked.
- Optimized for a **tall vertical display** (phone-proportioned, ~1080 × 1920+).

## Requirements docs

- [`docs/BRD.md`](docs/BRD.md) — business requirements, goals, metrics, risks
- [`docs/TRD.md`](docs/TRD.md) — technical design, data model, API contract,
  testing strategy, BR ↔ TR traceability

## License

No license specified yet. Add one before distributing or deploying
externally.
