#!/bin/sh
# Re-render every food sprite and the porcelain, then pack them for the game.
#   BPY=/path/to/python-with-bpy sh render_all.sh
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=${OUT:-/tmp/food-renders}
BPY=${BPY:-python3}
"$BPY" "$HERE/food.py" "$OUT"
"$BPY" "$HERE/bowl.py" "$OUT"
"$BPY" "$HERE/pack.py" "$OUT" "$HERE/../../assets/food2d"
