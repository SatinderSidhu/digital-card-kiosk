# Technical Requirements Document — Digital Card Kiosk

| Field | Value |
|---|---|
| Project | Digital Card Kiosk |
| Document owner | _TBD_ |
| Status | Draft v0.2 |
| Last updated | 2026-04-23 |
| Companion doc | [BRD.md](BRD.md) |

---

## 1. Scope

This TRD defines the technical design of the Digital Card Kiosk **frontend**.
Backend design is included as an interface contract (§6) to be implemented by
a separate service.

v0.2 replaces the wizard model of v0.1 with a single-page, progressively
revealed, section-driven model — see §5.1.

---

## 2. Architecture overview

```
┌─────────── Target display (tall portrait, ~480 px wide, browser) ───────────┐
│                                                                             │
│   Next.js 16 App Router (client-rendered single page)                       │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │  app/page.tsx  (sticky header + 4-dot progress rail)                 │  │
│   │   ├─ PhotoSection        [1] Start here                              │  │
│   │   ├─ PersonalizeSection  [2] Make it yours                           │  │
│   │   │    ├─ 2× TemplateCard (live preview; fake data via withFallback) │  │
│   │   │    └─ SegmentedControl → CardScanner | QRScanner | DetailsForm   │  │
│   │   ├─ BuildSection        [3] Pick your style                         │  │
│   │   │    └─ 2× TemplateCard → tap → build animation → done             │  │
│   │   └─ ShareSection        [4] Take it with you                        │  │
│   │        ├─ final TemplateCard                                         │  │
│   │        ├─ Scan-to-phone QR (mockCreateSession URL)                   │  │
│   │        └─ Email form      (mockSendEmail)                            │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                             │                                               │
│                             ▼                                               │
│                     zustand store (useWizard)                               │
│      photoDataUrl · details · template?·sessionId · ensureSession           │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                    fetch / HTTPS (v1.1+)
                              ▼
              ┌────────────────────────────────┐
              │    Backend API                 │  ← not built in this repo
              │  - POST /sessions              │
              │  - POST /sessions/:id/email    │
              │  - GET  /c/:id (public)        │
              └────────────────────────────────┘
```

The page is one continuous vertical scroll. The "active" section is
**derived** from store state rather than held as an explicit step index.

All camera input, OCR, and QR decoding happen **on device**. No photo leaves
the kiosk unless the user explicitly shares.

---

## 3. Technology stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | One page, client-rendered. Re-read `AGENTS.md` before assuming older Next conventions. |
| Language | TypeScript 5.x | Strict mode. |
| Styling | Tailwind CSS v4 | `@theme inline` tokens in `globals.css`. |
| State | `zustand` | Single store (`useWizard`), no persistence, client-only `ensureSession`. |
| Animation | `framer-motion` 12.x | `AnimatePresence`, spring transitions, shared `layoutId`. |
| Icons | `lucide-react` 1.x | |
| Camera | `react-webcam` | Front camera for section 1; rear camera (`facingMode: environment`) for scans. |
| OCR | `tesseract.js` 7.x | Dynamic-imported only when scan mode is entered. |
| QR decode | `@zxing/browser` | Live decode loop via `decodeFromVideoDevice`. |
| QR encode | `qrcode.react` | SVG-rendered vCard payload. |
| Utilities | `clsx`, `zod` (reserved) | |

---

## 4. Data model

### 4.1 `CardDetails` — [lib/types.ts](../lib/types.ts)
```ts
type CardDetails = {
  fullName: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
};
```

### 4.2 `State` (the zustand store) — [lib/store.ts](../lib/store.ts)
```ts
type State = {
  photoDataUrl: string | null;
  details: CardDetails;             // empty by default
  template: TemplateId | null;      // null until user picks in §5.4
  sessionId: string;                // "" on SSR; filled by ensureSession()

  ensureSession: () => void;        // client-only; fixes hydration
  setPhoto, setDetails, replaceDetails, setTemplate, reset
};
```

