import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, display, mono } from "./theme";

export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: `linear-gradient(135deg, ${C.bg} 0%, #0f1a1c 60%, #0a2a2a 100%)`, overflow: "hidden" }}>
    <div style={{ position: "absolute", left: 56, top: 52, padding: "10px 22px", background: C.accent, color: C.bg, fontFamily: mono, fontWeight: 700, fontSize: 28, letterSpacing: "0.1em", borderRadius: 10 }}>
      REAL MCP SERVER
    </div>
    <div style={{ position: "absolute", left: 56, top: 140, width: 640, fontFamily: display, fontWeight: 800, fontSize: 118, lineHeight: 0.95, letterSpacing: "-0.035em", color: C.text }}>
      One missed
      <br />
      dose.
      <br />
      <span style={{ color: C.accent }}>One alert.</span>
    </div>
    <div style={{ position: "absolute", left: 56, bottom: 56, fontFamily: display, fontWeight: 600, fontSize: 34, color: C.muted }}>
      Simulated Alexa+ · 61 tests · $0
    </div>
    <div style={{ position: "absolute", right: -70, top: 70, width: 820, transform: "rotate(-3deg)", borderRadius: 18, overflow: "hidden", boxShadow: "0 40px 100px rgba(0,0,0,0.6), 0 0 0 2px #2b3640" }}>
      <Img src={staticFile("screen-demo.png")} style={{ width: 820, display: "block" }} />
    </div>
    <div style={{ position: "absolute", right: 40, bottom: 44, padding: "14px 26px", border: `2px solid ${C.accent}`, borderRadius: 14, fontFamily: display, fontWeight: 800, fontSize: 52, color: C.text, background: "#0a0d10" }}>
      Tend<span style={{ color: C.accent }}>.</span>
    </div>
  </AbsoluteFill>
);
