"""Transcribes each out/vo/NN.wav with Gemini and compares it with the script line (scenes.json).
Prints MISMATCH for lines whose words differ; regenerate those with `make_vo.py N`.

  ./.venv/Scripts/python check_vo.py [N ...]
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

HERE = Path(__file__).resolve().parent
load_dotenv(HERE.parent / ".env")
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
scenes = json.loads((HERE / "src" / "scenes.json").read_text(encoding="utf-8"))
NUM = {"61": "sixty one", "13": "thirteen", "8": "eight", "60": "sixty", "too": "to"}


def words(t: str) -> list[str]:
    t = t.lower().replace("-", " ").replace("+", " plus ")
    t = re.sub(r"[^a-z0-9 ]", " ", t)
    return [NUM.get(w, w) for w in t.split()]


def main(only: set[int]) -> None:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    bad = 0
    for i, sc in enumerate(scenes, 1):
        if only and i not in only:
            continue
        wav = HERE / "out" / "vo" / f"{i:02d}.wav"
        r = client.models.generate_content(
            model=MODEL,
            contents=[types.Part.from_bytes(data=wav.read_bytes(), mime_type="audio/wav"), "Transcribe this audio exactly. Output only the words spoken."],
        )
        heard = (r.text or "").strip()
        want = sc["vo"]["text"]
        a, b = words(want), words(heard)
        ok = a == b or [NUM.get(w, w) for w in a] == [NUM.get(w, w) for w in b]
        bad += not ok
        print(f"{i:02d} {'OK      ' if ok else 'MISMATCH'} {heard if not ok else ''}")
        if not ok:
            print(f"     want: {want}")
    print("all lines match" if bad == 0 else f"{bad} line(s) differ")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main({int(a) for a in sys.argv[1:]})
