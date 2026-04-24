# Business Requirements Document — Digital Card Kiosk

| Field | Value |
|---|---|
| Project | Digital Card Kiosk |
| Document owner | _TBD_ |
| Status | Draft v0.2 |
| Last updated | 2026-04-23 |

---

## 1. Executive summary

The Digital Card Kiosk is a self-service web application that lets a walk-up
customer — at an event booth, showroom, reception desk, or conference stand —
create a personalised digital business card and share it to their own phone or
email in under one minute.

The customer takes a photo, provides their contact details (by scanning a
physical card, scanning a QR code, or typing), picks one of two visual
templates, and receives a shareable digital card. The kiosk resets
automatically for the next user.

The app is delivered as a browser-based kiosk experience optimised for a
**tall vertical display** (digital signage in portrait, phone-proportioned
width).

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
- **BR-41** The app SHALL accept an email address and email the card to the
  user.
- **BR-42** Successful sharing SHALL provide a clear, celebratory
  confirmation.
- **BR-43** After successful sharing, the app SHALL auto-reset within a
  configurable timeout (default 25 seconds).

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

- **v1.0 (MVP)** — Single-page flow with mocked backend (current state).
- **v1.1** — Real backend wired up, public card page `/c/[id]`, idle-reset on
  all sections, analytics events.
- **v1.2** — Operator lock, basic admin dashboard for session counts.
- **v2.0** — Multi-tenant branding, additional templates toggleable per
  deployment, multi-language, CRM webhook.

## 10. Open questions

1. Branding — does each deployment need its own theme, or is there one brand?
2. What email service will back `mockSendEmail`? (Postmark, SES, Resend?)
3. Does the shared card live forever or expire (e.g. 30 days)?
4. Is the user's photo stored server-side or only rendered at view time?
5. Consent / privacy copy — legal review needed before production.
6. Should the Mono template be exposed alongside Aurora/Neon, or held for a
   later release?
