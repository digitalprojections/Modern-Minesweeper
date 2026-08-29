from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def contain_to_size(image: Image.Image, target_width: int, target_height: int) -> Image.Image:
    source_width, source_height = image.size
    scale = min(target_width / source_width, target_height / source_height)
    resized_width = round(source_width * scale)
    resized_height = round(source_height * scale)
    resized = image.resize((resized_width, resized_height), Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", (target_width, target_height), (5, 5, 5))
    left = (target_width - resized_width) // 2
    top = (target_height - resized_height) // 2
    canvas.paste(resized, (left, top))

    return canvas


def center_crop_to_size(image: Image.Image, target_width: int, target_height: int) -> Image.Image:
    source_width, source_height = image.size
    target_ratio = target_width / target_height
    source_ratio = source_width / source_height

    if source_ratio > target_ratio:
        crop_width = round(source_height * target_ratio)
        left = (source_width - crop_width) // 2
        box = (left, 0, left + crop_width, source_height)
    else:
        crop_height = round(source_width / target_ratio)
        top = (source_height - crop_height) // 2
        box = (0, top, source_width, top + crop_height)

    return image.crop(box).resize((target_width, target_height), Image.Resampling.LANCZOS)


def format_store_screenshot(source: Path, target: Path, target_width: int, target_height: int, mode: str = "contain") -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    image = Image.open(source).convert("RGB")
    if mode == "crop":
        formatted = center_crop_to_size(image, target_width, target_height)
    else:
        formatted = contain_to_size(image, target_width, target_height)
    formatted.save(target, optimize=True)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Format an Android screenshot for Google Play store listing upload.")
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    parser.add_argument("--width", type=int, required=True)
    parser.add_argument("--height", type=int, required=True)
    parser.add_argument("--mode", choices=("contain", "crop"), default="contain")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    format_store_screenshot(args.source, args.target, args.width, args.height, args.mode)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
