# Business Requirements Document — Digital Card Kiosk

| Field | Value |
|---|---|
| Project | Digital Card Kiosk |
| Document owner | _TBD_ |
| Status | v1.5 — shipped |
| Last updated | 2026-05-08 |
| Companion | [CHANGELOG.md](../CHANGELOG.md) for release-by-release detail |

---

## 1. Executive summary

The Digital Card Kiosk is a self-service web application deployed at event
booths, showrooms, reception desks, and conference stands. It has three
distinct surfaces:

1. **Card builder (`/`)** — walk-up customer creates a personalised
   digital business card in under a minute. Photo + details + template +
   share via QR or email.
2. **Video reviews (`/reviews`)** — walk-up customer records a short
   broadcast-style video review answering pre-defined questions. Result
   uploads to S3 and the customer receives a playback link by email.
3. **Admin dashboard (`/admin`)** — password-gated staff view of every
   card and review with detail pages and a resend-email control.

The customer-facing flows are delivered as a browser-based kiosk
experience optimised for a **tall vertical display** (digital signage in
portrait, phone-proportioned width). The admin dashboard works on any
modern browser at any size.

---

## 2. Goals and objectives

### 2.1 Business goals
1. Capture qualified leads from walk-up traffic at events, showrooms, and
   retail locations, replacing paper sign-up sheets.
2. Provide a memorable, branded interaction ("cool factor") that
   differentiates the host brand.
3. Give the customer a tangible keepsake (their own digital card, reachable
   from their phone) that reinforces the brand.
4. Lower the friction of contact exchange compared with manual card hand-off
   or form-filling.

### 2.2 Success metrics
| Metric | Target |
|---|---|
| Completion rate (kiosk approached → card shared) | ≥ 70% |
| Average time-to-completion | ≤ 60 seconds |
| OCR auto-fill acceptance (fields not manually corrected) | ≥ 60% |
| Email delivery success | ≥ 98% |
| Kiosk idle-reset without user action | ≥ 95% (no stuck sessions) |

### 2.3 Non-goals (out of scope for v1)
- Native mobile app.
- Customer account / login / persistent profile history.
- Administrative CMS for template management.
- CRM integration (Salesforce, HubSpot, etc.).
- Multi-language support.
- Payments, upsells, or commerce flows.
- Printing a physical card at the kiosk.

---

## 3. Target users and use cases

### 3.1 Primary user — Walk-up customer
- Technical comfort ranges from low to high; cannot be assumed.
- Interacts only with the touchscreen; no keyboard, mouse, or external device
  expected (beyond their own phone and their own paper card).
- Session is single-use; user does not return to the kiosk later.

### 3.2 Secondary user — Venue staff / brand operator
- Places the kiosk, powers it on, and ensures it stays available.
- May need to reset or unlock the kiosk if something goes wrong.
- Will eventually want reporting on how many cards were created (v2).

### 3.3 Representative scenarios
1. **Event booth** — A prospect walks up, scans their paper card, takes a
   photo, picks a template, and emails the card to themselves.
2. **Showroom** — A customer browses templates while waiting, types their
   details, receives the card via QR to their phone.
3. **Reception desk** — A visitor checks in by creating a digital badge that
   doubles as a business card.

---

## 4. Functional requirements

IDs use the prefix **BR-** (business requirement).

### 4.1 Experience model
- **BR-01** The app SHALL present a **single scrolling page** with four
  clearly numbered sections: Capture → Personalize → Pick → Share.
- **BR-02** A persistent progress indicator SHALL show all four sections and
  visually distinguish completed, current, and upcoming sections.
- **BR-03** Each section's visual state (idle / active / done) SHALL be
  derived from the user's actual progress — no explicit Back/Next buttons.
- **BR-04** When a section completes, the page SHALL auto-scroll to bring the
  next active section into view.
- **BR-05** The session SHALL auto-reset to a fresh state after the user
  successfully shares their card.

### 4.2 Section 1 — Capture (photo)
- **BR-10** The app SHALL capture a photo using the device front camera.
- **BR-11** The user SHALL be able to retake the photo before moving on.
- **BR-12** The app SHALL NOT upload or persist the photo outside the current
  kiosk session in v1 (it is consumed only to render the digital card).

### 4.3 Section 2 — Personalize (preview + details entry)
- **BR-20** The section SHALL show **two distinct template previews** with
  the user's photo embedded.
