import React from "react";
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Bg, Chip, H, Kicker, P, Pop, Slam } from "./ui";
import { C, display, mono, s } from "./theme";
import terminal from "./terminal.json";

/** Two real OS processes race; the database key lets exactly one escalation through. (Result is from test/concurrency.test.ts.) */
export const Concurrency: React.FC = () => {
  const frame = useCurrentFrame();
  const ticks = 30;
  const start = s(1.2), per = 5;
  const shown = (lane: number) => Math.max(0, Math.min(ticks, Math.floor((frame - start - lane * 2) / (per / 2))));
  const done = frame > start + ticks * (per / 2) + 8;
  const Lane: React.FC<{ lane: number; name: string }> = ({ lane, name }) => (
    <div style={{ marginBottom: 34 }}>
      <div style={{ fontFamily: mono, fontSize: 24, color: C.muted, marginBottom: 12 }}>{name} · check_misses × 30</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", width: 1060 }}>
        {Array.from({ length: ticks }).map((_, i) => {
          const on = i < shown(lane);
          const winner = lane === 0 && i === 0;
          return <div key={i} style={{ width: 28, height: 40, borderRadius: 7, background: !on ? C.panel : winner ? C.accent : "#2a3640", border: `1.5px solid ${winner && on ? C.accent : C.line}` }} />;
        })}
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ padding: "90px 110px" }}>
      <Bg />
      <Kicker>Idempotency under a race</Kicker>
      <H size={72} style={{ marginTop: 14 }}>Sixty checks. <span style={{ color: C.accent }}>One alert.</span></H>
      <div style={{ marginTop: 60, display: "flex", gap: 90 }}>
        <div>
          <Lane lane={0} name="process A" />
          <Lane lane={1} name="process B" />
        </div>
        <div style={{ paddingTop: 10 }}>
          <Pop at={4.8} from="scale">
            <div style={{ padding: "26px 34px", borderRadius: 22, background: C.panel, border: `2px solid ${C.accent}` }}>
              <div style={{ fontFamily: mono, fontSize: 22, color: C.muted }}>escalations</div>
              <div style={{ fontFamily: display, fontWeight: 800, fontSize: 130, color: C.accent, lineHeight: 1 }}>1</div>
              <div style={{ fontFamily: mono, fontSize: 22, color: C.muted, marginTop: 6 }}>notifications: 1</div>
            </div>
          </Pop>
        </div>
      </div>
      {done ? <Pop at={0} style={{ marginTop: 20 }}><Chip size={24}>test/concurrency.test.ts · two OS processes, one SQLite file, WAL + busy_timeout</Chip></Pop> : null}
    </AbsoluteFill>
  );
};

/** The real output of `npm run conformance`, typed out. */
export const Terminal: React.FC = () => {
  const frame = useCurrentFrame();
  const lines: string[] = terminal.lines;
  const shown = Math.min(lines.length, Math.floor((frame - s(0.9)) / 8));
  return (
    <AbsoluteFill style={{ padding: "80px 110px" }}>
      <Bg />
      <Kicker>Any MCP client can use it</Kicker>
      <H size={70} style={{ marginTop: 14 }}>The Inspector <span style={{ color: C.accent }}>connects.</span></H>
      <div style={{ marginTop: 40, background: "#07090b", border: `1.5px solid ${C.line}`, borderRadius: 18, padding: "26px 32px", fontFamily: mono, fontSize: 25, lineHeight: 1.6, minHeight: 560 }}>
        <div style={{ color: C.muted }}>$ npm run conformance</div>
        {lines.slice(0, Math.max(0, shown)).map((l, i) => (
          <div key={i} style={{ color: l.startsWith("PASS") ? C.text : C.accent, whiteSpace: "pre" }}>
            {l.startsWith("PASS") ? <span style={{ color: C.green, fontWeight: 700 }}>PASS</span> : null}
            {l.startsWith("PASS") ? l.slice(4) : l}
          </div>
        ))}
      </div>
      <Pop at={7.0} style={{ position: "absolute", right: 110, top: 96 }}><Chip size={22}>Real output · MCP Inspector CLI</Chip></Pop>
    </AbsoluteFill>
  );
};

const Stat: React.FC<{ at: number; n: string; label: string; accent?: boolean }> = ({ at, n, label, accent }) => (
  <Pop at={at} style={{ width: 760 }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 30 }}>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 130, lineHeight: 1, color: accent ? C.accent : C.text, minWidth: 250 }}>{n}</div>
      <div style={{ fontFamily: display, fontSize: 34, color: C.muted, lineHeight: 1.2 }}>{label}</div>
    </div>
  </Pop>
);

export const Stats: React.FC = () => (
  <AbsoluteFill style={{ padding: "80px 110px" }}>
    <Bg />
    <Kicker>Engineering, not slop</Kicker>
    <H size={72} style={{ marginTop: 12 }}>Built like it will run for real.</H>
    <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 40 }}>
      <Stat at={0.6} n="61" label="unit and integration tests" />
      <Stat at={1.1} n="13" label="browser tests on the demo script" />
      <Stat at={1.6} n="4/4" label="CI jobs green: Windows + Linux, Node 22 + 24" />
      <Stat at={2.1} n="8" label="MCP tools, one typed card contract" />
      <Stat at={2.6} n="$0" label="no cloud, no keys, no accounts" accent />
      <Stat at={3.1} n="0" label="AI models in the product" accent />
    </div>
    <div style={{ display: "flex", gap: 14, marginTop: 56, flexWrap: "wrap" }}>
      {["Escalation: unique key + one transaction", "Stateless Streamable HTTP", "Host + Origin checks, bearer if hosted", "Guardrail on every outgoing text", "Escaped rendering + strict CSP"].map((t, i) => (
        <Pop key={t} at={4.4 + i * 0.35}><Chip size={22}>{t}</Chip></Pop>
      ))}
    </div>
  </AbsoluteFill>
);

export const End: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Bg />
      <div style={{ position: "absolute", width: 1000, height: 1000, borderRadius: 999, background: `radial-gradient(${C.accent}2b, transparent 65%)` }} />
      <div style={{ transform: `scale(${interpolate(p, [0, 1], [0.7, 1])})`, opacity: p, textAlign: "center" }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 200, letterSpacing: "-0.04em", color: C.text }}>Tend<span style={{ color: C.accent }}>.</span></div>
      </div>
      <Pop at={0.8} style={{ marginTop: 10 }}><P size={40} style={{ color: C.text }}>A real MCP server with durable care state</P></Pop>
      <Pop at={1.6} style={{ marginTop: 40 }}>
        <Chip size={38} color={C.accent} style={{ border: `2px solid ${C.accent}`, fontFamily: mono }}>github.com/Guten-Morgen1302/tend-amazon</Chip>
      </Pop>
      <Pop at={2.6} style={{ marginTop: 34 }}>
        <div style={{ display: "flex", gap: 14 }}>
          <Chip size={24}>MIT licensed</Chip>
          <Chip size={24}>Amazon Developer Hackathon 2026 · Alexa+ track</Chip>
        </div>
      </Pop>
      <Pop at={3.6} style={{ marginTop: 26 }}><Kicker color={C.muted}>Not a medical device · synthetic data · Alexa+ display is simulated</Kicker></Pop>
    </AbsoluteFill>
  );
};
