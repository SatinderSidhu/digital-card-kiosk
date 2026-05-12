@AGENTS.md

# Digital Card Kiosk — project context for Claude

## What this is

Three-surface kiosk app (Next.js 16 App Router, TS, Tailwind v4):

| Route | Audience | Purpose |
|---|---|---|
| `/` | Walk-up customer | Build a digital business card and share it |
| `/reviews` | Walk-up customer | Record a 6-question video review |
| `/admin` | Venue staff | Password-gated dashboard over cards + reviews |

**Form factor:** tall vertical display (~1080×1920+). Compact mode is
also supported for laptop testing.

## The card flow (`/`)

Internally a 4-step zustand wizard, presented to the customer as **3
logical steps** because the picker auto-advances after the build animation:

1. **Photo** — front-camera capture via `react-webcam`. AI studio polish
   (Gemini) and remove-background (`@imgly/background-removal`) are
   opt-in floating buttons. Step-1 controls also include the orientation
   pills, the S/M/L size pills, and the **template picker** popover
   (lets the customer set any template as the session default upfront,
   with a Reset to default that snaps back to `FACTORY_DEFAULT_TEMPLATE`).
2. **Details** — the Aurora preview *is* the form. Each text field
   (`fullName`, `title`, `company`, `phone`, `email`, `website`) renders
   as a styled inline input directly on the card. The legacy split-form
   view is removed. **Scan a paper card** (camera + Tesseract OCR + QR
   via ZXing) is still available.
3. **Card + Share (steps 3 + 4 merged)** — picking a template runs a
   1.6s build animation, then auto-advances to the share screen. Card
   on top, Scan-to-phone QR + Email panel below. Email is **auto-fired**
   to the address from step 2 the moment the share link is ready, with:
   - Inline rendered card image (cid:) in the email body.
   - Downloadable PNG/JPEG card attachment.
   - vCard `.vcf` attachment.
   - View on web button → `/c/[id]`.
   Bottom row has **Change style** (back to picker), **Start over**, and
   **Clear my session** (confirm + reset + sessionStorage clear + hard
   reload). Auto-resets after 25s in kiosk mode.

The active section in `app/page.tsx` is derived from store state — no
explicit step counter exposed in code beyond the wizard step number.

## The card management flow (`/c/[id]/edit`)

The card email includes a private "Manage your card" link
(`/c/[id]/edit?t=<editToken>`). The `editToken` is a 24-byte random
capability stored on the session row (generated at create time, lazily
backfilled by the email route for older rows). Same security posture as
the public `/c/[id]` link — whoever holds the random value gets access.
Token is compared constant-time server-side (`crypto.timingSafeEqual`).

- [app/c/[id]/edit/page.tsx](app/c/%5Bid%5D/edit/page.tsx) — server
  component. Validates `?t=` against the stored token (renders a clear
  error page on missing / invalid / expired). Inlines the photo as a
  data URL (fetches the S3 object) so the editor can preview it, run
  AI/bg ops on it, and capture the card snapshot via html2canvas without
  needing S3 CORS. Renders `<EditClient>`.
- [components/manage/edit-client.tsx](components/manage/edit-client.tsx) —
  live `TemplateCard` preview + 6-field form + `TemplatePicker` popover
  + `<PhotoCapture>` widget + Save. Save captures a fresh JPEG snapshot
  (scale 1, quality 0.85), POSTs to `/api/sessions/[id]`, shows "Saved".
- [app/api/sessions/[id]/route.ts](app/api/sessions/%5Bid%5D/route.ts) —
  `POST` token-gated update. Body `{ editToken, details, template,
  photoDataUrl?, cardImageDataUrl? }`. `photoDataUrl` omitted ⇒ keep,
  `null` ⇒ remove, data URL ⇒ upload & replace. Re-uploads the card
  snapshot to S3 and patches `cardImageUrl` so the emailed image + OG
  unfurl track the edit.
- [components/photo-capture.tsx](components/photo-capture.tsx) —
  standalone, store-agnostic webcam-capture widget (capture / retake /
  AI studio polish via `AiPolishMenu` + `/api/enhance` / in-browser
  background removal / undo / remove). The kiosk's `photo-section`
  predates this and is left untouched; `PhotoCapture` is what the
  manage page uses, and what new surfaces should reuse.

## The review flow (`/reviews`)

Independent of the card flow; separate zustand store
(`lib/review-store.ts`).