- **BR-21** Until the user provides their own details, the previews SHALL
  render with labelled **sample data** so the customer can see the templates
  populated immediately.
- **BR-22** The app SHALL offer three entry modes for real details:
  **Scan physical card**, **Scan QR code**, **Type manually**.
- **BR-23** Scan physical card SHALL be the default mode.
- **BR-24** After any scan, the extracted fields SHALL be presented in an
  editable form for the user to confirm or correct.
- **BR-25** The app SHALL collect at minimum: full name, title, company,
  phone, email, website.
- **BR-26** Once a full name is captured, the input UI SHALL collapse to a
  compact summary with an Edit affordance, and the section is considered
  done.
- **BR-27** Template previews SHALL update in real time as the details
  change.

### 4.4 Section 3 — Pick (choose + build)
- **BR-30** The section SHALL show the same two templates as in Section 2,
  rendered tap-to-select.
- **BR-31** Tapping a template SHALL trigger a short "building" animation
  (≤ 2 s) before revealing the final card.
- **BR-32** Every template SHALL include a QR code (vCard payload) and a
  visible phone number.
- **BR-33** The user SHALL be able to change their selection after the build
  animation finishes.

### 4.5 Section 4 — Share
- **BR-40** The app SHALL display a QR code the user can scan with their
  phone to retrieve the card.
- **BR-41** The app SHALL automatically email the card to the address
  captured in step 2 the moment the share link is ready, without
  requiring an additional button press.
- **BR-41a** The email SHALL contain: a personalised greeting, the
  rendered card image inline (so the email itself looks like the card),
  a downloadable PNG/JPEG attachment of the card, a `.vcf` (vCard)
  attachment, and a "View on web" button linking to the public card
  page.
- **BR-41b** A secondary form SHALL be available so the customer can
  send the card to a different address (e.g. a colleague).
- **BR-42** Successful sharing SHALL provide a clear, celebratory
  confirmation.
- **BR-43** After successful sharing, the app SHALL auto-reset within a
  configurable timeout (default 25 seconds).
- **BR-44** The user SHALL be able to **change the chosen template
  without losing photo or details**.
- **BR-45** The user SHALL be able to **clear the session entirely**
  (wiping photo, details, and card from the kiosk) with a single
  action, intended for customers who want to walk away mid-flow.

### 4.6 Video reviews (`/reviews`)
- **BR-70** The app SHALL provide a separate route where the customer
  records a video review answering a configurable list of questions.
- **BR-71** The customer SHALL provide their name, title, and email
  before recording starts.
- **BR-72** The recording UI SHALL display, over the live video:
  step-position pips, the current question with a countdown ring, an
  "Up next" preview of the next question, and a broadcast-style
  lower-third overlay showing the recorder's name + title + a LIVE
  badge.
- **BR-73** The customer SHALL be able to advance to the next question
  before the timer expires, and SHALL be able to stop recording early.
- **BR-74** After recording, the customer SHALL be able to play back
  the video and either retake or submit.
- **BR-75** On submit, the video SHALL be uploaded to object storage
  and the customer SHALL receive a confirmation email with a playback
  link.

### 4.7 Admin dashboard (`/admin`)
- **BR-80** The admin route SHALL require authentication via a shared
  password.
- **BR-81** The dashboard SHALL show a count tile and list view for
  both cards and reviews, with newest first.
- **BR-82** Each list row SHALL link to a detail page.
- **BR-83** The card detail page SHALL render the actual card the
  customer designed (template + photo + QR), alongside a data grid.
- **BR-84** The card detail page SHALL provide a "Resend email" form
  that emails the rendered card (as an inline image and a downloadable
  attachment) to the address on file or to an alternate address typed
  by the operator.
- **BR-85** The review detail page SHALL embed the recorded video and
  provide the same resend-email control.

### 4.6 Kiosk behaviour
- **BR-50** The UI SHALL be optimised for touch on a tall portrait display
  (~480 px effective width).
- **BR-51** The UI SHALL prevent unintended zoom, text selection, and swipe
  gestures that could escape the app.
- **BR-52** The UI SHALL be visually lively (motion, transitions, feedback on
  interaction) to feel engaging and high-end.

### 4.7 Data handling and privacy
- **BR-60** The user's details and photo SHALL exist only for the duration of
  the session on the client, unless the user explicitly shares them (by QR or
  email).
