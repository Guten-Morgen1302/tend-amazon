# Tend demo video

A 2:05 (1920×1080, 30 fps) demo built with [Remotion](https://remotion.dev). Everything on screen is either **real footage of the running app** or a graphic built from **real numbers** (test counts, real terminal output). Nothing is faked:

- The app footage was recorded by `../scripts/record-demo.ts`, a script that drives the real simulator at human speed (typing, clicking) and captures it with Chrome's screencast. It is labeled on screen as an automated run. The only addition is a drawn mouse pointer, because headless capture has none.
- Clips are **cut and sped up only** (`cut_clips.sh`, `setpts`). Three clips are sped up (1.2×, 1.4×, 1.5×) and say so on screen; the rest are 1×.
- The terminal scene is the real output of `npm run conformance`. The "sixty checks, one alert" scene is the real result of `test/concurrency.test.ts`. Test counts, CI status and the 8 tools are real.
- The voice is Gemini text-to-speech (`gemini-3.8-flash-tts`, voice Fenrir); the music is synthesized with ffmpeg. No stock footage.
- Live Alexa+ is not used. The Alexa+ display is simulated and labeled so throughout.

## Rebuild

```bash
# from the repo root: start the app, record, then build the video
npm start                          # terminal 1
npx tsx scripts/record-demo.ts     # terminal 2 -> video/raw/*.mp4 (git-ignored)
cd video && npm ci
bash cut_clips.sh                  # -> public/clips (git-ignored)
python -m venv .venv && .venv/Scripts/python -m pip install python-dotenv google-genai   # once
.venv/Scripts/python make_vo.py    # -> out/vo/*.wav (needs GEMINI_API_KEY in ../.env)
.venv/Scripts/python check_vo.py   # transcribes each line back and compares
bash make_music.sh 125.63          # -> out/music.wav
npx remotion render src/index.ts Tend out/tend-silent.mp4 --codec=h264 --crf=18
.venv/Scripts/python mix_audio.py  # -> out/tend.mp4
npx remotion still src/index.ts Thumbnail out/thumbnail.png
```

`make_vo.py` regenerates only the lines you pass (`make_vo.py 6 10`), to avoid spending API calls. Picture and voice share one timeline, `src/scenes.json` (scene lengths and the voice-over lines).

## Files

`src/` scenes (`intro.tsx`, `footage.tsx`, `outro.tsx`), shared components (`ui.tsx`), `theme.ts`, `scenes.json`, `terminal.json` (real output), `thumbnail.tsx` · `cut_clips.sh` · `make_music.sh` · `make_vo.py` · `check_vo.py` · `mix_audio.py`

## Source of the one statistic

"About half of patients with chronic illness don't take their medicines as prescribed": Brown and Bussell, "Medication adherence: WHO cares?", Mayo Clin Proc 2011;86(4):304-314 (PubMed 21389250, abstract read directly).