1. **Intro** — name, title, email, camera picker.
2. **Recording** — `MediaRecorder` on `getUserMedia({video,audio})` with
   broadcast-style overlays (step pips, countdown ring, lower-third
   chyron with name + title + LIVE badge, "Up next" preview).
   S/M/L size selector. **Stop** + **Next question** controls.
3. **Playback** — review with Retake or Submit.
4. **Done** — confetti + auto-reset.

Submit flow: presigned PUT to `S3_REVIEW_BUCKET` via
`/api/reviews` → SES email via `/api/reviews/[id]/email`. The email
endpoint also writes a row to `DYNAMODB_REVIEWS_TABLE` so the review
shows up in `/admin`.

## The admin dashboard (`/admin`)

HMAC cookie session, driven by `ADMIN_PASSWORD`
(see [lib/admin-auth.ts](lib/admin-auth.ts)). Server component layout at
[app/admin/layout.tsx](app/admin/layout.tsx) gates every admin route by
checking the cookie; renders `<LoginForm>` or `<AdminShell>` accordingly.

- `/admin` — Cards / Reviews tabs with count tiles + list tables. Each
  card row has a **follow-up email** button (`<FollowupButton>`) that
  POSTs `{ type: "followup" }` — sends the thank-you / share-tips /
  "now you can manage your card" announcement email. Manages its own
  idle/sending/sent/error state.
- `/admin/cards/[id]` — **Renders the actual card preview** as the
  hero (photo + chosen template + QR), data grid, and resend-email
  form. Submit captures the rendered card via `html2canvas` (JPEG @
  0.85 — PNG was OOMing the SSR Lambda on the proxy hop) and ships it
  to the email. The photo is inlined as a data URL by the API so
  capture works without S3 CORS configuration.
- `/admin/reviews/[id]` — Embedded video player + record + resend form.

Admin email endpoints proxy to the public SES routes (`type` forwarded)
so SES rendering stays single-source.

## Key files

- [lib/store.ts](lib/store.ts) — `useWizard`. Holds `step`, `mode`,
  `photoDataUrl`, `details`, `template`, `sessionId`, `cameraDeviceId`.
  `ensureSession()` is the deferred client-side id assignment that
  prevents hydration mismatches on the QR SVG.
- [lib/review-store.ts](lib/review-store.ts) — `useReview`. Holds
  `phase` (`intro` / `recording` / `playback` / `done`), `sessionId`,
  `name`, `title`, `email`, `videoBlob`, `videoSize`.
- [lib/types.ts](lib/types.ts) — `CardDetails`, `TemplateId`,
  `PAGE_TEMPLATES` (all six), `FACTORY_DEFAULT_TEMPLATE` (Aurora).
- [lib/review-questions.ts](lib/review-questions.ts) — review question
  config + per-question durations.
- [lib/fake-data.ts](lib/fake-data.ts) — `FAKE_CARD`, `withFallback`,
  `hasRealDetails`.
- [lib/vcard.ts](lib/vcard.ts) — `buildVcard(details, sessionId)`.
- [lib/parse-card.ts](lib/parse-card.ts) — OCR-text → `CardDetails`
  heuristics + vCard/MECARD parsers.
- [lib/mock-backend.ts](lib/mock-backend.ts) — client-side API
  helpers; the `mock*` prefix is historical, these now hit real route
  handlers backed by AWS.
- [lib/db.ts](lib/db.ts) — DynamoDB helpers: `saveSession`, `getSession`,
  `updateSession` (cardholder edit), `setSessionCardImage`,
  `setSessionEditToken`, `listSessions` (+ save/get/list for reviews).
  `SessionRecord` has optional `cardImageUrl` and `editToken` columns.
- [lib/s3.ts](lib/s3.ts) — `uploadPhoto` (`photos/<id>.<ext>`),
  `uploadCardImage` (`cards/<id>.<ext>`, `Content-Disposition:
  attachment`), `presignReviewUpload`, `isS3Configured`,
  `isReviewS3Configured`.
- [lib/admin-auth.ts](lib/admin-auth.ts) — HMAC cookie helpers.
- [components/ui.tsx](components/ui.tsx) — shared `PrimaryButton`,
  `GhostButton`, `SegmentedControl`, `Field`, `TextInput`, `StepShell`.
- [components/sections/](components/sections/) — `photo-section`,
  `personalize-section` (inline-edit on Aurora), `build-section`
  (picker only — no done state, auto-advances), `share-section`
  (combined with done state UI; auto-fires email; has change-style +
  clear-session).
- [components/templates/card-templates.tsx](components/templates/card-templates.tsx) —
  `TemplateCard` dispatcher + all six designs. **All templates accept
  an optional `onEdit` prop**; Aurora honours it (rendering inputs
  inline). `EditableInput` is the helper for the inline-edit fields.
