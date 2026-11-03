# Synthesise every voice-over phrase separately with Piper (nl rdh-medium), trim silence, report durations.
import json, sys, wave, io, os, numpy as np
from piper import PiperVoice, SynthesisConfig
HERE = os.path.dirname(os.path.abspath(__file__))
model = sys.argv[1]
ls = float(sys.argv[2]) if len(sys.argv) > 2 else 1.08
v = PiperVoice.load(model)
segs = json.load(open(os.path.join(HERE, "segments.json")))
os.makedirs(os.path.join(HERE, "seg"), exist_ok=True)
out = {}
for s in segs:
    cfg = SynthesisConfig(length_scale=s.get("ls", ls), noise_scale=0.6, noise_w_scale=0.7)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        v.synthesize_wav(s["say"], w, syn_config=cfg)
    buf.seek(0); w = wave.open(buf); sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    env = np.convolve(np.abs(x), np.ones(220) / 220, "same")
    idx = np.where(env > 0.012)[0]
    a, b = max(0, idx[0] - int(0.02 * sr)), min(len(x), idx[-1] + int(0.06 * sr))
    x = x[a:b]
    with wave.open(os.path.join(HERE, "seg", s["id"] + ".wav"), "wb") as o:
        o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr); o.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
    out[s["id"]] = round(len(x) / sr, 3)
    print(s["id"], out[s["id"]], "s ", " ".join("".join(p) for p in v.phonemize(s["say"])))
json.dump(out, open(os.path.join(HERE, "seg_durations.json"), "w"), indent=1)
print("total speech", round(sum(out.values()), 2))
