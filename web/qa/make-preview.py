"""Arrange the actual 375px browser screenshots into one review image."""

from pathlib import Path

from PIL import Image, ImageDraw


qa = Path(__file__).resolve().parent
screens = [Image.open(qa / f"screenshots/{name}-375.png").convert("RGB")
           for name in ("login", "register", "todos")]
gutter, top = 24, 48
height = max(screen.height for screen in screens) + top + gutter
preview = Image.new("RGB", (375 * 3 + gutter * 4, height), "#11162a")
draw = ImageDraw.Draw(preview)
for index, (screen, label) in enumerate(zip(screens, ("LOGIN / 375px", "REGISTER / 375px", "TODO LIST / 375px"))):
    x = gutter + index * (375 + gutter)
    draw.text((x, 20), label, fill="#b7c3e0")
    preview.paste(screen, (x, top))
preview.save(qa / "mobile-preview.png")
print(f"Preview: {preview.width} × {preview.height}")
