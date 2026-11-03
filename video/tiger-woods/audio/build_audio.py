# Sound for "Hoe goed was Tiger Woods?": an original synthesized score + synthesized SFX on the picture's cue times,
# ducked under the Piper voice-over, mixed to exactly 50.000 s / 48 kHz / stereo. Everything is generated here (no
# samples), so all audio is our own. Writes audio/stems/*.wav, audio/mix_raw.wav, audio/cues.md.
# Loudness is finished with ffmpeg loudnorm (two-pass) by audio/master.sh -> public/audio/mix.wav.
import json, os, wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SR = 48000
DUR = 50.0
N = int(SR * DUR)
TL = json.load(open(os.path.join(ROOT, "src", "timeline.json"), encoding="utf-8"))
PH = {p["id"]: p for p in TL["phrases"]}
rng = np.random.default_rng(7)

# ---------------------------------------------------------------- cue times (mirror src/lib/cues.ts)
def at(pid, word):
    p = PH[pid]
    i = p["text"].index(word)
    return p["t0"] + (p["t1"] - p["t0"]) * i / len(p["text"])

C = dict(impact=0.2, land=3.75, tigerRow=PH["s05"]["t0"], tigerScore=at("s05", "min twaalf"), lowerTag=at("s04", "laagste"),
         chaseRows=at("s06", "achtervolgers"), plusThree=PH["s07"]["t0"] + 0.05, pushIn=14.75, xfadeA=15.25, stepsA=17.15,
         stepsB=21.05, rest=21.45, gridA=22.85, oneTile=at("s11", "één"), nineA=at("s12", "negen") - 0.1, nineTitle=at("s12", "negen"),
         slamA=29.9, slamTitle=PH["s13"]["t0"] + 0.6, gather=PH["s15"]["t0"], years=PH["s16"]["t0"], xfadeB=41.75,
         fifteen=PH["s19"]["t0"], endText=at("s19", "slagen"), fist=PH["s19"]["t1"] - 0.05, loopA=48.75)
C["trophy"] = [at("s14", "vier") + 0.15, at("s14", "opeenvolgende") + 0.55, at("s14", "majors") + 0.1, at("s14", "de belangrijkste") + 0.1]

def smooth_ramp(u, e=0.08):
    x = min(1, max(0, u)); v = 1 / (1 - e)
    if x < e: return v * x * x / (2 * e)
    if x > 1 - e: return 1 - v * (1 - x) ** 2 / (2 * e)
    return v * (x - e / 2)
def step_time(k):
    a, b = C["stepsA"], C["stepsB"]
    for _ in range(40):
        m = (a + b) / 2
        if 15 * smooth_ramp((m - C["stepsA"]) / (C["stepsB"] - C["stepsA"])) + 0.5 >= k: b = m
        else: a = m
    return b

# ---------------------------------------------------------------- helpers
def t2n(t): return int(round(t * SR))
def tt(d): return np.arange(int(d * SR)) / SR
def env_ad(d, a=0.005, k=6.0):
    t = tt(d); e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-k * t); return e
def lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def bp(x, f1, f2, o=2): return sosfilt(butter(o, [f1, f2], "band", fs=SR, output="sos"), x)
def noise(d): return rng.standard_normal(int(d * SR))
def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def place(buf, x, t, gain=1.0, pan=0.0):
    a = t2n(t)
    if a >= buf.shape[1]: return
    x = x[: buf.shape[1] - a]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[0, a:a + len(x)] += x * gain * l * 1.414
    buf[1, a:a + len(x)] += x * gain * r * 1.414
def db(x): return 10 ** (x / 20)
def mixp(*xs):
    n = max(len(x) for x in xs); out = np.zeros(n)
    for x in xs: out[:len(x)] += x
    return out
def norm(x): return x / (np.abs(x).max() + 1e-9)

def reverb(x, secs=1.6, mix=0.18, seed=3):
    r = np.random.default_rng(seed)
    n = int(secs * SR); t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t * 6.9 / secs)
    ir = lp(ir, 6000); ir[: int(0.012 * SR)] = 0; ir /= np.sqrt((ir ** 2).sum())
    out = np.stack([fftconvolve(x[c], ir if c == 0 else np.roll(ir, 211), mode="full")[: x.shape[1]] for c in range(2)])
    return x * (1 - mix) + out * mix * 1.6

