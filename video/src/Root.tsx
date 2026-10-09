import React from "react";
import { AbsoluteFill, Composition, Series } from "remotion";
import { AskScene, BadScene, CareScene, GoodScene, LateScene, PhoneScene, SkipScene, XssScene } from "./footage";
import { ColdOpen, Logo, Problem, Arch } from "./intro";
import { Concurrency, End, Stats, Terminal } from "./outro";
import { FPS, s } from "./theme";
import { Thumbnail, ThumbnailDevpost } from "./thumbnail";
import scenes from "./scenes.json";

// Footage scenes last exactly as long as their clip (public/clips, cut by cut_clips.sh). Durations and voice-over
// lines live in scenes.json, which make_vo.py reads too, so the picture and the voice cannot drift apart.
const COMPONENTS: Record<string, React.FC> = {
  cold: ColdOpen, logo: Logo, prob: Problem, arch: Arch, ask: AskScene, skip: SkipScene, care: CareScene, conc: Concurrency,
  late: LateScene, phone: PhoneScene, bad: BadScene, xss: XssScene, good: GoodScene, term: Terminal, stats: Stats, end: End,
};

export const TOTAL = scenes.reduce((a, b) => a + s(b.d), 0);

const Main: React.FC = () => (
  <AbsoluteFill style={{ background: "#0a0d10" }}>
    <Series>
      {scenes.map(({ id, d }) => {
        const C = COMPONENTS[id];
        return (
          <Series.Sequence key={id} durationInFrames={s(d)} style={{ isolation: "isolate" }}>
            <C />
          </Series.Sequence>
        );
      })}
    </Series>
  </AbsoluteFill>
);

export const Root: React.FC = () => (
  <>
    <Composition id="Tend" component={Main} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
    <Composition id="ThumbnailDevpost" component={ThumbnailDevpost} durationInFrames={1} fps={FPS} width={1280} height={853} />
    <Composition id="Thumbnail" component={Thumbnail} durationInFrames={1} fps={FPS} width={1280} height={720} />
  </>
);
