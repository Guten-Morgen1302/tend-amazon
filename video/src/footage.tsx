import React from "react";
import { interpolate, spring, useCurrentFrame } from "remotion";
import { Chip, Code, Footage, H, Kicker, P, Pop } from "./ui";
import { C, display, mono, s } from "./theme";

/* Times inside each scene are seconds into its clip (see cut_clips.sh for the source mapping). */

export const AskScene: React.FC = () => (
  <Footage clip="clips/c1_ask.mp4" step={0}>
    <Kicker>Real MCP call</Kicker>
    <H size={66} style={{ marginTop: 14 }}>Ask. The server <span style={{ color: C.accent }}>answers.</span></H>
    <div style={{ marginTop: 40 }}>
      <Code
        at={2.4} step={0.55} size={21}
        lines={[
          { t: "// sim-host, a real MCP client", c: C.muted },
          { t: 'tools/call  whats_due', c: C.accent },
          { t: "// result.structuredContent", c: C.muted },
          { t: '{ "ui": "card", "layout": "panel",' },
          { t: '  "title": "Morning tablet",' },
          { t: '  "text": "Your morning tablet is due at 8:00 AM." }' },
        ]}
      />
    </div>
    <Pop at={5.6} style={{ marginTop: 26 }}><Chip size={22}>Routing is regular expressions, not an AI</Chip></Pop>
  </Footage>
);

export const SkipScene: React.FC = () => (
  <Footage clip="clips/c2_skip.mp4" step={1}>
    <Kicker color={C.amber}>Demo control, labeled</Kicker>
    <H size={66} style={{ marginTop: 14 }}>Skip the <span style={{ color: C.amber }}>clock.</span></H>
    <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 18, alignItems: "flex-start" }}>
      <Pop at={1.0} from="left"><Chip size={26}>Chip: "Demo time 9:02 AM (skipped +1 h)"</Chip></Pop>
      <Pop at={2.4} from="left"><Chip size={26}>Grace window: 60 minutes</Chip></Pop>
      <Pop at={3.8} from="left"><Chip size={26} color={C.bg} bg={C.amber} style={{ border: "none" }}>Past grace → overdue → one escalation</Chip></Pop>
    </div>
    <Pop at={4.8} style={{ marginTop: 30 }}><P size={26}>The skip is never hidden: it shows in the header and later in the timeline.</P></Pop>
  </Footage>
);

export const CareScene: React.FC = () => (
  <Footage clip="clips/c3_care.mp4" step={2}>
    <Kicker>The caregiver's side</Kicker>
    <H size={66} style={{ marginTop: 14 }}>One alert. <span style={{ color: C.accent }}>Once.</span></H>
    <div style={{ marginTop: 36 }}>
      <Code
        at={1.2} step={0.5} size={20}
        lines={[
          { t: "PRIMARY KEY (person, item,", c: C.accent },
          { t: "             local_date, slot_hhmm)" },
          { t: "INSERT OR IGNORE INTO escalations ...", c: C.muted },
          { t: "// MISSED + notification: one transaction", c: C.muted },
        ]}
      />
    </div>
    <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
      <Pop at={4.2} from="left"><Chip size={24}>"Mom has not logged her 8:00 morning tablet…"</Chip></Pop>
      <Pop at={5.6} from="left"><Chip size={24}>A fixed template, checked by a guardrail</Chip></Pop>
    </div>
  </Footage>
);

export const LateScene: React.FC = () => (
  <Footage clip="clips/c4_late.mp4" speed={1.2} step={3}>
    <Kicker>Resolve, don't repeat</Kicker>
    <H size={66} style={{ marginTop: 14 }}>Late dose.<br /><span style={{ color: C.accent }}>Alert resolved.</span></H>
    <div style={{ marginTop: 38, display: "flex", flexDirection: "column", gap: 18, alignItems: "flex-start" }}>
      <Pop at={1.6} from="left"><Chip size={25}>+15 min → "I took my morning pills"</Chip></Pop>
      <Pop at={4.2} from="left"><Chip size={25} color={C.bg} bg={C.accent} style={{ border: "none" }}>Follow-up: "Logged at 9:17 AM, 77 minutes late."</Chip></Pop>
      <Pop at={6.0} from="left"><Chip size={25}>Second notification sent: 0</Chip></Pop>
    </div>
    <Pop at={7.2} style={{ marginTop: 28 }}><P size={26}>The timeline closes with "Late dose logged".</P></Pop>
  </Footage>
);

