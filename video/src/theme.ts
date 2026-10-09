import { loadFont as loadDisplay } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const display = loadDisplay("normal", { weights: ["400", "600", "800"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["400", "700"], subsets: ["latin"] }).fontFamily;
export const emoji = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji"';

export const C = {
  bg: "#0a0d10",
  bg2: "#11171b",
  panel: "#151b20",
  line: "#27323a",
  text: "#f6f3ee",
  muted: "#9aa7b0",
  accent: "#2dd4bf", // Tend teal: the one brand accent
  amber: "#f5a524", // semantic only: overdue and missed
  green: "#3ddc84",
  red: "#ff5c61",
};

export const FPS = 30;
export const s = (seconds: number) => Math.round(seconds * FPS);
