#!/usr/bin/env bash
# Cuts the raw recordings (video/raw, made by ../scripts/record-demo.ts against the real running app) into the clips
# the video uses. Honest edit: cut + speed-up only (setpts), no frames added, removed or altered.
# name  source  start  end  speed
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p public/clips
cut() { ffmpeg -v error -y -ss "$3" -to "$4" -i "raw/$2.mp4" -an -vf "setpts=PTS/$5,fps=30" \
  -c:v libx264 -preset veryfast -crf 17 -pix_fmt yuv420p "public/clips/$1.mp4"; }
cut c1_ask    flow   1.9  8.6  1.0   # type "What's due?"
cut c2_skip   flow   8.6  14.6 1.0   # +1 hour: overdue
cut c3_care   flow   14.5 23.3 1.0   # caregiver side: one alert
cut c4_late   flow   23.3 34.6 1.2   # +15 min, late dose resolves the alert
cut c5_bad    safety 1.7  9.5  1.0   # a name with an advice word is refused
cut c6_xss    safety 9.5  17.2 1.5   # markup is refused
cut c7_good   safety 17.2 26.8 1.4   # a normal schedule: propose, confirm, save
cut c8_phone  phone  1.8  12.2 1.0   # caregiver on a phone, scrolling
for f in public/clips/*.mp4; do printf "%s %s\n" "$(basename "$f")" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"; done