# ---------------------------------------------------------------- instruments
def pluck(f, d=1.6, bright=1.0):
    t = tt(d)
    y = np.zeros_like(t)
    for h, a in [(1, 1.0), (2, 0.45 * bright), (3, 0.22 * bright), (4, 0.12 * bright), (5, 0.06 * bright)]:
        fh = f * h * (1 + 0.0004 * h * h)
        y += a * np.sin(2 * np.pi * fh * t) * np.exp(-t * (2.2 + 1.6 * h))
    y *= np.minimum(1, t / 0.004)
    return y * 0.5

def pad(freqs, d, att=0.8, rel=1.2):
    t = tt(d)
    y = np.zeros_like(t)
    for f in freqs:
        for det in (-0.12, 0.0, 0.11):
            ph = rng.uniform(0, 6.28)
            ff = f * 2 ** (det / 12)
            y += np.sin(2 * np.pi * ff * t + ph) + 0.25 * np.sin(2 * np.pi * 2 * ff * t + ph) + 0.1 * np.sin(2 * np.pi * 3 * ff * t)
    e = np.minimum(1, t / att) * np.minimum(1, (d - t) / rel)
    return lp(y * e, 2200) / (len(freqs) * 3)

def bass(f, d):
    t = tt(d)
    y = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)
    e = np.minimum(1, t / 0.02) * np.exp(-t * 0.6) * np.minimum(1, (d - t) / 0.15)
    return lp(y * e, 400) * 0.6

def kick():
    t = tt(0.45)
    f = 45 + 80 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9) * 0.9

def shaker():
    return hp(noise(0.09), 6000) * env_ad(0.09, 0.004, 45) * 0.25

def bell(f, d=2.2):
    t = tt(d)
    y = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * k) for r, a, k in [(1, 1, 2.2), (2.76, 0.45, 4), (5.4, 0.25, 7), (8.9, 0.12, 10)])
    return y * np.minimum(1, t / 0.002) * 0.35

# ---------------------------------------------------------------- score
BPM = 96; BEAT = 60 / BPM; BAR = 4 * BEAT  # 2.5 s
CH = {"Dm": [50, 53, 57], "Bb": [46, 50, 53], "F": [53, 57, 60], "C": [48, 52, 55], "Gm": [55, 58, 62]}
ROOT_ = {"Dm": 38, "Bb": 34, "F": 41, "C": 36, "Gm": 43}
prog = []
for i in range(19):
    prog.append(["Dm", "Bb", "F", "C"][i % 4] if i < 17 else ["Bb", "C"][i - 17])
prog.append("F")  # final chord at 47.5 s

def section_level(t):
    """overall arrangement intensity 0..1 over the film"""
    pts = [(0, 0.45), (5, 0.5), (14.6, 0.55), (15.2, 0.25), (17.0, 0.55), (21.5, 0.6), (23, 0.7), (30, 0.85), (41.6, 0.9), (42.2, 0.55), (46, 0.6), (50, 0.5)]
    return np.interp(t, [p[0] for p in pts], [p[1] for p in pts])