`sessionId` **must** be `""` on first render (both server and client) and
populated from an effect after hydration; otherwise the QR SVG path attribute
diverges and React reports a hydration mismatch.

### 4.3 Derived active section (in [app/page.tsx](../app/page.tsx))
```
!photoDataUrl   → "capture"
!fullName       → "personalize"
!template       → "build"
otherwise       → "share"
```

### 4.4 Preview fallback — [lib/fake-data.ts](../lib/fake-data.ts)
- `FAKE_CARD` — labelled sample data (Alex Rivera / Northwind Studio).
- `withFallback(details)` — merges empty fields from `FAKE_CARD`; used by
  `PersonalizeSection` when `hasRealDetails(details) === false`.
- `BuildSection` and `ShareSection` use the real store details only; by then
  a full name is guaranteed.

### 4.5 vCard payload — [lib/vcard.ts](../lib/vcard.ts)
Every template renders a QR whose payload is a vCard 3.0 string built by
`buildVcard(details, sessionId)`. A `NOTE:session=<sessionId>` line is
included for later backend correlation.

### 4.6 Exposed templates
`PAGE_TEMPLATES = ["aurora", "neon"]` in [lib/types.ts](../lib/types.ts). The
Mono template is retained in
[components/templates/card-templates.tsx](../components/templates/card-templates.tsx)
for future toggling but is not rendered by the page.

---

## 5. Functional / UI requirements

IDs use the prefix **TR-** (technical requirement).

### 5.1 Single-page layout and progression
- **TR-01** `app/page.tsx` SHALL render the four section components stacked
  vertically inside a `max-w-[480px]` container.
- **TR-02** The active section SHALL be derived from store state as per §4.3;
  there is no explicit step counter.
- **TR-03** Each section SHALL receive a `state: "idle" | "active" | "done"`
  prop; `SectionFrame` renders the numbered badge, title, and visual
  treatment (pulse-ring on active, gradient + check on done).
- **TR-04** A sticky header SHALL render a 4-dot progress rail reflecting the
  same state.
- **TR-05** When a section transitions from active to done, the page SHALL
  call `scrollIntoView({ behavior: "smooth" })` on the next section's ref.

### 5.2 Section 1 — Capture ([photo-section.tsx](../components/sections/photo-section.tsx))
- **TR-10** Use `react-webcam` with `facingMode: "user"` and `mirrored`.
- **TR-11** Capture via `getScreenshot("image/jpeg")`; store as data URL.
- **TR-12** On capture, render a ~180 ms white flash overlay and invoke the
  `onCaptured` prop so the page can auto-scroll.
- **TR-13** Retake MUST clear `photoDataUrl` and return to live preview.

### 5.3 Section 2 — Personalize ([personalize-section.tsx](../components/sections/personalize-section.tsx))
- **TR-20** SHALL render both `PAGE_TEMPLATES` side-by-side in a 2-column
  grid with `withFallback(details)` until `hasRealDetails(details)` is true.
- **TR-21** A "Showing sample data" label SHALL be displayed while previews
  use fake data.
- **TR-22** A `SegmentedControl` SHALL toggle `Scan Card` | `Scan QR` |
  `Type` with shared-layout (`layoutId`) animation on the active pill.
- **TR-23** `CardScanner` SHALL use `facingMode: "environment"`, dynamic-
  import `tesseract.js`, show a scanning-line animation + progress %, parse
  via `parseCardText`, and patch the store.
- **TR-24** `QRScanner` SHALL decode continuously via
  `BrowserMultiFormatReader.decodeFromVideoDevice`, stop on first successful
  read, and dispatch `parseScannedCode` (handles vCard / MECARD / plain).
- **TR-25** `DetailsForm` SHALL bind directly to `details` via
  `setDetails(patch)`.
- **TR-26** When `hasRealDetails` is true and the user is not editing, the
  input UI SHALL collapse to a one-line summary with an Edit chip; the
  section is considered done.
