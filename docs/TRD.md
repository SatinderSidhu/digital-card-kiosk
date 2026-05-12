# Technical Requirements Document — Digital Card Kiosk

| Field | Value |
|---|---|
| Project | Digital Card Kiosk |
| Document owner | _TBD_ |
| Status | v1.5 — shipped |
| Last updated | 2026-05-08 |
| Companion doc | [BRD.md](BRD.md) · [CHANGELOG.md](../CHANGELOG.md) |

---

## 1. Scope

This TRD defines the technical design of the entire Digital Card Kiosk —
**both** the kiosk-customer surfaces (`/` card builder, `/reviews` video
review) and the operator surface (`/admin` dashboard). The backend lives
in the same repository as Next.js route handlers backed by AWS managed
services (DynamoDB, S3, SES, SNS, Bedrock-via-Gemini). §6 documents the
HTTP contract.

---

## 2. Architecture overview

```
┌─── Browser (kiosk display or admin laptop) ─────────────────────────────────┐
│                                                                             │
│  Next.js 16 App Router · Turbopack · React 19 · Tailwind v4                 │
│                                                                             │
│  ┌── Customer surfaces ──────────────────────────────────────────────────┐  │
│  │  /                     Card builder (Photo→Details→Card+Share)       │  │
│  │  /reviews              Video review (Intro→Recording→Playback→Done)  │  │
│  │  /c/[id]               Public card landing                           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌── Operator surface ──────────────────────────────────────────────────┐   │
│  │  /admin                Cards / Reviews tabs (count + list)           │   │
│  │  /admin/cards/[id]     Live card preview + resend (with PNG)         │   │
│  │  /admin/reviews/[id]   Video player + resend                         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  zustand stores: useWizard (cards) · useReview (videos)                     │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼  HTTPS
┌─── AWS Amplify SSR Lambda (server) ─────────────────────────────────────────┐
│                                                                             │
│  /api/sessions (POST)             create card row + photo→S3 + editToken    │
│  /api/sessions/[id] (POST)        token-gated cardholder edit               │
│  /api/sessions/[id]/email (POST)  SES email (type: card | followup);        │
│                                   card snapshot→S3, referenced by URL      │
│  /api/sessions/[id]/sms   (POST)  SNS publish (currently no UI)             │
│  /api/reviews             (POST)  presign S3 PUT for review video           │
│  /api/reviews/[id]/email  (POST)  SES sendEmail + persist review row        │
│  /api/admin/login,/logout (POST)  HMAC-cookie auth                          │
│  /api/admin/cards         (GET)   listSessions (Scan)                       │
│  /api/admin/cards/[id]    (GET)   getSession + inline photo as data URL     │
│  /api/admin/cards/[id]/email (POST)  proxy → /api/sessions/.../email        │
│  /api/admin/reviews(/[id]) (GET)  listReviews / getReview                   │
│  /api/admin/reviews/[id]/email (POST) proxy → /api/reviews/.../email        │
│  /api/enhance,/extract-card (POST) Gemini AI polish / card extraction       │
│                                                                             │
│  + server pages: /c/[id] (public, OG = S3 card snapshot)                    │
│                  /c/[id]/edit?t=… (token-gated manage app)                  │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        DynamoDB (sessions + reviews) · S3 (photos: photos/* + cards/*,
        reviews: reviews/*) · SES (email) · SNS (SMS) · Gemini API (AI)
```

All camera input, OCR, and QR decoding happen **on device**. The card
PNG snapshot is also captured client-side via `html2canvas`. The
customer's email is fired automatically the moment the share link is
ready — no extra button-press.

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
`PAGE_TEMPLATES` exposes all six designs:
`["aurora", "mono", "sunset", "neon", "forest", "noir"]`.
`FACTORY_DEFAULT_TEMPLATE` is `"aurora"` — the target of the
"Reset to default" action in the step-1 template picker.

Aurora and Sunset use a **wide-name** layout: photo on the left, name
spans the full right side, title/company/contact + QR share the row
below. Mono and Neon are **QR-first** — large QR + name only, no photo
or contact rows. Forest and Noir keep the more traditional photo +
identity + contact stack.

### 4.7 Inline-editable templates
`TemplateProps` now accepts an optional `onEdit?: (patch:
Partial<CardDetails>) => void` callback. When provided, the receiving
template renders text fields as inline `EditableInput` elements
(transparent bg with a `bg-white/10` highlight) instead of plain text.
**Aurora honours `onEdit`**; the others fall back to read-only text.
Step 2 (`PersonalizeSection`) passes `setDetails` from the wizard
store as the `onEdit` so each keystroke updates the store and live
re-renders the card.