music = np.zeros((2, N))
music_pad = np.zeros((2, N))
for i, ch in enumerate(prog):
    t0 = i * BAR
    d = BAR + 0.6 if i < len(prog) - 1 else DUR - t0
    notes = CH[ch]
    place(music_pad, pad([mtof(n) for n in notes], d, att=0.6 if i else 0.05, rel=0.9 if i < len(prog) - 1 else 2.0), t0, 0.32)
    # bass from 4.75 s (the proof), out for the reveal pause and at the very end
    if 4.5 <= t0 < 47.5 and not (15.0 <= t0 < 17.5):
        place(music, bass(mtof(ROOT_[ch]), BAR), t0, 0.55)
    elif t0 == 15.0:
        place(music, bass(mtof(ROOT_[ch]), BAR), 17.15, 0.45)
    if ch == "F" and i == len(prog) - 1:
        place(music, bass(mtof(ROOT_[ch]), DUR - t0), t0, 0.5)
    # arpeggio in eighths
    arp = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[1] + 12, notes[0] + 24, notes[2] + 12, notes[1] + 12, notes[2]]
    for k in range(8):
        tn = t0 + k * BEAT / 2
        if tn >= 47.5 and i < len(prog) - 1: continue
        if i == len(prog) - 1 and k > 3: continue
        if 15.05 <= tn < 16.6: continue  # leave room around the big reveal
        vel = [1.0, 0.55, 0.75, 0.5, 0.9, 0.55, 0.7, 0.5][k] * section_level(tn)
        bright = 0.7 + 0.6 * section_level(tn)
        place(music, pluck(mtof(arp[k]), 1.4, bright), tn, 0.30 * vel, pan=[-0.3, 0.2, -0.1, 0.3, 0.0, -0.2, 0.25, -0.25][k])
        # a higher answering voice in the Tiger Slam section
        if 30 <= tn < 41.6 and k in (0, 4):
            place(music, pluck(mtof(arp[k] + 12), 1.2, 1.2), tn + BEAT / 4, 0.12, pan=0.4)
    # drums: from the nine wins to the end of the slam, and a softer pulse in the close
    for b in range(4):
        tb = t0 + b * BEAT
        if 23 <= tb < 41.6:
            if b in (0, 2): place(music, kick(), tb, 0.42)
            for e in range(2): place(music, shaker(), tb + e * BEAT / 2, 0.55 if e else 0.35, pan=0.35)
        elif 17.15 <= tb < 22.8 or 42.5 <= tb < 47.4:
            if b == 0: place(music, kick(), tb, 0.3)
music = music + music_pad
music = reverb(music, 1.8, 0.22)
# gentle fade-in from silence and a fade at the very end (loop-friendly)
fade = np.ones(N); fi = t2n(0.06); fade[:fi] = np.linspace(0, 1, fi)
fo = t2n(1.6); fade[-fo:] *= np.linspace(1, 0.0, fo) ** 1.5
music *= fade

# ---------------------------------------------------------------- sfx
sfx = np.zeros((2, N))
cues = []
def cue(name, t, x, gain, pan=0.0):
    place(sfx, x, t, gain, pan); cues.append((t, name))

def whoosh(d=0.6, f0=300, f1=3000, peak=0.6):
    n = noise(d); t = tt(d)
    # sweep a band-pass by blending two fixed bands, envelope peaks at `peak`
    lo, hi = bp(n, f0, f0 * 3), bp(n, f1 / 3, f1)
    m = np.clip(t / d, 0, 1)
    y = lo * (1 - m) + hi * m
    e = np.where(t < peak * d, (t / (peak * d)) ** 2, np.exp(-(t - peak * d) * 9))
    return y * e
def click(f=2600, d=0.05, k=90):
    t = tt(d); return (np.sin(2 * np.pi * f * t) * 0.6 + bp(noise(d), 1500, 6000) * 0.6) * np.exp(-t * k)
def tock():  # club on ball
    t = tt(0.25)
    body = np.sin(2 * np.pi * 820 * t) * np.exp(-t * 38) + 0.5 * np.sin(2 * np.pi * 2350 * t) * np.exp(-t * 60)
    return body + bp(noise(0.25), 2000, 9000) * np.exp(-t * 120) * 1.2
def thud(f=140, d=0.25):
    t = tt(d); return np.sin(2 * np.pi * f * t * (1 - 0.3 * t)) * np.exp(-t * 22) + lp(noise(d), 900) * np.exp(-t * 40) * 0.4
def roll(d=1.0):
    t = tt(d); return lp(bp(noise(d), 200, 2200), 1800) * np.exp(-t * 2.5) * (1 + 0.3 * np.sin(2 * np.pi * 9 * t)) * 0.5
def flap():  # scoreboard panel flip: two clacks
    return np.concatenate([click(1700, 0.04, 110) * 0.9, np.zeros(int(0.035 * SR)), click(1200, 0.06, 80)])
def knock(f=600):
    t = tt(0.14); return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.3 * t)) * np.exp(-t * 35) * 0.7
def pop(f=900):
    t = tt(0.12); ff = f * (1 + 0.6 * np.exp(-t * 40)); return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t * 30) * 0.6
