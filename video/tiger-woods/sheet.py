# usage: python sheet.py out.jpg img1 img2 ... (side by side, 540 px tall each, frame names burned in)
import sys
from PIL import Image, ImageDraw
out, ims = sys.argv[1], sys.argv[2:]
tiles = [Image.open(p).convert("RGB") for p in ims]
H = 800
tiles = [t.resize((int(t.width * H / t.height), H)) for t in tiles]
S = Image.new("RGB", (sum(t.width for t in tiles) + 6 * (len(tiles) - 1), H), "black")
x = 0
for p, t in zip(ims, tiles):
    S.paste(t, (x, 0)); ImageDraw.Draw(S).text((x + 6, 6), p.split("/")[-1], fill="yellow"); x += t.width + 6
S.save(out, quality=85)