### 4.8 DynamoDB records — [lib/db.ts](../lib/db.ts)
```ts
type SessionRecord = {
  id: string;
  details: CardDetails;
  template: TemplateId;
  photoDataUrl: string | null;  // S3 URL once uploaded (legacy field name)
  cardImageUrl?: string | null; // S3 URL of the rendered-card JPEG snapshot;
                                // used in emails and as the /c/[id] OG image
  editToken?: string;           // 24-byte capability for /c/[id]/edit?t=…
  createdAt: number;            // unix seconds
  expiresAt: number;            // unix seconds (DynamoDB TTL attribute)
};

type ReviewRecord = {
  id: string;            // matches the S3 object key prefix
  name: string;
  title: string | null;
  email: string;
  videoUrl: string;      // public S3 URL
  videoMimeType: string;
  createdAt: number;     // unix seconds
  expiresAt: number;     // unix seconds (DynamoDB TTL attribute)
};
```
Mutators: `saveSession` (Put), `updateSession` (cardholder edit — patches
details/template/photoDataUrl/cardImageUrl), `setSessionCardImage`,
`setSessionEditToken` — the last three are targeted `UpdateItem`s.

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

## 6. HTTP contract

All routes are Next.js route handlers under `app/api/*` running in the
Amplify SSR Lambda. Auth-gated routes return `401` when the
`admin_session` cookie is missing or invalid. Every route returns 503
with a clear error message when its required env vars aren't set, so
partial deploys are safe.

### 6.1 `POST /api/sessions`
Save a card session. Uploads `photoDataUrl` to S3 if it's a base64 data
URL, stores the URL on the row. Generates and stores an `editToken` (24
random bytes, base64url) so a manage link can be handed out later.

**Request**
```ts
{
  sessionId: string;
  details: CardDetails;
  template: TemplateId;
  photoDataUrl: string | null;
}
```
**Response** — `{ url: string }` (public short URL `/c/<id>`).

### 6.2 `POST /api/sessions/[id]` (cardholder edit)
Token-gated update from the manage page. The `editToken` is compared
constant-time against the stored value (`crypto.timingSafeEqual`).
`photoDataUrl` semantics: omitted ⇒ keep current; `null` ⇒ remove;
data URL ⇒ upload to S3 and replace. `cardImageDataUrl`, when present,
is uploaded to `cards/<id>.<ext>` and `cardImageUrl` is patched on the
row so the emailed image + OG unfurl track the edit.

**Request**
```ts
{
  editToken: string;
  details: CardDetails;
  template: TemplateId;
  photoDataUrl?: string | null;     // omit ⇒ keep, null ⇒ remove, data URL ⇒ replace
  cardImageDataUrl?: string | null; // fresh rendered-card jpeg/png snapshot
}
```
**Response** — `{ ok: true; photoDataUrl: string | null; cardImageUrl: string | null }`.
`401` missing token, `403` bad token, `404` no such card.

### 6.3 `POST /api/sessions/[id]/email`
Send an email via SES `SendRawEmail`. `type` selects the template:
`"card"` (default) = the as-shared card email; `"followup"` = the
thank-you / share-tips / "now you can manage your card" announcement.
The card image is **not attached** — `cardImageDataUrl` (or the row's
existing `cardImageUrl`) is uploaded to `cards/<id>.<ext>` and
referenced by URL in the body, so the email stays ~10 KB. MIME shape is
`multipart/mixed → multipart/alternative + text/vcard`. Lazily
backfills `editToken` if the row predates it, so the manage link can be
included.

**Request**
```ts
{
  email: string;
  type?: "card" | "followup";
  cardImageDataUrl?: string | null; // image/jpeg or image/png data URL
}
```
**Response** — `{ ok: true }` or `4xx`/`5xx` with `{ error }`. A leftover
413 pre-flight on raw-message size remains as defense-in-depth.

### 6.5 `POST /api/sessions/[id]/sms`
Currently in the codebase but not wired to any UI (SMS share was
removed in v1.2). Kept available behind the proper IAM if the SMS
share returns.

### 6.6 `POST /api/reviews`
Create a review session. Returns a presigned PUT URL the client uses
to upload the recorded video directly to `S3_REVIEW_BUCKET`.