def tick(f):
    t = tt(0.08); c = np.zeros_like(t); k = click(f * 2, 0.02, 200); c[:len(k)] = k; return np.sin(2 * np.pi * f * t) * np.exp(-t * 55) + c * 0.3
def swell(d=1.2):
    t = tt(d); return lp(noise(d), 1200) * (t / d) ** 2 * np.exp(-np.maximum(0, t - d * 0.9) * 30) * 0.5

# hook
cue("swing whoosh", 0.0, whoosh(0.22, 400, 4000, 0.9), 0.55, -0.2)
cue("club hits ball", C["impact"], tock(), 0.9)
cue("ball flight whistle", C["impact"] + 0.05, hp(whoosh(1.6, 2000, 7000, 0.15), 2500), 0.18, 0.2)
cue("title in", 0.22, pop(700), 0.35)
cue("ball lands", C["land"], thud(180, 0.2), 0.6, 0.15)
cue("ball hop", C["land"] + 0.32, thud(230, 0.15), 0.35, 0.15)
cue("ball rolls", C["land"] + 0.34, roll(1.1), 0.45, 0.15)
cue("camera to board", 3.95, whoosh(1.0, 200, 1500, 0.6), 0.25)
# proof
cue("LAGER = BETER pops in", C["lowerTag"], pop(1100), 0.45, 0.1)
cue("board: TIGER WOODS", C["tigerRow"], flap(), 0.6, 0.15)
cue("board: -12", C["tigerScore"], flap(), 0.75, 0.25)
cue("crowd: polite applause", C["tigerScore"] + 0.25, lp(hp(noise(1.8), 800), 6000) * (np.abs(np.sin(np.linspace(0, 70, int(1.8 * SR)))) ** 6) * np.minimum(1, tt(1.8) / 0.2) * np.exp(-tt(1.8) * 1.8), 0.25, 0.35)
cue("board: ERNIE ELS", C["chaseRows"], flap(), 0.5, 0.0)
cue("board: JIMENEZ", C["chaseRows"] + 0.22, flap(), 0.5, 0.0)
cue("board: +3", C["plusThree"], flap(), 0.6, 0.25)
cue("board: +3", C["plusThree"] + 0.12, flap(), 0.5, 0.25)
cue("push into -12", C["pushIn"], whoosh(0.8, 150, 1200, 0.85), 0.35)
# the fifteen steps
for k in range(16):
    cue(f"tile {k - 12:+d} rises", 15.55 + k * 0.075 + 0.05, knock(420 + 18 * k), 0.22, -0.4 + k * 0.05)
cue("counter in", C["stepsA"] - 0.25, pop(800), 0.3)
for k in range(1, 16):
    cue(f"step {k}", step_time(k), tick(mtof(62 + k)), 0.32 + 0.01 * k, -0.3 + 0.04 * k)
cue("rise to the overview", C["stepsB"] + 0.1, whoosh(1.2, 200, 2500, 0.55), 0.3)
# nine wins
cue("tiles fly to the grid", C["gridA"], whoosh(1.3, 300, 3000, 0.5), 0.35)
cue("U.S. Open tile flips", C["oneTile"], mixp(whoosh(0.3, 800, 5000, 0.5) * 0.6, np.concatenate([np.zeros(int(0.25 * SR)), bell(mtof(81), 1.6)])), 0.45)
flip_order = list(range(8))
for j in range(8):
    tf = C["nineA"] + j * 0.3
    cue(f"win tile {j + 1} flips", tf, mixp(whoosh(0.25, 800, 5000, 0.5) * 0.5, np.concatenate([np.zeros(int(0.2 * SR)), knock(700 + 40 * j)])), 0.38, -0.4 + 0.1 * j)
cue("title: 9 PGA TOUR-ZEGES", C["nineTitle"] - 0.05, pop(900), 0.35)
# slam
cue("tiles regroup", C["slamA"], whoosh(1.3, 200, 2000, 0.5), 0.3)
cue("title: TIGER SLAM", C["slamTitle"], pop(750), 0.35)
for i, tr in enumerate(C["trophy"]):
    cue(f"trophy {i + 1} appears", tr, mixp(bell(mtof([74, 77, 81, 86][i]), 2.2), pop(500) * 0.4), 0.42, -0.3 + 0.2 * i)
