"""English voice-over for the demo via Gemini TTS, one clip per scene → video/out/vo/NN.wav + timing.json.

  ./.venv/Scripts/python make_vo.py            # all lines
  ./.venv/Scripts/python make_vo.py 7 8        # only re-generate lines 7 and 8

Each line has the scene start (seconds on the video timeline) and the max length it may take.
Numbers are written as words so the TTS reads them the way they are meant.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import wave
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

HERE = Path(__file__).resolve().parent
load_dotenv(HERE.parent / ".env")
OUT = HERE / "out" / "vo"
MODEL = os.getenv("VO_MODEL", "gemini-3.8-flash-tts")
VOICE = os.getenv("VO_VOICE", "Fenrir")
STYLE = os.getenv("VO_STYLE", "")  # style prefixes get read aloud by this model

# (start_seconds, max_seconds, text): derived from src/scenes.json, so picture and voice share one timeline
_scenes = json.loads((HERE / "src" / "scenes.json").read_text(encoding="utf-8"))
LINES: list[tuple[float, float, str]] = []
_t = 0.0
for _sc in _scenes:
    LINES.append((round(_t + _sc["vo"]["at"], 2), _sc["vo"]["max"], _sc["vo"]["text"]))
    _t += round(_sc["d"] * 30) / 30


def tts(client: genai.Client, text: str) -> bytes:
    cfg = types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE))),
    )
    for attempt in range(4):
        try:
            r = client.models.generate_content(model=MODEL, contents=STYLE + text, config=cfg)
            return r.candidates[0].content.parts[0].inline_data.data
        except Exception as e:  # noqa: BLE001 (rate limits / transient errors: back off and retry)
            print(f"   retry {attempt + 1}: {type(e).__name__}: {str(e)[:120]}")
            time.sleep(6 * (attempt + 1))
    raise SystemExit(f"TTS failed for: {text[:60]}")


def write_wav(path: Path, pcm: bytes) -> float:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24000)
        w.writeframes(pcm)
    return len(pcm) / 2 / 24000


def trim_and_fit(src: Path, dst: Path, max_s: float) -> float:
    """Trim silence at both ends; speed up (≤ 1.25×) only if the line would overrun its scene."""
    tmp = dst.with_suffix(".trim.wav")
    trim = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af", trim, str(tmp)], check=True)
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(tmp)]))
    tempo = max(1.0, dur / max_s)
    if tempo > 1.25:
        print(f"   ⚠️ {dst.name}: {dur:.1f}s for a {max_s}s slot, even 1.25× overruns; shorten the text")
        tempo = 1.25
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-af", f"atempo={tempo:.3f}", "-ar", "44100", str(dst)], check=True)
    tmp.unlink()
    return dur / tempo


def main(only: set[int]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    timing_path = OUT / "timing.json"
    timing = json.loads(timing_path.read_text()) if timing_path.exists() else {}
    for i, (start, max_s, text) in enumerate(LINES, 1):
        if only and i not in only:
            continue
        raw = OUT / f"{i:02d}.raw.wav"
        final = OUT / f"{i:02d}.wav"
        print(f"{i:02d} @ {start:6.1f}s  {text[:70]}")
        write_wav(raw, tts(client, text))
        dur = trim_and_fit(raw, final, max_s)
        raw.unlink()
        timing[f"{i:02d}"] = {"start": start, "dur": round(dur, 2), "max": max_s}
        print(f"   → {dur:.1f}s (slot {max_s}s)")
    timing_path.write_text(json.dumps(timing, indent=1))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main({int(a) for a in sys.argv[1:]})
