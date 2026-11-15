"""Make the browser assets from the Blender render directory (see render_cinematic.py).

usage: python3 office-field-log/tools/pack_cinematic.py /tmp/office-cinematic [--partial]

Writes under dist/assets/:
  build/NN-L.webp, build/NN-P.webp      every scroll state, landscape (wide screens) and portrait (phones)
  accent/NN-L.webp, accent/NN-P.webp    green outlines + glow on the parts that are new in that state
  bp/<camera>-L.webp, bp/<camera>-P.webp the finished room as a blueprint from each camera (plan -> built scans)
  plan/NN.webp                          the room from above at that state (mini-map; repeats are shared)
  build/frames.json, build/cameras.json the scroll track and the camera / plan geometry for the mini-map
  hero.webp, hero-loop.mp4              the landing orbit on white (the page multiplies it onto the cream)
Scroll positions: each state keeps its chapter; within a chapter, a camera change gets 2.6x the scroll
of a step inside one shot, so the plan -> built scans have room to breathe.
"""
import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "dist" / "assets"
CFG = json.loads((HERE / "cinematic_shots.json").read_text())
ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument("renders", type=Path)
ap.add_argument("--partial", action="store_true")
args = ap.parse_args()
R = args.renders
GREEN = (60, 224, 75)
STAGED = {"bases": "Base cabinets on three walls", "counter": "Fitting the U-shaped counter",
          "shelves": "Installing the wraparound shelves", "partial-slats": "Slats fitted behind the shelves",
          "drawers-moving": "Drawer fronts sliding into place", "doors-moving": "Fitting the closet cabinet doors",
          "blinds-moving": "Blinds sliding into the window return"}
for d in ("build", "accent", "bp", "plan"):
    (ASSETS / d).mkdir(parents=True, exist_ok=True)


def fresh(src, dest):
    return src.is_file() and (not dest.is_file() or src.stat().st_mtime > dest.stat().st_mtime)