export const PhoneScene: React.FC = () => (
  <Footage clip="clips/c8_phone.mp4" step={2} phone>
    <Kicker>Same server, any screen</Kicker>
    <H size={66} style={{ marginTop: 14 }}>The caregiver, <span style={{ color: C.accent }}>on a phone.</span></H>
    <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 18, alignItems: "flex-start" }}>
      <Pop at={1.4} from="left"><Chip size={25}>Alerts, newest first, with follow-ups</Chip></Pop>
      <Pop at={3.2} from="left"><Chip size={25}>Week as a seven-row list below 420px</Chip></Pop>
      <Pop at={5.0} from="left"><Chip size={25}>Timeline of exactly what happened</Chip></Pop>
      <Pop at={6.8} from="left"><Chip size={25}>Words and icons, never colour alone</Chip></Pop>
    </div>
  </Footage>
);

export const BadScene: React.FC = () => (
  <Footage clip="clips/c5_bad.mp4" step={4}>
    <Kicker color={C.amber}>Safety · guardrail</Kicker>
    <H size={66} style={{ marginTop: 14 }}>Never gives <span style={{ color: C.amber }}>advice.</span></H>
    <div style={{ marginTop: 36 }}>
      <Code
        at={2.0} step={0.6} size={21}
        lines={[
          { t: 'input  "Aspirin 500 mg dosage at 8am"', c: C.text },
          { t: 'findBanned(name) → "mg"', c: C.amber },
          { t: 'isError: "Names cannot contain advice', c: C.amber },
          { t: '          or dosing words"', c: C.amber },
          { t: "// nothing stored, nothing echoed", c: C.muted },
        ]}
      />
    </div>
    <Pop at={5.6} style={{ marginTop: 24 }}><Chip size={22}>Every outgoing text passes the same check</Chip></Pop>
  </Footage>
);

export const XssScene: React.FC = () => (
  <Footage clip="clips/c6_xss.mp4" speed={1.5} step={4}>
    <Kicker color={C.amber}>Safety · input</Kicker>
    <H size={66} style={{ marginTop: 14 }}>Markup is <span style={{ color: C.amber }}>refused.</span></H>
    <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
      <Pop at={1.0} from="left"><Chip size={24}>Names: letters, digits, space . ' - only</Chip></Pop>
      <Pop at={2.2} from="left"><Chip size={24}>Rendered with textContent, never innerHTML</Chip></Pop>
      <Pop at={3.4} from="left"><Chip size={24}>CSP: script-src 'self'</Chip></Pop>
    </div>
  </Footage>
);

export const GoodScene: React.FC = () => (
  <Footage clip="clips/c7_good.mp4" speed={1.4} step={4}>
    <Kicker>Confirm before save</Kicker>
    <H size={66} style={{ marginTop: 14 }}>Propose. <span style={{ color: C.accent }}>Confirm.</span> Save.</H>
    <div style={{ marginTop: 36 }}>
      <Code
        at={1.0} step={0.6} size={21}
        lines={[
          { t: 'parse_schedule("Noon tablet at 12pm")', c: C.accent },
          { t: "→ proposal + version (never saves)", c: C.muted },
          { t: "set_schedule(items, version)", c: C.accent },
          { t: "→ stale version is rejected", c: C.muted },
        ]}
      />
    </div>
    <Pop at={4.2} style={{ marginTop: 24 }}><Chip size={22}>Deterministic parser, ten golden cases</Chip></Pop>
  </Footage>
);
