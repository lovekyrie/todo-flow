"""Extract the supplied design's assets; requires local Pillow and numpy."""

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("--extract", action="store_true")
args = parser.parse_args()
web = Path(__file__).resolve().parents[1]
assets = web / "src/assets/ui"
assets.mkdir(parents=True, exist_ok=True)
source = Image.open(args.source).convert("RGB")
assert source.size == (1672, 941), "Use the original 1672 × 941 reference."

# Full source bounds include padding; mobile display sizes intentionally reflow.
definitions = [
    ("logo", (199, 165, 112, 112), 96, "tile"),
    ("register", (650, 163, 112, 112), 96, "tile"),
    ("stat-all", (982, 174, 64, 64), 40, "tile"),
    ("stat-completed", (1207, 174, 64, 64), 40, "tile"),
    ("stat-active", (1433, 174, 64, 64), 40, "tile"),
    ("user", (92, 422, 32, 34), 24, "glyph"),
    ("lock", (92, 497, 32, 34), 24, "glyph"),
    ("eye", (383, 499, 32, 30), 24, "glyph"),
    ("logout", (1558, 81, 30, 28), 22, "glyph"),
    ("avatar", (1488, 72, 48, 48), 32, "tile"),
    ("plus", (994, 307, 30, 30), 22, "glyph"),
    ("clock", (1041, 480, 22, 22), 16, "glyph"),
    ("edit", (1509, 460, 30, 30), 24, "glyph"),
    ("delete", (1570, 460, 28, 32), 24, "red"),
    ("check", (228, 198, 57, 45), 20, "glyph"),
    ("waves", (34, 720, 434, 168), 480, "background"),
]
manifest = []
preview = source.copy()
draw = ImageDraw.Draw(preview)
for index, (name, (x, y, width, height), display_width, kind) in enumerate(definitions):
    export_width = round(display_width * 3)
    export_height = round(export_width * height / width)
    manifest.append({
        "id": name,
        "type": "bitmap",
        "source_bbox": {"x": x, "y": y, "width": width, "height": height},
        "scaled_bbox": {"x": x * 750 / 1672, "y": y * 750 / 1672,
                        "width": width * 750 / 1672, "height": height * 750 / 1672},
        "z_index": index,
        "asset": f"src/assets/ui/{name}.png",
        "asset_pixel_width": export_width,
        "asset_pixel_height": export_height,
        "asset_scale_factor": 3,
        "css_display_width": display_width,
        "css_display_height": export_height / 3,
        "transparent_required": kind != "background",
        "notes": "Mobile reflow at max-width 480px; source artwork preserved."
                 if kind != "background" else "Rectangular decorative background; retain original waves and background.",
    })
    draw.rectangle((x, y, x + width, y + height), outline="#ff506f", width=2)
    draw.text((x, y - 12), name, fill="#ff506f")

(assets / "layers.manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
preview.save(web / "qa/bbox-preview.jpg", quality=90)
if not args.extract:
    print("Manifest and bbox preview ready. Inspect before running --extract.")
    raise SystemExit

for definition, layer in zip(definitions, manifest):
    name, (x, y, width, height), _, kind = definition
    crop = source.crop((x, y, x + width, y + height)).resize(
        (layer["asset_pixel_width"], layer["asset_pixel_height"]), Image.Resampling.LANCZOS)
    rgb = np.asarray(crop).astype(float)
    if kind == "background":
        crop.save(assets / f"{name}.png")
        continue
    h, w = rgb.shape[:2]
    xx = np.linspace(0, 1, w)[None, :, None]
    yy = np.linspace(0, 1, h)[:, None, None]
    bg = ((1 - xx) * (1 - yy) * rgb[0, 0] + xx * (1 - yy) * rgb[0, -1]
          + (1 - xx) * yy * rgb[-1, 0] + xx * yy * rgb[-1, -1])
    # The previewed bounds have clear padding around the complete artwork.
    # Interpolate the smooth page background from all four padded edges.
    bg = ((1 - yy) * rgb[0:1, :, :] + yy * rgb[-1:, :, :]
          + (1 - xx) * rgb[:, 0:1, :] + xx * rgb[:, -1:, :] - bg)
    if kind == "tile":
        alpha = np.clip(np.max(np.abs(rgb - bg), axis=2) / 65, 0, 1)
        foreground = bg + (rgb - bg) / np.maximum(alpha[..., None], 0.001)
    else:
        foreground = np.array([245, 119, 130] if kind == "red" else [224, 233, 251])
        alpha = np.clip(np.sum((rgb - bg) * (foreground - bg), axis=2)
                        / np.sum((foreground - bg) ** 2, axis=2), 0, 1)
        foreground = np.broadcast_to(foreground, rgb.shape)
    alpha[alpha < 0.045] = 0
    rgba = np.dstack((np.clip(foreground, 0, 255), alpha * 255)).astype("uint8")
    Image.fromarray(rgba).save(assets / f"{name}.png")

sheet = Image.new("RGB", (960, 5 * 112), "#242a3e")
for index, layer in enumerate(manifest[:-1]):
    asset = Image.open(assets / f"{layer['id']}.png").convert("RGBA")
    asset.thumbnail((64, 72), Image.Resampling.LANCZOS)
    x, y = (index % 4) * 240, (index // 4) * 112
    for column, color in enumerate(["#000000", "#ffffff", "#c6c6c6"]):
        tile = Image.new("RGBA", (80, 80), color)
        if column == 2:
            checker = ImageDraw.Draw(tile)
            for cy in range(0, 80, 8):
                for cx in range(0, 80, 8):
                    if (cx + cy) % 16 == 0:
                        checker.rectangle((cx, cy, cx + 7, cy + 7), fill="#888888")
        tile.alpha_composite(asset, ((80 - asset.width) // 2, (80 - asset.height) // 2))
        sheet.paste(tile.convert("RGB"), (x + column * 80, y + 20))
    ImageDraw.Draw(sheet).text((x + 4, y + 3), layer["id"], fill="white")
sheet.save(web / "qa/assets-preview.png")
print(f"Extracted {len(manifest)} assets without trimming.")
