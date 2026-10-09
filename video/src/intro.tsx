import React from "react";
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Bg, H, Kicker, P, Pop, Slam, Chip } from "./ui";
import { C, display, mono, s } from "./theme";

const NOTES = [
  "Did Mom take her pills?", "I think so?", "Which ones?", "Morning or evening?", "Not sure", "Ask Dad", "He's out",
  "She said yes", "Did she?", "Check the pillbox", "It's empty. Is that good?", "Who's checking tonight?", "Me?", "I thought you were", "???",
  "Did Mom take her pills?", "Text her", "She's not answering", "Seen",
];

/** 0 to 6 s: the family chat that cannot answer one question. */
export const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const freeze = s(3.4);
  const f = Math.min(frame, freeze);
  const shake = frame < freeze ? (random(`sh${frame}`) - 0.5) * 8 : 0;
  const dim = interpolate(frame, [freeze, freeze + 10], [1, 0.16], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Bg />
      <AbsoluteFill style={{ opacity: dim, transform: `translate(${shake}px, ${-shake / 2}px)` }}>
        {Array.from({ length: 60 }).map((_, i) => {
          const born = i * 1.5;
          if (f < born) return null;
          const left = random(`l${i}`) > 0.5;
          const x = left ? 60 + random(`x${i}`) * 560 : 1150 + random(`x${i}`) * 520;
          const y = 1080 - (f - born) * 9 - random(`y${i}`) * 80;
          const p = Math.min(1, (f - born) / 5);
          return (
            <div
              key={i}
              style={{
                position: "absolute", left: x, top: y, opacity: p,
                transform: `scale(${0.6 + p * 0.4}) rotate(${(random(`r${i}`) - 0.5) * 5}deg)`,
                fontFamily: display, fontSize: 30 + random(`s${i}`) * 14, fontWeight: 600,
                color: C.text, background: left ? "#1e2830" : "#17433f",
                padding: "12px 22px", borderRadius: left ? "22px 22px 22px 6px" : "22px 22px 6px 22px", whiteSpace: "nowrap",
              }}
            >
              {NOTES[i % NOTES.length]}
            </div>
          );
        })}
      </AbsoluteFill>
      {frame >= freeze ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <Slam at={3.45} size={150}>Nobody knows.</Slam>
          <Pop at={4.4} style={{ marginTop: 28 }}><P size={38}>The group chat doesn't remember.</P></Pop>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

/** 6 to 10.5 s */
export const Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 12 } });
  const glow = interpolate(Math.sin(frame / 14), [-1, 1], [0.35, 0.8]);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Bg />
      <div style={{ position: "absolute", width: 900, height: 900, borderRadius: 999, background: `radial-gradient(${C.accent}33, transparent 65%)`, opacity: glow }} />
      <div style={{ transform: `scale(${interpolate(p, [0, 1], [0.5, 1])})`, opacity: p, textAlign: "center" }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 260, letterSpacing: "-0.04em", color: C.text }}>
          Tend<span style={{ color: C.accent }}>.</span>
        </div>
      </div>
      <Pop at={0.9} style={{ position: "absolute", top: 700 }}>
        <P size={42} style={{ color: C.text }}>
          A real <span style={{ color: C.accent }}>MCP server</span> for care coordination
        </P>
      </Pop>
      <Pop at={1.5} style={{ position: "absolute", top: 780 }}>
        <Kicker color={C.muted}>Simulated Alexa+ display on top</Kicker>
      </Pop>
    </AbsoluteFill>
  );
};

/** 10.5 to 18.5 s: the problem, with a cited number. */
export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const n = Math.min(50, Math.round(interpolate(frame, [s(0.6), s(2.8)], [0, 50], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  return (
    <AbsoluteFill style={{ padding: "100px 140px" }}>
      <Bg />
      <Kicker>The problem</Kicker>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 40, marginTop: 30 }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 330, lineHeight: 0.85, color: C.accent, letterSpacing: "-0.05em" }}>~{n}%</div>
        <div style={{ paddingBottom: 26 }}>
          <H size={62}>of patients with chronic illness don't take their medicines as prescribed.</H>
        </div>
      </div>
      <Pop at={3.2} style={{ marginTop: 56 }}>
        <Chip size={26}>Brown &amp; Bussell, "Medication adherence: WHO cares?" Mayo Clin Proc 2011;86(4):304-314</Chip>
      </Pop>
      <Pop at={4.6} style={{ marginTop: 40 }}>
        <H size={58}>
          A voice assistant is already in the room. <span style={{ color: C.accent }}>It just can't remember.</span>
        </H>
      </Pop>
    </AbsoluteFill>
  );
};

const Box: React.FC<{ at: number; title: string; sub: string; real: boolean; w?: number }> = ({ at, title, sub, real, w = 360 }) => (
  <Pop at={at} from="scale">
    <div style={{ width: w, padding: "26px 26px", borderRadius: 20, background: C.panel, border: `2px solid ${real ? C.accent : C.line}`, boxShadow: real ? `0 0 40px ${C.accent}22` : undefined }}>
      <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, letterSpacing: "0.1em", color: real ? C.accent : C.amber, textTransform: "uppercase" }}>{real ? "REAL" : "SIMULATED"}</div>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 40, color: C.text, marginTop: 8 }}>{title}</div>
      <div style={{ fontFamily: display, fontSize: 24, color: C.muted, marginTop: 6, lineHeight: 1.25 }}>{sub}</div>
    </div>
  </Pop>
);

/** 18.5 to 27.5 s: what is real and what is simulated. */
export const Arch: React.FC = () => (
  <AbsoluteFill style={{ padding: "90px 100px" }}>
    <Bg />
    <Kicker>Honest architecture</Kicker>
    <H size={74} style={{ marginTop: 14 }}>Real server. <span style={{ color: C.amber }}>Simulated</span> Alexa+.</H>
    <div style={{ display: "flex", alignItems: "center", gap: 26, marginTop: 90 }}>
      <Box at={1.0} title="Alexa+ display" sub="web UI, labeled simulated everywhere" real={false} />
      <Pop at={1.5}><div style={{ fontFamily: mono, fontSize: 40, color: C.muted }}>→</div></Pop>
      <Box at={1.8} title="sim-host" sub="server-side MCP client, deterministic router" real={false} w={380} />
      <Pop at={2.3}><div style={{ fontFamily: mono, fontSize: 40, color: C.muted }}>→</div></Pop>
      <Box at={2.6} title="tend-server" sub="8 MCP tools, stateless Streamable HTTP" real w={400} />
      <Pop at={3.1}><div style={{ fontFamily: mono, fontSize: 40, color: C.muted }}>→</div></Pop>
      <Box at={3.4} title="SQLite" sub="durable care state" real w={300} />
    </div>
    <div style={{ display: "flex", gap: 18, marginTop: 70, flexWrap: "wrap" }}>
      <Pop at={4.4}><Chip color={C.accent}>MCP spec 2025-11-25 · Streamable HTTP</Chip></Pop>
      <Pop at={4.9}><Chip>No AI model · deterministic parser and templates</Chip></Pop>
      <Pop at={5.4}><Chip>$0 · no accounts · no keys</Chip></Pop>
    </div>
    <Pop at={6.2} style={{ marginTop: 34 }}>
      <P size={30}>The Alexa+ part is a stand-in that the hackathon rules allow. Everything behind it runs without it.</P>
    </Pop>
  </AbsoluteFill>
);
