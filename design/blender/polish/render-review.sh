#!/bin/sh
# 8.5k2b: run on a host where Blender reaches Python; keep all review output beside this script.
set -eu
cd "$(dirname "$0")/../../.."
BLENDER_BIN=${BLENDER_BIN:-/Users/francomichetti/dev/video/forge-studio/eval/skills/work/blender/Blender.app/Contents/MacOS/Blender}
POLISH=design/blender/polish
render() {
    name=$1
    shift
    "$BLENDER_BIN" -b --factory-startup --python-exit-code 1 --python design/blender/hero-light.py -- \
        --out "$POLISH/$name.png" "$@" > "$POLISH/$name.log" 2>&1
    node "$POLISH/measure.mjs" "$POLISH/$name.png" >> "$POLISH/measurements.jsonl"
}
render a-check --take a --width 600 --height 375 --samples 48
for t in 0 0.6 1.2 2.0 3.2 4.8; do
    shutter=0.5
    case $t in 0|4.8) shutter=0;; esac
    render "v-t$t" --take v --width 600 --height 375 --samples 48 --time "$t" --shutter "$shutter"
done
node "$POLISH/measure.mjs" --diff "$POLISH/v-t0.png" "$POLISH/v-t4.8.png" > "$POLISH/rest-difference.json"
render v-paper --take v --width 600 --height 375 --samples 48 --no-sun
render v-smooth --take v --width 600 --height 375 --samples 48 --set tooth=0
# Review the small frames and tune V before this single full-size checkpoint.
if [ "${FULL_SIZE:-0}" = 1 ]; then
    render v-still --take v --width 2400 --height 1500 --samples 160
    node "$POLISH/measure.mjs" --boards
fi
