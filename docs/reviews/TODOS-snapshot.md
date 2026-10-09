# TODOS

## Tend

### Fire TV elder companion screen (E4)

**What:** A Fire TV app showing the elder's next-dose card and a confirm button.
**Why:** Cross-device story; strong "creative" signal for judges.
**Pros:** Second demo surface; visible in the living room.
**Cons:** Needs Fire OS or Vega toolchain on Windows; second demo to record.
**Context:** Approach C in the design doc. Post-submission only.
**Effort:** human L / CC M
**Priority:** P3
**Depends on:** Core loop complete; Fire TV simulator set up.

### Multi-caregiver routing (E6)

**What:** Route escalations to several caregivers with roles and quiet hours.
**Why:** Real families have more than one caregiver.
**Pros:** Truer product; larger impact story.
**Cons:** Needs identity and auth; out of scope for v1.
**Context:** v1 is one caregiver per elder by design (design doc, Core behavior).
**Effort:** human M / CC S
**Priority:** P3
**Depends on:** Auth model decision.

### Caregiver evening (dark) theme

**What:** A dark theme for the caregiver view.
**Why:** Caregivers check alerts at night; a bright screen is harsh.
**Pros:** Better night use; shows design range.
**Cons:** Doubles token and contrast verification for little demo value.
**Context:** Deferred in design review (light mode chosen from the kitchen-counter daylight use scene). Tokens live in `DESIGN.md`.
**Effort:** human S / CC S
**Priority:** P3
**Depends on:** DESIGN.md exists.
