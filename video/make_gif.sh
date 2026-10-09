#!/usr/bin/env bash
# README GIF: a ~12 s highlight of the final video (the miss, the one alert, the late dose), 800px wide, palette-optimised.
set -euo pipefail
cd "$(dirname "$0")"
SRC=${1:-out/tend.mp4}
START=${2:-34.2}   # the "skip the clock" scene begins here in the final video
ffmpeg -v error -y -ss "$START" -t 12 -i "$SRC" -vf "fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" -loop 0 out/demo.gif
ls -la out/demo.gif