cue("podium rises", 36.15, lp(whoosh(1.0, 80, 600, 0.7), 900), 0.5)
cue("trophies gather", C["gather"], whoosh(1.1, 400, 4000, 0.45), 0.3)
cue("timeline line", C["years"], pop(1000), 0.25)
cue("leave the slam", C["xfadeB"] - 0.2, whoosh(0.9, 200, 2500, 0.5), 0.3)
# close
for k in range(16):
    cue(f"step glow {k}", C["fifteen"] + 0.05 + k * 0.06, tick(mtof(64 + k)), 0.12)
cue("end title", C["endText"], pop(650), 0.35)
cue("fist", C["fist"] - 0.35 + 0.42, thud(110, 0.3), 0.45)
cue("tiles sink", 48.95, lp(whoosh(0.7, 100, 900, 0.3), 1200), 0.3)
cue("ball pops on tee", 48.95, pop(1300), 0.3)
cue("takeaway whoosh", 49.3, whoosh(0.7, 300, 2500, 0.95), 0.18, -0.2)
sfx = reverb(sfx, 0.9, 0.12, seed=5)

# ---------------------------------------------------------------- voice
w = wave.open(os.path.join(ROOT, "voice", "voice.wav")); assert w.getframerate() == SR
v = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768
v = np.pad(v, (0, max(0, N - len(v))))[:N]
v = hp(v, 80)
# light presence lift + soft compression
v = v + 0.25 * bp(v, 2500, 6000)
env = np.sqrt(np.maximum(lp(v ** 2, 12), 0) + 1e-9)
g = np.minimum(1, (0.12 / np.maximum(env, 1e-4)) ** 0.35)
v = v * g
voice = np.stack([v, v])
voice = reverb(voice, 0.5, 0.06, seed=9)

# ducking key: phrase spans; music dips ~7 dB under speech, plus extra room after the key reveals
duck = np.zeros(N)
for p in TL["phrases"]:
    a, b = t2n(p["t0"] - 0.08), t2n(p["t1"] + 0.15)
    duck[max(0, a):b] = 1
k = int(0.12 * SR); duck = np.convolve(duck, np.ones(k) / k, mode="same")
mgain = db(-7.5) ** duck
# hold the music back briefly around "plus drie" and the 15-steps reveal so the words land
for t0, t1, d in [(13.6, 14.6, -4), (15.15, 16.7, -5)]:
    a, b = t2n(t0), t2n(t1)
    ramp = np.ones(N); seg = np.ones(b - a) * db(d)
    r = int(0.15 * SR); seg[:r] = np.linspace(1, db(d), r); seg[-r:] = np.linspace(db(d), 1, r)
    ramp[a:b] = seg; mgain *= ramp

# slow build over the film: quieter under the hook/proof, fullest in the Tiger Slam, settles for the close
build = db(np.interp(np.arange(N) / SR, [0, 5, 15, 23, 30, 41.6, 42.5, 50], [-2.5, -1.5, -0.5, 0.5, 1.5, 2.0, 0.0, 0.0]))
M = music * mgain * build * db(-10.5)
S = sfx * db(-10)
V = voice * db(-1.0)
mix = M + S + V
os.makedirs(os.path.join(HERE, "stems"), exist_ok=True)
def write(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, "wb") as o:
        o.setnchannels(2); o.setsampwidth(2); o.setframerate(SR)
        o.writeframes((x.T * 32767).astype(np.int16).tobytes())
write(os.path.join(HERE, "stems", "music.wav"), M)
write(os.path.join(HERE, "stems", "sfx.wav"), S)
write(os.path.join(HERE, "stems", "voice.wav"), V)
peak = np.abs(mix).max()
write(os.path.join(HERE, "mix_raw.wav"), mix * (0.7 / peak))
with open(os.path.join(HERE, "cues.md"), "w", encoding="utf-8") as f:
    f.write("# Sound cues (s)\n\nAll sounds are synthesized in build_audio.py (no samples).\n\n| time | event |\n|---|---|\n")
    for t, n in sorted(cues): f.write(f"| {t:6.2f} | {n} |\n")
print("peak before norm", round(float(peak), 3), "cues", len(cues))
