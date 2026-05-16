# Changelog

All notable changes to this project. Format loosely based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning is
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.0] — 2026-05-16

### Added
- **Admin → Marketing.** A new section in the admin portal for sending
  rich-HTML emails to cardholders. `/admin/marketing` lists templates,
  and `/admin/marketing/templates/[id]` is a split editor: a form on
  the left (name, subject, HTML body) with clickable merge-tag chips,
  and a live preview iframe on the right that re-renders ~400 ms after
  each keystroke. The preview's "Render with" dropdown picks any real
  contact from the cards table; a placeholder data set is used if none
  is selected. Buttons under the editor: **Save**, **Send test** (one
  address), **Send to all** (every contact with a valid email,
  throttled to ~12/sec to stay under SES's 14/sec production cap).
- **Merge tags** — `{{firstName}}`, `{{fullName}}`, `{{title}}`,
  `{{company}}`, `{{phone}}`, `{{email}}`, `{{website}}`, `{{cardUrl}}`,
  `{{manageUrl}}`, `{{cardImageUrl}}`. Defined in
  [lib/marketing.ts](lib/marketing.ts); rendered with a small,
  lenient regex engine that silently collapses unknown tags so typos
  never make it into recipients' inboxes as the literal `{{ ... }}`.
- **Starter template.** On the empty list page, "Start from example"
  seeds a re-engagement email — "{{firstName}}, your digital card can
  be edited any time" — leading with the card image and a primary CTA
  to the manage link. Good first send for reaching customers who
  don't realise the card is editable.
- **Marketing templates DynamoDB table** — schema mirrors the others
  (partition key `id`, on-demand billing). New env var
  `DYNAMODB_TEMPLATES_TABLE`; `amplify.yml` bridges it like the rest.
  IAM addition: `dynamodb:GetItem/PutItem/UpdateItem/DeleteItem/Scan`
  on the new table.

### Changed
- **Admin shell nav.** Replaced the back-button toggle with persistent
  top-level tabs (Overview · Marketing) so navigation between sections
  is one click from anywhere under `/admin`.

## [1.6.0] — 2026-05-12

### Added
- **Cardholder management app — `/c/[id]/edit`.** The card email now
  includes a private "Manage your card" link. Opening it gives the
  cardholder a self-serve editor: live `TemplateCard` preview, a
  6-field details form, the template picker, and a `PhotoCapture`
  widget with the same camera + AI studio polish (Gemini) + in-browser
  background removal + undo as the kiosk's step-1 photo column. Saving
  re-renders the card snapshot, persists the edit to DynamoDB, and
  re-uploads the S3 snapshot so the emailed image + OG unfurl track
  the change. The public `/c/[id]` reflects edits immediately.
- **Edit-token capability model.** Each session gets a random
  `editToken` (24 bytes, base64url) at create time — the token gates
  `/c/[id]/edit?t=…` and `POST /api/sessions/[id]`. Same posture as
  the public card link (whoever holds the random `id` can view it).
  Compared constant-time server-side. Older rows are lazily backfilled
  by the email route.
- **`POST /api/sessions/[id]`** — token-validated update endpoint.
  Body `{ editToken, details, template, photoDataUrl?, cardImageDataUrl? }`;
  `photoDataUrl` omitted ⇒ keep, `null` ⇒ remove, data URL ⇒ upload &
  replace.
- **`components/photo-capture.tsx`** — standalone, store-agnostic
  webcam-capture widget extracted from the kiosk's photo-section
  logic. Plain `value`/`onChange` interface so it drops in anywhere.
- **Admin → per-row "follow-up email" button.** Next to every card in
  the admin list, a button that sends a thank-you / share-tips /
  manage-your-card announcement email — "Thank you so much for
  creating your digital card", a preview image (the S3-hosted
  snapshot, not heavy inline content), tips for sharing the public
  link, and the private manage link with the note that the cardholder
  can now edit their profile and swap templates.

### Changed
- **`/api/sessions/[id]/email`** now takes a `type: "card" | "followup"`
  body param (default `"card"`); the admin proxy
  (`/api/admin/cards/[id]/email`) forwards it. The HTML/text body
  builders were factored into a shared helper.
