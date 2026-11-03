# Lays the separately synthesised voice phrases on the 50 s timeline, writes voice.wav (48 kHz mono),
# ../src/timeline.json (phrase + subtitle-chunk timings used by picture and sound) and ../out/subtitles.srt.
import json, os, wave
import numpy as np
from scipy.signal import resample_poly

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SR = 48000
DUR = 50.0

# phrase start times (s): pauses around "vijftien", "plus drie" and the ending are deliberate
START = {"s01": 0.30, "s02": 2.55, "s03": 4.60, "s04": 7.15, "s05": 9.25, "s06": 11.30, "s07": 13.75,
         "s08": 15.30, "s09": 17.05, "s10": 20.05, "s11": 23.15, "s12": 25.15, "s13": 30.15, "s14": 32.55,
         "s15": 37.00, "s16": 39.05, "s17": 42.55, "s18": 44.45, "s19": 46.25}
# subtitle chunks per phrase (max two lines on screen)
CHUNKS = {"s09": ["Dezelfde baan.", "Dezelfde omstandigheden."],
          "s12": ["Dat jaar won hij negen keer", "op de PGA Tour."],
          "s13": ["Daarna maakte hij", "de Tiger Slam compleet:"],
          "s14": ["vier opeenvolgende majors,", "de belangrijkste toernooien in golf."]}

segs = json.load(open(os.path.join(HERE, "segments.json")))
track = np.zeros(int(DUR * SR), np.float32)
phrases, subs = [], []
for s in segs:
    w = wave.open(os.path.join(HERE, "seg", s["id"] + ".wav"))
    sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    assert sr == 22050, sr
    x = resample_poly(x, 320, 147).astype(np.float32)  # 22050 Hz -> 48000 Hz
    a = int(START[s["id"]] * SR)
    track[a:a + len(x)] += x[: len(track) - a]
    t0, t1 = START[s["id"]], START[s["id"]] + len(x) / SR
    phrases.append({"id": s["id"], "t0": round(t0, 3), "t1": round(t1, 3), "text": s["sub"]})
    chunks = CHUNKS.get(s["id"], [s["sub"]])
    n = sum(len(c) for c in chunks)
    t = t0
    for c in chunks:
        d = (t1 - t0) * len(c) / n
        subs.append({"t0": round(t, 3), "t1": round(t + d, 3), "text": c})
        t += d
# subtitles stay up a little after the phrase ends (until the next one starts, max +0.6 s)
for i, s in enumerate(subs):
    nxt = subs[i + 1]["t0"] if i + 1 < len(subs) else DUR
    s["t1"] = round(min(nxt - 0.03, s["t1"] + 0.6), 3)

peak = np.abs(track).max()
track *= 0.89 / peak
with wave.open(os.path.join(HERE, "voice.wav"), "wb") as o:
    o.setnchannels(1); o.setsampwidth(2); o.setframerate(SR)
    o.writeframes((track * 32767).astype(np.int16).tobytes())
json.dump({"fps": 30, "duration": DUR, "phrases": phrases, "subs": subs}, open(os.path.join(ROOT, "src", "timeline.json"), "w"), indent=1, ensure_ascii=False)

def ts(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
with open(os.path.join(ROOT, "out", "subtitles.srt"), "w", encoding="utf-8") as f:
    for i, s in enumerate(subs, 1):
        f.write(f"{i}\n{ts(s['t0'])} --> {ts(s['t1'])}\n{s['text']}\n\n")
for p in phrases: print(p["id"], p["t0"], p["t1"], p["text"])
print("speech ends", phrases[-1]["t1"])
