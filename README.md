# Digital Card Kiosk

A self-service kiosk that lets a walk-up customer build and share a digital
business card in under a minute — take a photo, scan an existing card or QR
code (or type), pick one of six designs, and send the result to your phone
via QR, SMS, or email.

Built with **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4**.
Camera capture, OCR, and QR decoding all run on-device.

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

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3000 (Turbopack). |
| `npm run build` | Production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | ESLint. |
| `npx tsc --noEmit` | Type-check without emitting. |

---

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