- [components/template-picker.tsx](components/template-picker.tsx) —
  step-1 popover for choosing default template. Includes Reset to default.
- [components/marketing-slot.tsx](components/marketing-slot.tsx) —
  bottom-half kiosk video player; sources `/DigitalCardPromo.mp4` from
  `/public` (bundled).
- [components/reviews/](components/reviews/) — `intro-form`, `recorder`,
  `playback`, `done-state`, `question-overlay`, `lower-third`.
- [components/admin/](components/admin/) — `login-form`, `admin-shell`,
  `resend-email` (with optional `attachImage` getter).
- [app/page.tsx](app/page.tsx) — sticky header, step pills, the four
  section components stacked, auto-scroll on completion.
- [app/globals.css](app/globals.css) — dark aurora theme, glass/shimmer/
  pulse keyframes.

## Conventions

- All shared state lives in zustand stores. Don't duplicate it in local
  component state unless it's ephemeral UI (e.g. `phase` inside
  `BuildSection`, popover open/close).
- Each section receives `state: "idle" | "active" | "done"` from the
  page; `SectionFrame` renders the chrome.
- Animations use `framer-motion`. Prefer `layoutId` for shared-element
  transitions.
- Icons come from `lucide-react`.
- Tailwind v4 — colors are in `@theme inline` in `globals.css`, not
  `tailwind.config`.
- `sessionId` MUST stay deterministic on first render (empty string)
  and be populated in a client effect via `ensureSession()` — otherwise
  the QR SVG path attribute diverges on hydration.
- **`Math.random()` and other impure calls aren't allowed during
  render** under the React 19 lint rules. Use `useState(() => ...)`
  lazy initializers (see `Confetti` in `share-section.tsx`) or compute
  in a `useEffect`.
- **`setState` directly inside an effect body** is also linted out. Wrap
  in an async IIFE so the call lands in a microtask
  (`void (async () => { setX(...); })()`).

## Email & SES

`/api/sessions/[id]/email` takes a `type: "card" | "followup"` body
param (default `"card"`):

- **`card`** — the as-shared email: greeting, the card image, View on
  web, Manage your card link, `.vcf` attachment.
- **`followup`** — thank-you / share-tips / "now you can manage your
  card" announcement. Same building blocks, restructured copy. Fired
  by the admin list's per-row follow-up button via the
  `/api/admin/cards/[id]/email` proxy.

The card image is **not attached** — `uploadCardImage` writes the JPEG
to `S3_PHOTO_BUCKET/cards/<id>.jpg`, persists the URL on the session
row, and the HTML body references it via `<img src="…">` plus a "Save
image" link. So the email itself is ~10 KB regardless of card weight —
no more Lambda OOMs / SES "message too large". MIME shape is just
`multipart/mixed → multipart/alternative + text/vcard`. The same S3 URL
is the OG image for `/c/[id]`.

Client-side captures (kiosk share-section, admin resend, manage-page
save) all use JPEG @ scale 1.0 quality 0.85 — the request body that
carries the data URL to the route still has the 6 MB Lambda sync cap, so
JPEG (not PNG) everywhere. A leftover 413 pre-flight on rawMessage size
stays as defense-in-depth.

## Runtime requirements

- Camera + OCR + QR decode + MediaRecorder require **HTTPS or
  localhost**.
- Tesseract.js downloads wasm + English traineddata on first scan
  (~10 MB).
- Touch-optimized: `touch-action: manipulation`, no zoom, no text
  selection (admin opts out inline).
- Designed for a tall display; `max-w-[480px]` constrains the kiosk
  layout in compact mode but admin and per-step containers go wider
  on landscape.

## What's still placeholder / TODO

- **Tesseract traineddata** is fetched from CDN on first scan; bundle
  locally for production-grade kiosks that may run offline.
- **Card-page rate limit** on `/c/[id]` and `/api/sessions` — not
  implemented.
- **`mockSendSms` + `/api/sessions/[id]/sms`** still exist but aren't
  wired to any UI. Safe to delete if SMS is never coming back.
- **Per-deployment branding** (multi-tenant) — out of scope; single
  brand only.

## Documentation

- [README.md](README.md) — entry point: live demo, surfaces, setup
- [CHANGELOG.md](CHANGELOG.md) — release history
- [docs/BRD.md](docs/BRD.md) — business requirements
- [docs/TRD.md](docs/TRD.md) — technical requirements + API contract
