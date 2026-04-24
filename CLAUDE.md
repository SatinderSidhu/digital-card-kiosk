@AGENTS.md

# Digital Card Kiosk — project context for Claude

## What this is
A kiosk web app (Next.js 16 App Router, TS, Tailwind v4) that lets a walk-up
customer build a digital business card and share it to their phone or email.

**Form factor:** a tall vertical display (phone-proportioned, ~480 px wide) —
digital signage in portrait, not a full iPad. The entire experience is a
**single scrolling page** with four progressively-revealed sections.

## The flow (one page, four sections)
1. **Start here** — capture headshot via front camera (`react-webcam`).
2. **Make it yours** — two live-preview templates (Aurora, Neon) showing
   `FAKE_CARD` placeholder data until the user provides their own via:
   - Scan Card → rear camera + Tesseract.js OCR → `parseCardText`
   - Scan QR → ZXing live decode → `parseScannedCode` (vCard/MECARD/plain)
   - Type → manual form
   Once a name is entered the input collapses to a compact summary with Edit.
3. **Pick your style** — tap one of the two templates → 1.6 s "building"
   animation → ready state.
4. **Take it with you** — final card + scan-to-phone QR (mocked session URL)
   + email form. Confetti on send; auto-reset after 25 s.

The active section is derived from store state (photo present, name present,
template picked) — there is no explicit step counter.

## Key files
- [lib/store.ts](lib/store.ts) — zustand store (`useWizard`). Holds
  `photoDataUrl`, `details`, `template: TemplateId | null`, `sessionId`,
  plus `ensureSession` (deferred client-side id to avoid hydration mismatch).
- [lib/types.ts](lib/types.ts) — `CardDetails`, `TemplateId`,
  `PAGE_TEMPLATES` (the two shown on the page), `SECTIONS`.
- [lib/fake-data.ts](lib/fake-data.ts) — `FAKE_CARD`, `withFallback`,
  `hasRealDetails`.
- [lib/vcard.ts](lib/vcard.ts) — `buildVcard(details, sessionId)`.
- [lib/parse-card.ts](lib/parse-card.ts) — OCR text → `CardDetails` heuristics
  + vCard/MECARD parsers.
- [lib/mock-backend.ts](lib/mock-backend.ts) — **mocked** session-create +
  email-send. Real backend swaps in here (search for `TODO`).
- [components/ui.tsx](components/ui.tsx) — shared `PrimaryButton`,
  `GhostButton`, `SegmentedControl`, `Field`, `TextInput`, `StepShell`.
- [components/sections/section-frame.tsx](components/sections/section-frame.tsx) —
  consistent chrome (numbered badge, title, idle/active/done state, pulse
  ring on active).
- [components/sections/](components/sections/) — four section components,
  one per file: `photo-section`, `personalize-section`, `build-section`,
  `share-section`.
- [components/scanners/](components/scanners/) — `card-scanner.tsx` (OCR),
  `qr-scanner.tsx` (ZXing).
- [components/forms/details-form.tsx](components/forms/details-form.tsx) —
  6-field editable form bound directly to the store.
- [components/templates/card-templates.tsx](components/templates/card-templates.tsx) —
  `TemplateCard` dispatcher + all three template designs (Aurora, Mono, Neon).
  Note: the page only exposes **Aurora + Neon** via `PAGE_TEMPLATES`; Mono is
  retained in code for future toggling.
- [app/page.tsx](app/page.tsx) — sticky header, progress-dots rail, the four
  section components stacked, auto-scroll on completion.
- [app/globals.css](app/globals.css) — dark aurora theme, glass/shimmer/pulse
  keyframes.

## Conventions
- All shared state lives in the zustand store. Don't duplicate it in local
  component state unless it's ephemeral UI (e.g. segmented-control mode,
  `phase: choose | building | done` inside `BuildSection`).
- Active-section calculation lives in `app/page.tsx`. Each section receives
  `state: "idle" | "active" | "done"` as a prop from the page.
- Animations use `framer-motion`. Prefer `layoutId` for shared-element
  transitions (see `SegmentedControl`).
- Icons come from `lucide-react`.
- Tailwind v4 — colors are in `@theme inline` in `globals.css`, not
  `tailwind.config`.
- `sessionId` MUST stay deterministic on first render (empty string) and be
  populated in a client effect via `ensureSession()` — otherwise QR SVG paths
  diverge and React hydration errors.

## Runtime requirements
- Camera + OCR + QR decode require **HTTPS or localhost** (browser
  mediaDevices constraint).
- Tesseract.js downloads wasm + English traineddata on first scan (~10 MB).
  Plan to bundle locally before production.
- Touch-optimized: `touch-action: manipulation`, no zoom, no text selection.
- Designed for a tall display; `max-w-[480px]` on the main container.

## What's mocked right now
- `lib/mock-backend.ts` — both session-create and email-send are fake. They
  return after a setTimeout. Replace with real API calls when the backend is
  ready.
- The scan-to-phone QR points at `${origin}/c/<sessionId>` — that route
  doesn't exist yet.

## Requirements docs
- [docs/BRD.md](docs/BRD.md) — business requirements
- [docs/TRD.md](docs/TRD.md) — technical requirements