**Request**
```ts
{ sessionId: string; contentType: "video/webm" | "video/mp4" | "video/quicktime" }
```
**Response** — `{ uploadUrl: string; objectUrl: string; key: string }`.

### 6.7 `POST /api/reviews/[id]/email`
Send the review confirmation email (with playback link). Persists a
`ReviewRecord` row best-effort after SES success so admin can list it.

**Request**
```ts
{
  email: string;
  name?: string;
  title?: string;
  videoUrl: string;
  videoMimeType: string;
}
```
**Response** — `{ ok: true }`.

### 6.8 `GET /c/[id]` and `GET /c/[id]/edit` (public + manage pages)
- `/c/[id]` — server-rendered (`app/c/[id]/page.tsx`). Renders the
  chosen template with the customer's data and a "Save to Contacts"
  button (vCard data-URL download). `generateMetadata` emits `og:image`
  + Twitter `summary_large_image` from `session.cardImageUrl` when
  present, so share-link unfurls preview the actual card.
- `/c/[id]/edit?t=<token>` — server-rendered
  (`app/c/[id]/edit/page.tsx`). Validates `?t=` against the stored
  `editToken` (constant-time); renders a clear error page on missing /
  invalid / expired. Inlines the photo as a data URL before handing it
  to the client editor so html2canvas capture + AI/bg ops work without
  S3 CORS. The editor (`components/manage/edit-client.tsx`) is a live
  `TemplateCard` preview + 6-field form + template picker + the
  `PhotoCapture` widget, and POSTs to `/api/sessions/[id]` on save.

### 6.9 Admin auth
- `POST /api/admin/login` — `{ password }` → sets HttpOnly +
  SameSite=Strict cookie containing
  `HMAC_SHA256(ADMIN_PASSWORD, "admin-session")`. 12-hour TTL.
- `POST /api/admin/logout` — clears the cookie.

### 6.10 Admin endpoints
All gated by the `admin_session` cookie.

- `GET /api/admin/cards` — list all sessions (DynamoDB `Scan`).
  Strips `photoDataUrl` from each row to keep the payload small.
  Returns `{ count, items: ListItem[] }`.
- `GET /api/admin/cards/[id]` — full record. **Photo is inlined as a
  base64 data URL** (the server fetches the S3 object) so the admin
  client can capture the rendered card via html2canvas without S3
  CORS configuration.
- `POST /api/admin/cards/[id]/email` — `{ email?, type?, cardImageDataUrl? }`
  proxies to `/api/sessions/[id]/email`. `email` defaults to the
  card's own; `type` ("card" | "followup") is forwarded — the admin
  list's per-row follow-up button POSTs `{ type: "followup" }`;
  `cardImageDataUrl`, when supplied (admin detail page), is forwarded
  so a fresh JPEG snapshot is uploaded.
- `GET /api/admin/reviews`, `GET /api/admin/reviews/[id]`,
  `POST /api/admin/reviews/[id]/email` — same shape but for the
  reviews table.

### 6.11 AI helper endpoints
- `POST /api/enhance` — `{ image, style? }` → `{ image }`.
  Server-side call to Gemini 2.5 Flash Image. Used by the kiosk's
  photo-section and the manage page's `PhotoCapture` widget.
- `POST /api/extract-card` — `{ image }` → `{ details: Partial<CardDetails> }`.

### 6.12 Security
- Enforce HTTPS (Amplify default).
- Validate `email` authoritatively server-side.
- Strip EXIF from photo on upload (TODO; not yet implemented).
- 30-day retention on cards (DynamoDB TTL + S3 lifecycle) and
  reviews. The cookie-bearing admin password is the only secret;
  everything else is per-session and ephemeral.
- Rate limit per IP on POST endpoints — TODO.

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
| BR-41, BR-41a, BR-41b | TR-42, TR-43, §6.3 |
| BR-42 | TR-44 |
| BR-43 | TR-44 |
| BR-44, BR-45 | `share-section.tsx` (change-style / clear-session) |
| BR-70–BR-75 | §6.6, §6.7, `app/reviews/`, `components/reviews/` |
| BR-80–BR-85 | §6.9, §6.10, `app/admin/`, `components/admin/` |
| BR-50, BR-51 | TR-01, `app/layout.tsx` viewport, `globals.css` |
| BR-52 | TR-50, TR-51, TR-52 |
| BR-60, BR-61 | §8 |
| BR-N1, BR-N2 | TR-N3, TR-N4 |
| BR-N4 | §6.6, §2 (on-device OCR / QR) |
