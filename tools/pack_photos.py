"""Finished-office photos for the reveal: the crew's own 12 MP stills (iPhone HEIC), not video frames.

usage (macOS, from the parent workspace): python3 office-field-log/tools/pack_photos.py footage/

For each photo: HEIC -> JPEG (sips), EXIF rotation applied, 3:4 crop, and the window glass turned into soft
daylight so the neighbour's roof beyond the hedge never reads (privacy: no house exteriors). Writes
dist/assets/photo-<name>-{1400|1200,700}.webp. The glass corners are fractions of the rotated photo.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "dist" / "assets"
PHOTOS = {
    # name: (file, big width, glass polygon or None)
    "workstations": ("IMG_7216", 1400, [(0.431, 0.316), (0.581, 0.316), (0.581, 0.463), (0.431, 0.463)]),
    "desk": ("IMG_7184", 1200, [(0.759, 0.254), (1.0, 0.223), (1.0, 0.475), (0.745, 0.463)]),
    "closet": ("IMG_7191", 1200, None),
}


def daylight(im, poly):
    """Blow the glass out to soft daylight, feathered at the frame edge."""
    W, H = im.size
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).polygon([(x * W, y * H) for x, y in poly], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(W * 0.0015))
    soft = im.filter(ImageFilter.GaussianBlur(W * 0.012))
    bright = Image.blend(soft, Image.new("RGB", im.size, (250, 250, 246)), 0.62)
    return Image.composite(bright, im, mask)


def main(src_dir):
    with tempfile.TemporaryDirectory() as tmp:
        for name, (stem, big, poly) in PHOTOS.items():
            jpg = Path(tmp) / f"{stem}.jpg"
            subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "95", str(Path(src_dir) / f"{stem}.HEIC"),
                            "--out", str(jpg)], check=True, capture_output=True)
            im = ImageOps.exif_transpose(Image.open(jpg)).convert("RGB")
            W, H = im.size
            if abs(W / H - 3 / 4) > 0.01:                  # centre-crop to 3:4
                w = min(W, round(H * 3 / 4)); h = round(w * 4 / 3)
                im = im.crop(((W - w) // 2, (H - h) // 2, (W - w) // 2 + w, (H - h) // 2 + h))
            if poly:
                im = daylight(im, poly)
            for width in (big, 700):
                out = im.resize((width, round(width * 4 / 3)), Image.LANCZOS)
                out.save(ASSETS / f"photo-{name}-{width}.webp", quality=84, method=6)
            print("photo", name, stem)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "footage")
