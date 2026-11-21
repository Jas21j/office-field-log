"""Pack the Project Hub images.

    python3 tools/pack_hub.py                    # from office-field-log/
    python3 tools/pack_hub.py --review <dir>     # also write full-size crops + a contact sheet to <dir>

Reads tools/hub_media.json, writes dist/assets/hub/<project>/{tile,hero-L,hero-P,t-<key>}.webp and
dist/assets/hub/manifest.json (an accent colour per project, taken from its hero). Video frames are
decoded as pictures only (ffmpeg -an); nothing else is read from the clips. Needs ffmpeg and Pillow.
"""
import colorsys
import io
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
OUT = os.path.join(SITE, "dist", "assets", "hub")
EXCLUDED = ("IMG_7505",)          # accidental upload: never read, framed or previewed

cfg = json.load(open(os.path.join(HERE, "hub_media.json")))
roots = {k: os.path.normpath(os.path.join(SITE, os.path.expanduser(v))) for k, v in cfg["roots"].items()}
review = sys.argv[sys.argv.index("--review") + 1] if "--review" in sys.argv else None
cache = {}


def resolve(spec):
    key = spec.get("vid") or spec.get("img")
    root, rel = key.split("/", 1)
    path = os.path.join(roots[root], rel)
    if any(x in path for x in EXCLUDED):
        raise SystemExit(f"refusing excluded source: {path}")
    return path


def source(spec):
    path = resolve(spec)
    key = (path, spec.get("t"))
    if key not in cache:
        if "vid" in spec:
            png = subprocess.run(
                ["ffmpeg", "-v", "error", "-ss", str(spec["t"]), "-i", path, "-an", "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"],
                check=True, capture_output=True).stdout
            cache[key] = Image.open(io.BytesIO(png)).convert("RGB")
        else:
            cache[key] = Image.open(path).convert("RGB")
    return cache[key]


def crop(im, w, h, fx=0.5, fy=0.5, z=1.0):
    W, H = im.size
    a = w / h
    cw, ch = (H * a, H) if W / H > a else (W, W / a)
    cw, ch = cw / z, ch / z
    x = min(max(fx * W - cw / 2, 0), W - cw)
    y = min(max(fy * H - ch / 2, 0), H - ch)
    return im.crop((round(x), round(y), round(x + cw), round(y + ch))).resize((w, h), Image.LANCZOS)


def accent(im):
    small = im.resize((48, 27))
    pixels = small.get_flattened_data() if hasattr(small, "get_flattened_data") else small.getdata()
    px = [colorsys.rgb_to_hsv(*(c / 255 for c in p)) for p in pixels]
    px.sort(key=lambda p: p[1] * p[2], reverse=True)
    top = px[: max(1, len(px) // 4)]
    # average hue on the circle, then clamp to a usable glow
    import math
    hx = sum(math.cos(p[0] * 2 * math.pi) for p in top)
    hy = sum(math.sin(p[0] * 2 * math.pi) for p in top)
    hue = (math.atan2(hy, hx) / (2 * math.pi)) % 1
    sat = min(0.62, max(0.3, sum(p[1] for p in top) / len(top)))
    r, g, b = colorsys.hsv_to_rgb(hue, sat, 0.72)
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


manifest = {}
sheet_items = []
for pid, spec in cfg["projects"].items():
    d = os.path.join(OUT, pid)
    os.makedirs(d, exist_ok=True)
    jobs = [(name, spec[name]) for name in ("tile", "hero-L", "hero-P")]
    jobs += [(f"t-{k}", v) for k, v in spec.get("t", {}).items()]
    for name, s in jobs:
        w, h, q = cfg["sizes"]["t" if name.startswith("t-") else name]
        im = crop(source(s), w, h, s.get("fx", 0.5), s.get("fy", 0.5), s.get("z", 1.0))
        im.save(os.path.join(d, f"{name}.webp"), "WEBP", quality=q, method=6)
        if name == "hero-L":
            manifest[pid] = {"accent": accent(im)}
        if review:
            os.makedirs(os.path.join(review, pid), exist_ok=True)
            im.save(os.path.join(review, pid, f"{name}.jpg"), quality=90)
            sheet_items.append((f"{pid} {name}", im))
    print(pid, "ok", manifest.get(pid))

json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=1)

if review:
    cols, cell = 6, 300
    rows = (len(sheet_items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 18)), "#111")
    dr = ImageDraw.Draw(sheet)
    for k, (label, im) in enumerate(sheet_items):
        t = im.copy()
        t.thumbnail((cell - 8, cell - 8))
        x, y = (k % cols) * cell, (k // cols) * (cell + 18)
        sheet.paste(t, (x + (cell - t.width) // 2, y + (cell - t.height) // 2))
        dr.text((x + 4, y + cell + 2), label, fill="#ddd")
    sheet.save(os.path.join(review, "hub_sheet.jpg"), quality=86)
    print("review sheet:", os.path.join(review, "hub_sheet.jpg"))
