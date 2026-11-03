import React from "react";
import { Composition } from "remotion";
import { TigerShort, Props } from "./Video";
import { TOTAL_FRAMES, FPS } from "./lib/anim";

const base = { durationInFrames: TOTAL_FRAMES, fps: FPS, width: 1080, height: 1920 };
export const Root: React.FC = () => (
  <>
    {/* final: picture + titles + burned-in Dutch subtitles + mixed sound */}
    <Composition id="TigerShort" component={TigerShort} {...base} defaultProps={{ subs: true, audio: "audio/mix.wav" } as Props} />
    {/* the same without burned-in subtitles (use the SRT on the platform instead) */}
    <Composition id="TigerShortClean" component={TigerShort} {...base} defaultProps={{ subs: false, audio: "audio/mix.wav" } as Props} />
    {/* subtitles only, on transparency (ProRes 4444) - lets the subtitled version be composited without a second 3D render */}
    <Composition id="SubsOnly" component={TigerShort} {...base} defaultProps={{ subs: true, audio: null, titles: false, world: false } as Props} />
  </>
);