- **BR-61** When the session resets, all personal data SHALL be cleared from
  memory.
- **BR-62** The app SHALL display, at minimum, a short privacy notice
  explaining that details are used only to produce the card.

---

## 5. Non-functional requirements

| ID | Requirement |
|---|---|
| BR-N1 | A full session (from first tap to card shared) SHOULD take ≤ 60 seconds for a typical user. |
| BR-N2 | Every user action SHOULD receive visible feedback within 100 ms. |
| BR-N3 | The app SHALL be usable on current Chromium and Safari on the target display hardware. |
| BR-N4 | The app SHALL not rely on an internet connection beyond what is needed to reach the backend and deliver email. OCR and QR decoding happen on-device. |
| BR-N5 | The kiosk SHALL be reachable by a brand operator for reset / unlock — method TBD for v2. |

---

## 6. Assumptions

- The kiosk will be supervised or in a controlled environment, so hardening
  against malicious input is limited to standard web app best practice.
- One language (English) for v1.
- The kiosk has reliable Wi-Fi.
- A real backend service will be provided before launch (see TRD §6).
- Only two templates are exposed in v1, even though a third (Mono) exists in
  code and can be enabled later.

## 7. Constraints

- Delivery as a web app (no App Store).
- Must run on the target display hardware in portrait orientation.
- Photo and details must not be retained on a third-party service without
  explicit share action from the user.

## 8. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Browser camera permission denied | Kiosk unusable | Operator-run setup checklist; display clear re-prompt |
| Poor OCR accuracy on low-quality cards | User frustration | Always land in editable form; allow fallback to Type |
| Email marked as spam | User doesn't receive card | Use authenticated sending domain (SPF/DKIM/DMARC) |
| User walks away mid-session | Stale session / privacy | Idle-reset timer across all sections (v1.1) |
| User thinks sample data is their own | Wrong card saved | "Showing sample data" label + Scan/Type required before Pick |

## 9. Release plan

See [CHANGELOG.md](../CHANGELOG.md) for full per-release detail.

- **v1.0 (MVP)** — _Shipped._ Single-page flow with mocked backend.
- **v1.1** — _Shipped._ Real backend wired up (DynamoDB + S3 + SES +
  SNS), public card page `/c/[id]`, AI features (studio polish + card
  extraction).
- **v1.2** — _Shipped 2026-05-04._ Reviews video flow, admin dashboard,
  step-1 template picker, step-2 inline editing, template-truncation
  fixes, default portrait template flipped to Noir, SMS share removed.
- **v1.3** — _Shipped 2026-05-05._ Auto-email on share with the
  customer's email from step 2; rendered-card PNG snapshot attached.
  amplify.yml env-var bridge.
- **v1.4** — _Shipped 2026-05-07._ Steps 3 + 4 merged into a single
  Card-and-share screen. Mono and Neon redesigned as QR-first cards.
  Email body redesigned (light theme, personalized greeting, inline
  card image). Email payload trimmed for SES/Lambda limits. Promo
  video bundled with the app.
- **v1.5** — _Shipped 2026-05-08._ Admin card detail renders the
  actual designed card preview; resend-email captures and attaches
  the PNG snapshot.
- **v2.0 (proposed)** — Multi-tenant branding, additional templates
  toggleable per deployment, multi-language, CRM webhook,
  analytics events, idle-reset on all sections, operator PIN.

## 10. Open questions

1. Branding — does each deployment need its own theme, or is there one
   brand? (Currently one — KitLabs.)
2. ~~What email service will back `mockSendEmail`?~~ → AWS SES
   (`SES_FROM_EMAIL`).
3. ~~Does the shared card live forever or expire?~~ → 30-day TTL on
   DynamoDB + matching S3 lifecycle.
4. ~~Is the user's photo stored server-side?~~ → Yes, in
   `S3_PHOTO_BUCKET` under `photos/<sessionId>.<ext>`, with a 30-day
   lifecycle.
5. Consent / privacy copy — legal review still needed before
   distribution outside KitLabs.
6. ~~Should the Mono template be exposed?~~ → All six templates are
   now exposed in the picker.
7. The video review flow accumulates personal video data — retention
   policy needs explicit legal sign-off (currently 30 days, matching
   cards).
8. Admin auth is a single shared password — fine for kiosk demos, not
   fine for multi-staff production. Multi-user with audit log is a v2
   item.
