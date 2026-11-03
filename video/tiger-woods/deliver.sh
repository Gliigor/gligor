#!/usr/bin/env bash
# Final assembly. Expects:
#   out/picture_clean.mp4  - the 3D picture with titles, no subtitles (npm run render:picture)
#   out/subs_overlay.mov   - the subtitles on transparency (npm run render:subs)
#   public/audio/mix.wav   - the mastered mix (audio/build_audio.py + audio/master.sh)
# Writes deliverables/: the subtitled MP4, the clean MP4, the SRT.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p deliverables
# 1. without burned-in subtitles: copy the picture, add the mix as AAC
ffmpeg -y -hide_banner -loglevel error -i out/picture_clean.mp4 -i public/audio/mix.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -ar 48000 -t 50 -movflags +faststart \
  deliverables/tiger_woods_zonder_ondertitels.mp4
# 2. with burned-in subtitles: overlay the transparent subtitle layer (same frame grid), re-encode once
ffmpeg -y -hide_banner -loglevel error -i out/picture_clean.mp4 -i out/subs_overlay.mov -i public/audio/mix.wav \
  -filter_complex "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]" \
  -map "[v]" -map 2:a:0 -c:v libx264 -preset slow -crf 16 -profile:v high -r 30 -c:a aac -b:a 256k -ar 48000 -t 50 -movflags +faststart \
  deliverables/tiger_woods_met_ondertitels.mp4
cp out/subtitles.srt deliverables/tiger_woods_ondertitels_nl.srt
for f in deliverables/*.mp4; do
  echo "$f: $(ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,nb_frames -of csv=p=0 "$f") \
$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f") s"
done
