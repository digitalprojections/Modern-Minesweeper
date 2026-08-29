from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "assets" / "images" / "512x512_play_store_icon.png"
TARGET_DIR = ROOT / "android" / "app" / "src" / "main" / "res" / "drawable-nodpi"
TARGET = TARGET_DIR / "splash_icon.png"


def make_padded_splash_icon(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)

    canvas_size = 768
    icon_size = 456
    icon = Image.open(source).convert("RGBA").resize((icon_size, icon_size), Image.LANCZOS)
    mask = Image.new("L", (icon_size, icon_size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, icon_size - 1, icon_size - 1), radius=100, fill=255)
    icon.putalpha(mask)

    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    offset = ((canvas_size - icon_size) // 2, (canvas_size - icon_size) // 2)
    canvas.alpha_composite(icon, offset)
    canvas.save(target)


if __name__ == "__main__":
    make_padded_splash_icon(SOURCE, TARGET)
    print(f"Generated padded splash icon: {TARGET}")