- **TR-27** Template previews SHALL re-render reactively on each `details`
  patch.

### 5.4 Section 3 — Pick & Build ([build-section.tsx](../components/sections/build-section.tsx))
- **TR-30** SHALL render both `PAGE_TEMPLATES` as tap-to-pick cards with
  real user data, hover-lift and tap-shrink micro-interactions.
- **TR-31** Tapping a template SHALL set `template` in the store and enter
  the `building` phase.
- **TR-32** The `building` phase SHALL play a ≤ 2 s animation (scan-line,
  sparkle burst, grid pulse) over a single centered template render; at
  `BUILD_MS` (1600 ms) elapsed, the section transitions to the `done` phase
  and `onBuilt` is invoked.
- **TR-33** The `done` phase SHALL display the chosen card centered with a
  selection pill ("{Name} selected") and a **Change style** link that clears
  `template` and returns to the `choose` phase.

### 5.5 Section 4 — Share ([share-section.tsx](../components/sections/share-section.tsx))
- **TR-40** If `template === null`, the section SHALL render a locked
  placeholder ("Pick a style above to unlock sharing").
- **TR-41** On mount with a template, `mockCreateSession` SHALL be called
  and the returned URL rendered as a QR (`qrcode.react`).
- **TR-42** The email form SHALL validate client-side via
  `email.includes("@")` minimum; the server validates authoritatively.
- **TR-43** The "Send" button SHALL animate state: idle → sending (spinner)
  → sent (check). Error state re-enables with an inline message.
- **TR-44** On `sent`, a confetti + toast overlay SHALL appear, a 25-second
  countdown SHALL begin, and `reset()` SHALL fire when it ends.

### 5.6 Styling and motion
- **TR-50** Theme tokens (`--accent`, `--accent-2`, `--surface`, etc.) live
  in `globals.css` under `@theme inline`.
- **TR-51** Reusable motion primitives live in
  [components/ui.tsx](../components/ui.tsx) (`PrimaryButton`, `GhostButton`,
  `SegmentedControl`, `Field`, `TextInput`, `StepShell`).
- **TR-52** No hover-only affordances for primary actions (this is touch).

---

## 6. Backend interface contract (for the team implementing the service)

The frontend talks to the backend through a thin layer in
[lib/mock-backend.ts](../lib/mock-backend.ts). Each `mock*` function maps 1:1
to the real API call to be implemented.

### 6.1 `POST /sessions`
Create a shareable card session.

**Request body**
```ts
{
  sessionId: string;        // client-generated; server may accept or re-issue
  details: CardDetails;
  template: "aurora" | "mono" | "neon";
  photoDataUrl: string | null;  // base64; server should transcode + store
}
```
**Response**
```ts
{ url: string }  // public short URL, e.g. https://card.example/c/abc123
```

### 6.2 `POST /sessions/:id/email`
Send the card by email.

**Request body**
```ts
{ email: string }
```
**Response** — `{ ok: true }` on success; non-2xx with an error message
otherwise.

### 6.3 `GET /c/:id` (public landing)
Serves a branded page that renders the chosen template and offers "Save to
Contacts" (vCard download) and a back-link to the kiosk brand. Rate-limit and
expiry policy TBD.

### 6.4 Security
- Enforce HTTPS.
- Rate limit per IP on both POST endpoints.
- Validate `email` authoritatively server-side.
- Strip EXIF from photo on upload.
- Images and details should have a retention policy (default: 30 days, TBD
  with legal).

---

## 7. Non-functional requirements

