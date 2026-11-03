#!/usr/bin/env bash
# Two-pass EBU R128 loudness normalisation of the raw mix to -14 LUFS / -1.5 dBTP, exactly 50.000 s, 48 kHz stereo.
set -euo pipefail
cd "$(dirname "$0")"
M=$(ffmpeg -hide_banner -i mix_raw.wav -af loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$M" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1'])"; }
ffmpeg -y -hide_banner -loglevel error -i mix_raw.wav -af "loudnorm=I=-14:TP=-1.5:LRA=7:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true,aresample=48000,atrim=0:50,apad=whole_dur=50" -ar 48000 -c:a pcm_s16le ../public/audio/mix.wav
ffmpeg -hide_banner -i ../public/audio/mix.wav -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:|LRA:" | tail -3
