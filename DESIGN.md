---
name: Tend simulator
version: 1
colors:
  ground: "#F3F6F5"
  panel: "#FFFFFF"
  ink: "#14201E"
  ink-2: "#3E4F4C"
  accent: "#0B6B61"
  attention: "#8A4B00"
  attention-bg: "#FBF1E3"
  line: "#C9D3D0"
typography:
  font-ui: "Lexend, IBM Plex Sans, sans-serif"
  elder: { item: 52px/600, time: 36px/400, button-label: 28px/600, status: 24px/600, body: 20px, sub: 18px, meta: 14px }
  caregiver: { body: 16px, alert: 18px, sub: 18px, heading: 20px/600, meta: 14px }
rounded: { control: 4px, panel: 12px }
spacing: [4, 8, 12, 16, 24, 32, 48]
motion: { ease: "cubic-bezier(0.16, 1, 0.3, 1)", duration: 300ms, uses: 1, status: "specified, not rendered; verified at build time" }
---

# Tend design system (simulator)

Visual reference: `docs/mockups/*.html` and `*.png`, rendered from `docs/mockups/tend.css`, which is the single source for these tokens. Plan decisions DS1-DS34 live in `docs/plans/PLAN.md`.

## Use scene
Light mode only. Kitchen counter in daylight, viewed from about 1.5 m (elder surface), and a caregiver on a phone or desktop. Dark theme is deferred (TODOS.md).

## Rules
- Classifier: OPERATE (app UI). No landing page, no hero.
- One panel on the kitchen display, no cards, no shadows, no gradients, no emoji, no icon-in-circle rows. Two radii only.
- Typeface: Lexend (self-host the font file; fallback IBM Plex Sans, never system-ui as primary). Lexend was chosen over Atkinson Hyperlegible after rendering: Atkinson's slashed zero made clock times read "8:00" as "8:Ø0".
- Contrast (measured): ink on ground 15.4:1, ink-2 on ground 7.96:1, accent on white 6.38:1, attention on white 6.8:1. Body text never below 4.5:1; elder body targets 7:1.
- Accent is for actions, focus and selection only. "Taken" is ink plus a check icon and the word. Overdue is attention color plus a clock icon and the word. Never color alone.
- Targets: elder primary button 72px tall; every elder control (Speak, input) 64px minimum; caregiver controls and the demo tray 48px.
- Focus ring: 3px solid accent, 2px offset, never removed. Theme `::selection`, `accent-color`, `caret-color`; tabular numerals on all times.
- One motion moment: on "I took it" the panel content moves up 12px and fades to the next dose in 300 ms ease-out. `prefers-reduced-motion` makes it instant.
- Copy: utility language. Elder: second person ("Next: ..."). Caregiver: plain third person. No exclamation points. Labels "Simulated Alexa+ display" and "Demo, not a medical device. Synthetic data." stay visible.
- Components (complete vocabulary): Panel, Button (primary, secondary), Banner (status, ok, offline variants), AlertRow, WeekStrip, Rail, Toast, DemoTray, Chip.
- Routes: `?view=kitchen` (elder only), `?view=care`, `?view=demo` (split on wide screens, stacked at 900px and below). No tab bar. Top bar and the footer "Demo, not a medical device. Synthetic data." on every route. The heading "Simulated Alexa+ display" sits directly above the Alexa lines.
- Timeline is an inline section; it shows a "Clock skipped ahead" marker whenever demo time was skipped.
- The mockup CSS imports Lexend from Google Fonts for convenience; the build self-hosts the font file with its OFL text and never fetches at runtime.