| ID | Requirement |
|---|---|
| TR-N1 | Initial JS bundle SHOULD be ≤ 300 KB gzipped. Tesseract.js SHALL be dynamic-imported (not in initial bundle). |
| TR-N2 | First-paint on the target display ≤ 1.5 s on local Wi-Fi. |
| TR-N3 | Interactive latency on button tap ≤ 100 ms. |
| TR-N4 | App SHALL run at 60 fps during section transitions and the build animation. |
| TR-N5 | App SHALL be served over HTTPS (or localhost for dev). Camera APIs otherwise fail. |
| TR-N6 | No third-party analytics or tracking in v1. |
| TR-N7 | Server-rendered output SHALL match the client's first render (no hydration mismatches). `sessionId` is the known hazard and is handled by `ensureSession`. |

---

## 8. Security and privacy

- Photo + details are client-only until share action.
- On share, the minimum necessary data is sent to the backend.
- `reset()` discards all in-memory data.
- No localStorage / cookies for user data in v1.
- `touch-action: manipulation`, `user-scalable=no`, `overscroll-none` prevent
  accidental navigation away.
- Content Security Policy to be added at deploy time (script-src self +
  tesseract.js CDN unless bundled).

---

## 9. Build, deploy, environments

| Environment | URL | Notes |
|---|---|---|
| Local dev | `http://localhost:3000` | `npm run dev` (Turbopack). |
| Staging | TBD | Must be HTTPS for camera access. |
| Production | TBD | Must be HTTPS; served behind CDN. |

Build: `npm run build && npm start`.
Typecheck: `npx tsc --noEmit`.
Lint: `npm run lint`.

---

## 10. Testing strategy

### 10.1 Manual smoke tests (per release)
- Full happy path on the target display in portrait, front and rear camera.
- Each Section-2 mode scanned to completion and confirmed in the form.
- Both templates rendered with and without a photo, and with missing fields
  (fake-data fallback works).
- Build animation plays and transitions to ready in ≤ 2 s.
- Email send → confetti → auto-reset.
- Camera permission denied → graceful error, no crash.
- Hard-refresh the page → no React hydration warning in the console.

### 10.2 Automated (v1.1)
- Unit tests for `parseCardText`, `parseVcard`, `parseMecard`, `withFallback`,
  `hasRealDetails`, `buildVcard` (pure functions, high ROI).
- Playwright smoke test scrolling the single page with a stubbed camera.

---

## 11. Open technical questions

1. Bundle Tesseract traineddata locally vs. CDN? (Affects first-scan latency
   + offline behaviour.)
2. Should `photoDataUrl` be downscaled before upload? (Currently full-size
   JPEG.)
3. Idle-reset timer across all sections — desired timeout?
4. Operator PIN for kiosk lock — store where?
5. Accessibility: do we need VoiceOver-friendly labels in v1? (Currently
   minimal.)
6. Should the auto-scroll on completion be configurable / toggleable for
   accessibility?

---

## 12. Traceability

| BRD requirement | TRD requirement(s) |
|---|---|
| BR-01, BR-02, BR-03 | TR-01, TR-02, TR-03, TR-04 |
| BR-04 | TR-05 |
| BR-05 | TR-44 |
| BR-10, BR-11, BR-12 | TR-10, TR-11, TR-12, TR-13 |
| BR-20, BR-21 | TR-20, TR-21, §4.4 |
| BR-22, BR-23 | TR-22 |
| BR-24, BR-25 | TR-23, TR-24, TR-25 |
| BR-26 | TR-26 |
| BR-27 | TR-27 |
| BR-30, BR-32 | TR-30, §4.5 (QR payload) |
| BR-31 | TR-31, TR-32 |
| BR-33 | TR-33 |
| BR-40 | TR-41 |
| BR-41 | TR-42, TR-43, §6.2 |
| BR-42 | TR-44 |
| BR-43 | TR-44 |
| BR-50, BR-51 | TR-01, `app/layout.tsx` viewport, `globals.css` |
| BR-52 | TR-50, TR-51, TR-52 |
| BR-60, BR-61 | §8 |
| BR-N1, BR-N2 | TR-N3, TR-N4 |
| BR-N4 | §6.4, §2 (on-device OCR / QR) |
