"""Make browser assets from the Blender render directory."""
import argparse
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
APP = HERE.parent / "dist"
ASSETS = APP / "assets"
SETTINGS = json.loads((HERE / "cinematic_shots.json").read_text())
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("renders", type=Path)
parser.add_argument("--partial", action="store_true")
args = parser.parse_args()
BUILD = ASSETS / "build"
BUILD.mkdir(parents=True, exist_ok=True)

def flattened(path, color):
    original = Image.open(path).convert("RGBA")
    background = Image.new("RGBA", original.size, color)
    return Image.alpha_composite(background, original).convert("RGB")

def on_white(path):
    original = Image.open(path).convert("RGBA")
    alpha = original.getchannel("A")
    shadow = alpha.filter(ImageFilter.GaussianBlur(original.width * .016))
    shadow = shadow.point(lambda level: level * .26)
    backdrop = Image.new("RGBA", original.size, "white")
    backdrop.paste("#89817a", (0, int(original.height * .025)), shadow)
    return Image.alpha_composite(backdrop, original).convert("RGB")

poster = args.renders / "hero-poster.png"
if poster.is_file():
    on_white(poster).save(ASSETS / "hero.webp", quality=90, method=6)
elif not args.partial:
    raise SystemExit("The Blender landing poster is missing.")

frames = []
for index, row in enumerate(SETTINGS["frames"]):
    progress, frame, shot, *action = row
    src = args.renders / f"build-{index:02}.png"
    dest = BUILD / f"{index:02}.webp"
    if not src.is_file():
        if args.partial:
            continue
        raise SystemExit(f"Missing Blender frame {src.name}")
    if not dest.is_file() or src.stat().st_mtime > dest.stat().st_mtime:
        flattened(src, "#988e81").save(dest, quality=88, method=5)
    label = SETTINGS["cameras"][shot][4]
    staged_labels = {
        "bases": "Base cabinets on three walls",
        "counter": "Fitting the U-shaped counter",
        "shelves": "Installing the wraparound shelves",
        "partial-slats": "Slats fitted behind the shelves",
        "drawers-moving": "Drawer fronts sliding into place",
        "doors-moving": "Fitting the closet cabinet doors",
        "blinds-moving": "Blinds sliding into the window return",
    }
    if action:
        label = staged_labels.get(action[0], label)
    elif shot == "lit-closet" and frame < 1270:
        label = "Light from the closet shelves"
    elif shot == "closet" and progress < 4.17:
        label = "Inside the empty closet"
    frames.append({"at": progress, "camera": shot, "day": (frame - 1) // 100 + 1,
                   "label": label, "src": f"assets/build/{dest.name}"})

(BUILD / "frames.json").write_text(json.dumps(frames, separators=(",", ":")) + "\n")
if args.partial:
    print(f"Prepared {len(frames)} Blender frames for preview.")
    raise SystemExit(0)

for frame in range(36):
    path = args.renders / f"hero-{frame:03}.png"
    if not path.is_file():
        raise SystemExit(f"Missing hero orbit frame {path.name}")
    on_white(path).save(args.renders / f"flat-{frame:03}.png")

subprocess.run([
    "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
    "-framerate", "12", "-i", str(args.renders / "flat-%03d.png"),
    "-vf", "setpts=1.25*PTS,minterpolate=fps=24:mi_mode=blend",
    "-c:v", "libx264", "-crf", "19", "-preset", "fast", "-threads", "3",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(ASSETS / "hero-loop.mp4")
], check=True)
print(f"Prepared {len(frames)} Blender frames and 1 orbit video.")