def accent(mask_path, beauty_path, dest):
    """Green outline + inner edges + soft glow where new parts show (transparent elsewhere)."""
    m = Image.open(mask_path).convert("RGBA")
    a = np.asarray(m).astype(np.float32) / 255
    cover = a[..., 0] * a[..., 3]                                    # white where a new part is in view
    if cover.max() < 0.5:
        return False
    W, H = m.size
    s = max(1, round(W / 1080))                                       # line widths scale with the image
    mk = Image.fromarray((cover * 255).astype(np.uint8))
    outer = np.asarray(mk.filter(ImageFilter.MaxFilter(2 * s + 1))).astype(np.float32) / 255
    inner = np.asarray(mk.filter(ImageFilter.MinFilter(2 * s + 1))).astype(np.float32) / 255
    ring = np.clip(outer - inner, 0, 1)
    lum = Image.open(beauty_path).convert("L")
    gx = np.asarray(lum.filter(ImageFilter.Kernel((3, 3), (-1, 0, 1, -2, 0, 2, -1, 0, 1), 1))).astype(np.float32)
    gy = np.asarray(lum.filter(ImageFilter.Kernel((3, 3), (-1, -2, -1, 0, 0, 0, 1, 2, 1), 1))).astype(np.float32)
    edge = np.clip((np.abs(gx) + np.abs(gy)) / 90.0 - 0.15, 0, 1) * inner        # the part's own edges, inside it
    glow = np.asarray(mk.filter(ImageFilter.GaussianBlur(14 * s))).astype(np.float32) / 255
    alpha = np.clip(ring * 1.0 + edge * 0.6 + glow * 0.32 + cover * 0.08, 0, 1)
    rgba = np.zeros((H, W, 4), np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = GREEN
    rgba[..., 3] = (alpha * 255).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(dest, quality=82, method=5)
    return True


def positions():
    """Keep each state in its chapter; give camera changes 2.6x the scroll of an in-shot step."""
    rows = CFG["frames"]
    ch = [int(r[0]) for r in rows]
    out = [0.0] * len(rows)
    for c in sorted(set(ch)):
        idx = [i for i, x in enumerate(ch) if x == c]
        w = [0.0]
        for a, b in zip(idx, idx[1:]):
            w.append(w[-1] + (2.6 if rows[a][2] != rows[b][2] else 1.0))
        lo, hi = c + 0.10, c + (0.90 if c < max(ch) else 0.98)
        for k, i in enumerate(idx):
            out[i] = round(lo + (hi - lo) * (w[k] / w[-1] if w[-1] else 0), 4)
    return out


frames, planned = [], {}
at = positions()
for i, row in enumerate(CFG["frames"]):
    _, frame, cam, *beat = row
    item = {"at": at[i], "camera": cam, "day": (frame - 1) // 100 + 1,
            "label": STAGED.get(beat[0], CFG["cameras"][cam]["label"]) if beat else CFG["cameras"][cam]["label"]}
    if not beat and cam == "lit-closet" and frame < 1270:
        item["label"] = "Light from the closet shelves"
    if not beat and cam == "closet" and frame < 760:
        item["label"] = "Inside the empty closet"
    ok = True
    for o in ("L", "P"):
        src, dest = R / f"build-{i:02}-{o}.png", ASSETS / "build" / f"{i:02}-{o}.webp"
        if not src.is_file() and not dest.is_file():
            ok = False
            continue
        if fresh(src, dest):
            Image.open(src).convert("RGB").save(dest, quality=84 if o == "L" else 82, method=6)
        mask, adest = R / f"mask-{i:02}-{o}.png", ASSETS / "accent" / f"{i:02}-{o}.webp"
        if i == 0:                                                   # nothing came before the first state: no "new" parts
            adest.unlink(missing_ok=True)
        elif mask.is_file() and (fresh(mask, adest) or not adest.is_file()):
            if not accent(mask, src, adest) and adest.is_file():
                adest.unlink()
        if adest.is_file():
            item["accent"] = True
    if not ok:
        if args.partial:
            continue
        raise SystemExit(f"Missing Blender frame build-{i:02}")
    key = (frame, beat[0] if beat else "")
    psrc = R / f"plan-{i:02}.png"
    if key not in planned and psrc.is_file():
        pdest = ASSETS / "plan" / f"{i:02}.webp"
        if fresh(psrc, pdest):
            Image.open(psrc).convert("RGB").save(pdest, quality=86, method=6)
        planned[key] = f"assets/plan/{i:02}.webp"
    if key in planned:
        item["plan"] = planned[key]
    frames.append(item)

for cam in CFG["cameras"]:
    for o in ("L", "P"):
        src, dest = R / f"bp-{cam}-{o}.png", ASSETS / "bp" / f"{cam}-{o}.webp"
        if fresh(src, dest):
            Image.open(src).convert("RGB").save(dest, quality=86, method=6)

plan_meta = json.loads((R / "plan.json").read_text()) if (R / "plan.json").is_file() else None
cams = {k: {"L": v["L"], "P": v["P"]} for k, v in CFG["cameras"].items()}
(ASSETS / "build" / "frames.json").write_text(json.dumps(frames, separators=(",", ":")) + "\n")
(ASSETS / "build" / "cameras.json").write_text(json.dumps({"cameras": cams, "plan": plan_meta,
                                                          "sizes": {"L": [2048, 1280], "P": [1080, 1920]}},
                                                         separators=(",", ":")) + "\n")
print(f"{len(frames)} scroll states, {sum(1 for f in frames if f.get('accent'))} with green outlines, {len(planned)} plans")
if args.partial:
    raise SystemExit(0)


def on_white(path):
    """The model on white with a soft contact shadow; the page multiplies it onto the cream."""
    im = Image.open(path).convert("RGBA")
    alpha = im.getchannel("A")
    shadow = alpha.filter(ImageFilter.GaussianBlur(im.width * .014)).point(lambda v: v * .22)
    back = Image.new("RGBA", im.size, "white")
    back.paste("#8a8279", (0, int(im.height * .02)), shadow)
    return Image.alpha_composite(back, im).convert("RGB")


heroes = sorted(R.glob("hero-[0-9][0-9][0-9].png"))
if heroes:
    flat = R / "flat"
    flat.mkdir(exist_ok=True)
    for p in heroes:
        q = flat / (p.stem + ".png")
        if fresh(p, q):
            on_white(p).save(q)
    on_white(heroes[0]).save(ASSETS / "hero.webp", quality=90, method=6)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", "24",
                    "-i", str(flat / "hero-%03d.png"), "-c:v", "libx264", "-crf", "20", "-preset", "slow",
                    "-tune", "animation", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                    str(ASSETS / "hero-loop.mp4")], check=True)
    print(f"hero: {len(heroes)} frames -> hero-loop.mp4")
