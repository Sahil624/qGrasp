#!/usr/bin/env python3
"""Regenerate Android launcher/splash assets from assets/icons (matches app.json paths)."""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "assets" / "icons"
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"
IOS_ICON = (
    ROOT
    / "ios"
    / "QuantumGrasp"
    / "Images.xcassets"
    / "AppIcon.appiconset"
    / "App-Icon-1024x1024@1x.png"
)

# Adaptive icon foreground layer (dp-equivalent px per density)
ADAPTIVE_FG = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}
# Legacy launcher icon (baseline px)
LEGACY_ICON = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
SPLASH_SIZES = {
    "drawable-mdpi": 288,
    "drawable-hdpi": 432,
    "drawable-xhdpi": 576,
    "drawable-xxhdpi": 864,
    "drawable-xxxhdpi": 1152,
}
BG = (17, 17, 27)  # #11111b


def save_webp(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="WEBP", quality=90, method=6)


def solid_rgb(size: int) -> Image.Image:
    return Image.new("RGB", (size, size), BG)


def main() -> None:
    adaptive = Image.open(ICONS / "adaptive-icon.png").convert("RGBA")
    splash_src = Image.open(ICONS / "splash-icon.png").convert("RGBA")
    app_icon = Image.open(ICONS / "icon.png").convert("RGBA")

    for folder, px in ADAPTIVE_FG.items():
        base = ANDROID_RES / folder
        fg = adaptive.resize((px, px), Image.Resampling.LANCZOS)
        bg = solid_rgb(px)
        # Monochrome: luminance for adaptive monochrome slot
        mono = fg.convert("L").convert("RGBA")
        save_webp(fg, base / "ic_launcher_foreground.webp")
        save_webp(bg, base / "ic_launcher_background.webp")
        save_webp(mono, base / "ic_launcher_monochrome.webp")
        lw = LEGACY_ICON[folder]
        legacy = app_icon.resize((lw, lw), Image.Resampling.LANCZOS)
        save_webp(legacy, base / "ic_launcher.webp")
        save_webp(legacy, base / "ic_launcher_round.webp")

    for folder, px in SPLASH_SIZES.items():
        out = ANDROID_RES / folder / "splashscreen_logo.png"
        im = splash_src.resize((px, px), Image.Resampling.LANCZOS)
        out.parent.mkdir(parents=True, exist_ok=True)
        im.save(out, format="PNG")

    # iOS store icon 1024x1024
    ios1024 = app_icon.resize((1024, 1024), Image.Resampling.LANCZOS)
    IOS_ICON.parent.mkdir(parents=True, exist_ok=True)
    ios1024.save(IOS_ICON, format="PNG")
    print("Wrote Android mipmaps, splash drawables, iOS App Icon 1024.")


if __name__ == "__main__":
    main()