- **Card snapshot hosted on S3 instead of email-attached.** The
  rendered-card JPEG is uploaded to `S3_PHOTO_BUCKET/cards/<id>.jpg`
  and referenced by URL in the email body (with a "Save image to your
  phone" link) — the email itself stays ~10 KB regardless of card
  complexity. The URL is persisted on the session row.
- **`/c/[id]` OpenGraph image.** `generateMetadata` now emits
  `og:image` + Twitter `summary_large_image` from
  `session.cardImageUrl`, so pasting the share link into
  iMessage/Slack/Twitter unfurls with the actual rendered card.
- **`SessionRecord`** gains `editToken?` and `cardImageUrl?` columns.
  New DB helpers: `setSessionEditToken`, `setSessionCardImage`,
  `updateSession`.

### Fixed
- **Admin card-resend 500s.** The admin detail-page resend was OOMing
  the SSR Lambda on JSON parse — PNG snapshot (2-4 MB binary) plus the
  admin → public proxy hop exceeded the 6 MB sync request cap. Switched
  the admin capture to JPEG @ 0.85 (matching the kiosk path).

### Ops
- IAM: the SSR role now needs `dynamodb:UpdateItem` (used by
  `updateSession` / `setSessionEditToken` / `setSessionCardImage`) and
  `s3:PutObject` on the `cards/*` prefix. The `S3_PHOTO_BUCKET` policy
  needs public-read extended to `cards/*`.

## [1.5.0] — 2026-05-08

### Added
- **Admin → Card detail: live preview + send-with-PNG.** The admin detail
  page at `/admin/cards/[id]` now renders the actual `TemplateCard`
  the customer designed (template + photo + QR) instead of a flat data
  grid. The "Resend email" form on the same page captures the rendered
  card via `html2canvas` and ships it as a PNG attachment so the
  recipient can save it to their phone.
- **Server-side photo inlining** on the admin GET — the photos S3 URL
  is fetched and converted to a base64 data URL inside
  `/api/admin/cards/[id]` so the client capture works without a CORS
  configuration on the photos bucket.
- **`ResendEmail` component now accepts an `attachImage` getter** —
  callers (currently only the cards detail page) can supply a function
  that returns a data URL right before submit. The reviews detail page
  is unchanged.

### Changed
- **`/api/admin/cards/[id]/email`** forwards an optional
  `cardImageDataUrl` to the underlying public email route, so admin
  resends now produce the same inline-rendered email + PNG attachment
  as the kiosk auto-send.

## [1.4.0] — 2026-05-07

### Added
- **Promo video bundled with the app.** The kiosk's bottom-half
  `MarketingSlot` previously held a placeholder; it now plays
  `public/DigitalCardPromo.mp4` on a muted autoplay loop. Asset is
  served from the same origin to skip a network round-trip and avoid
  S3 CORS surface. Cache-buster (`?v=2`) on the URL forces a fresh
  fetch when the file is overwritten.
- **Step 3 ⟷ Step 4 merged** from the customer's perspective. After
  the build animation runs (~1.6 s), the wizard auto-advances straight
  to the share screen — there's no separate "card is ready, click
  Continue" intermediate state. The share screen now exposes:
  - **Change style** — clears the chosen template and steps back to
    the picker.
  - **Clear my session** — confirm-reset that wipes photo, details,
    and card from this kiosk and hard-reloads the page (also clears
    `sessionStorage`).

### Changed
- **Mono and Neon redesigned as QR-first templates.** Both drop the
  photo and contact rows in favour of a hero QR + name layout. The
  vCard encoded in the QR carries every contact field on scan.
- **Email body redesign** — light theme, personalized "Hi
  {firstName}," greeting, the card snapshot rendered inline as the
  hero of the email (via `cid:` reference), with the same PNG also
  available as a downloadable attachment. Falls back to the previous
  styled HTML card when no snapshot is attached.
- **Email MIME structure** moved to `multipart/mixed → multipart/related`
  so inline `cid:` images work cleanly in Gmail, Outlook 365, and
  Apple Mail.

### Fixed
- **SES "500 / payload too large" failures** on long sessions. The
  client capture switched from `image/png @ scale 1.5` to `image/jpeg
  @ scale 1.0 quality 0.85`, and the server stopped sending the PNG
  twice (single image part with `Content-ID + Content-Disposition:
  attachment`). Pre-flight size check rejects emails over 9.5 MB with
  a clean 413 instead of letting SES return a generic 400. Better
  error logs (`[email] SES send failed (Name): message — raw size N`)
  for CloudWatch.

## [1.3.0] — 2026-05-05

### Added
- **Auto-email at the share screen.** The customer's email address
  (captured in step 2) is fired as soon as the share link is
  generated — they walk away with the card already in their inbox
  without pressing a button. The form below morphs into "Send to
  another address" so they can still mail it to a colleague.
- **PNG card snapshot attached to the email.** `html2canvas` captures
  the rendered card client-side and the data URL is forwarded through
  the email API, which attaches it as a MIME part next to the existing
  `.vcf`.
- **`amplify.yml` env-var bridge** — Amplify console env vars are
  available at build time only; they need to be written into
  `.env.production` for the SSR Lambda to see them at runtime. New
  vars added to the bridge: `ADMIN_PASSWORD`, `S3_REVIEW_BUCKET`,
  `DYNAMODB_REVIEWS_TABLE`.

## [1.2.0] — 2026-05-04

Major release: video reviews flow and admin dashboard.

### Added
- **`/reviews` — video review kiosk.** A separate flow from the
  digital card builder. Captures name, title, email, then records a
  question-by-question video review with a broadcast-style lower-third
  (CNN/BBC chyron with name + title + LIVE badge), step pips,
  countdown ring, and an "Up next" preview. Camera picker + S/M/L
  size selector (persisted in store). Pre-defined questions in
  [`lib/review-questions.ts`](lib/review-questions.ts). Direct PUT
  upload to a presigned S3 URL, then a confirmation email via SES
  with the playback link.
- **`/admin` — password-protected dashboard.** HMAC-cookie session
  auth (driven by `ADMIN_PASSWORD`). Two tabs:
  - **Cards** — count tile, list of all sessions with name / company /
    email / template / created. Click into a detail page with all
    fields, photo, and a "Resend email" form.
  - **Reviews** — count tile, list of all submitted reviews. Detail
    page with embedded video player + resend.
- **Step 1 — Template picker.** A `Style: <Name> ▾` popover next to
  the orientation pills lets customers preset any of the 6 templates
  as the session default before reaching step 3. Includes a "Reset
  to default" link that snaps back to `FACTORY_DEFAULT_TEMPLATE`
  (Aurora) without disturbing photo or details.
- **Step 2 — Inline editing on the Aurora preview.** Each text field
  (name, title, company, phone, email, website) renders as a styled
  input on the card itself. The previous "Type manually" form view is
  removed; the card *is* the form.
- **Reviews persistence** — review records saved to DynamoDB
  (separate table via `DYNAMODB_REVIEWS_TABLE`) on email-send
  success, so they show up in the admin dashboard.

### Changed
- **Aurora and Sunset templates restructured** so the name spans the
  full right side (~70% of card width) with title/company/contact +
  QR sharing the row below. Fixes long-name and long-email
  truncation that was clipping anything over ~12 characters at picker
  sizes.
- **Mono template** contact column gained `flex-1 min-w-0` and a
  tighter clamp so emails stop ellipsis-cutting.
- **Default portrait template** flipped from Neon to Noir. Neon is
  now a minimal QR-only design, which made it a poor first impression
  for the portrait pill.

### Removed
- **SMS share** ("Text me the link") panel removed from step 4.
  Email + Scan-to-phone remain. The `mockSendSms` helper and
  `/api/sessions/[id]/sms` route are still in the codebase but no
  longer wired to any UI.

## [1.1.0]

### Added
- **Real backend wiring.** The previously mocked share actions now
  hit AWS-backed routes:
  - `POST /api/sessions` — saves to DynamoDB (`DYNAMODB_TABLE`),
    uploads photo to S3 (`S3_PHOTO_BUCKET`), returns the public URL.
  - `POST /api/sessions/[id]/email` — sends via SES from
    `SES_FROM_EMAIL` with text + html bodies and a `.vcf` attachment.
  - `POST /api/sessions/[id]/sms` — sends via SNS.
  - `GET /c/[id]` — public card landing page.
- **AI features.**
  - `/api/enhance` — server-side AI studio polish via Google Gemini
    2.5 Flash Image (requires `GEMINI_API_KEY`).
  - `/api/extract-card` — AI-assisted card data extraction.
- **Photo edit floating buttons** on the photo card: AI studio
  polish, remove background (`@imgly/background-removal`, runs
  entirely in-browser), undo stack.
- **Camera picker** in the header — gear icon, persists selected
  device id in `localStorage`.
- **Orientation pills** at step 1 (live preview switches between
  landscape/portrait defaults).
- **S/M/L size picker** at step 1 for the live preview.

## [1.0.0]

### Added
- Initial kiosk: single-page, four-section flow (Photo, Details,
  Style, Share).
- Front-camera capture via `react-webcam`.
- Card scanner (Tesseract.js OCR) and QR scanner (`@zxing/browser`).
- Six templates — Aurora, Mono, Sunset (landscape) and Neon, Forest,
  Noir (portrait) — with `cqw` container-query typography that
  scales from picker thumbnails up to the kiosk hero.
- Mock backend (`lib/mock-backend.ts`) so the UI is reviewable
  end-to-end without AWS plumbing.
