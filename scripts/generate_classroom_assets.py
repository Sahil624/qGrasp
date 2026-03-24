#!/usr/bin/env python3
"""
Generate printable QuantumGrasp classroom assets.

Gate and corner markers use OpenCV ArUco DICT_4X4_50 (see playmat_profile.json "aruco").

Outputs:
- playmat_{paper}_{rows}x{cols}.png (paper layout defaults to **landscape**)
- gate_cards_{paper}.png (sheet of **square** cards; tag fills card minus a thin text band)
- cards/{CODE}.png (same square layout per gate)
- playmat_profile.json

Dependencies:
    pip install opencv-python numpy
"""

from __future__ import annotations

import argparse
import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Tuple

import cv2
import numpy as np

PAPER_MM = {
    "A4": (210, 297),  # portrait dimensions
    "A3": (297, 420),  # portrait dimensions
}

# Must match GridDetectorModule.kt: DICT_4X4_50, gate index == ArUco marker id.
ARUCO_DICT_NAME = "DICT_4X4_50"
# Corner playmat anchors use ids 10–13 so they never collide with gate ids 0–7.
ANCHOR_ARUCO_BASE_ID = 10

GATE_CODES = [
    ("H", "Hadamard"),
    ("X", "Pauli-X"),
    ("Y", "Pauli-Y"),
    ("Z", "Pauli-Z"),
    ("CX_C", "CNOT Control"),
    ("CX_T", "CNOT Target"),
    ("SWAP_A", "Swap End A"),
    ("SWAP_B", "Swap End B"),
]


@lru_cache(maxsize=1)
def _aruco_dictionary():
    return cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)


def mm_to_px(mm: float, dpi: int) -> int:
    return int(round(mm * dpi / 25.4))


def gate_aruco_id(code: str) -> int:
    for i, (c, _) in enumerate(GATE_CODES):
        if c == code:
            return i
    raise ValueError(f"Unknown gate code: {code}")


def draw_aruco_tag(marker_id: int, size_px: int, border_px: int = 8) -> np.ndarray:
    """
    White square, black outer frame (matches legacy tag look), ArUco pattern in the inner region.
    Must stay consistent with Kotlin: Objdetect.DICT_4X4_50 and the same inner placement.
    """
    tag = np.ones((size_px, size_px), dtype=np.uint8) * 255
    cv2.rectangle(tag, (0, 0), (size_px - 1, size_px - 1), 0, border_px)
    inner0 = border_px + 1
    inner1 = size_px - border_px - 1
    inner_span = max(16, inner1 - inner0 + 1)
    marker = cv2.aruco.generateImageMarker(_aruco_dictionary(), marker_id, inner_span)
    tag[inner0 : inner0 + inner_span, inner0 : inner0 + inner_span] = marker
    return tag


def make_canvas(paper: str, dpi: int, landscape: bool) -> np.ndarray:
    w_mm, h_mm = PAPER_MM[paper.upper()]
    if landscape:
        w_mm, h_mm = h_mm, w_mm
    width = mm_to_px(w_mm, dpi)
    height = mm_to_px(h_mm, dpi)
    return np.full((height, width, 3), 255, dtype=np.uint8)


def draw_playmat(
    canvas: np.ndarray,
    rows: int,
    cols: int,
    margin_mm: float,
    cell_mm: float,
    marker_mm: float,
    dpi: int,
) -> Dict[str, object]:
    h, w, _ = canvas.shape
    margin = mm_to_px(margin_mm, dpi)
    cell = mm_to_px(cell_mm, dpi)
    marker_size = mm_to_px(marker_mm, dpi)

    x0 = margin + marker_size + mm_to_px(8, dpi)
    y0 = margin + marker_size + mm_to_px(8, dpi)
    x1 = x0 + cols * cell
    y1 = y0 + rows * cell

    cv2.rectangle(canvas, (x0, y0), (x1, y1), (30, 30, 30), 3)

    for c in range(1, cols):
        x = x0 + c * cell
        cv2.line(canvas, (x, y0), (x, y1), (180, 180, 180), 1)
    for r in range(1, rows):
        y = y0 + r * cell
        cv2.line(canvas, (x0, y), (x1, y), (180, 180, 180), 1)

    # Axis labels
    for r in range(rows):
        label_y = y0 + r * cell + cell // 2 + 6
        cv2.putText(canvas, f"Q{r}", (x0 - mm_to_px(12, dpi), label_y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (20, 20, 20), 2)
    for c in range(cols):
        label_x = x0 + c * cell + cell // 2 - 10
        cv2.putText(canvas, f"T{c}", (label_x, y0 - mm_to_px(5, dpi)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (20, 20, 20), 2)

    cv2.putText(
        canvas,
        "QuantumGrasp Playmat",
        (x0, max(30, y0 - mm_to_px(14, dpi))),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.9,
        (10, 10, 10),
        2,
    )

    anchor_codes = ["A1", "A2", "A3", "A4"]
    anchors: List[Tuple[int, int, int]] = []
    corner_positions = [
        (margin, margin),
        (w - margin - marker_size, margin),
        (margin, h - margin - marker_size),
        (w - margin - marker_size, h - margin - marker_size),
    ]

    for idx, (ax, ay) in enumerate(corner_positions):
        anchor_id = ANCHOR_ARUCO_BASE_ID + idx
        marker = draw_aruco_tag(anchor_id, marker_size, border_px=max(6, marker_size // 10))
        marker_rgb = cv2.cvtColor(marker, cv2.COLOR_GRAY2BGR)
        canvas[ay : ay + marker_size, ax : ax + marker_size] = marker_rgb
        anchors.append((idx, ax, ay))
        cv2.putText(canvas, f"A{idx+1}", (ax, ay + marker_size + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (20, 20, 20), 2)

    return {
        "rows": rows,
        "cols": cols,
        "cell_mm": cell_mm,
        "margin_mm": margin_mm,
        "anchor_marker_mm": marker_mm,
        "anchor_ids": anchor_codes,
        "grid_rect_px": {"x0": x0, "y0": y0, "x1": x1, "y1": y1},
    }


def _draw_square_card_content(
    canvas: np.ndarray,
    x: int,
    y: int,
    card_px: int,
    code: str,
    label: str,
    dpi: int,
) -> None:
    """Draw one square card at (x,y) with tag filling the upper portion; thin bottom band for text."""
    cv2.rectangle(canvas, (x, y), (x + card_px - 1, y + card_px - 1), (30, 30, 30), 2)

    # Bottom band for human-readable labels only; tag uses almost all remaining area.
    text_band = max(int(round(card_px * 0.13)), mm_to_px(4, dpi))
    inner_margin = max(2, card_px // 80)
    tag_size = max(24, card_px - text_band - 2 * inner_margin)
    tag_x = x + (card_px - tag_size) // 2
    tag_y = y + inner_margin

    marker = draw_aruco_tag(gate_aruco_id(code), tag_size, border_px=max(2, max(1, tag_size // 24)))
    marker_rgb = cv2.cvtColor(marker, cv2.COLOR_GRAY2BGR)
    canvas[tag_y : tag_y + tag_size, tag_x : tag_x + tag_size] = marker_rgb

    # White strip behind text for readability
    strip_y0 = y + card_px - text_band
    cv2.rectangle(canvas, (x + 1, strip_y0), (x + card_px - 2, y + card_px - 2), (255, 255, 255), -1)

    code_size = 0.45 if card_px < 180 else 0.6
    label_size = 0.32 if card_px < 180 else 0.42
    tx = x + inner_margin
    ty_code = y + card_px - mm_to_px(3, dpi)
    cv2.putText(canvas, code, (tx, ty_code - mm_to_px(5, dpi)), cv2.FONT_HERSHEY_SIMPLEX, code_size, (10, 10, 10), 2)
    cv2.putText(canvas, label, (tx, ty_code), cv2.FONT_HERSHEY_SIMPLEX, label_size, (40, 40, 40), 1)


def draw_gate_sheet(canvas: np.ndarray, card_mm: float, dpi: int) -> Dict[str, int]:
    h, w, _ = canvas.shape
    card_px = mm_to_px(card_mm, dpi)
    pad = mm_to_px(8, dpi)
    cols = max(1, (w - pad) // (card_px + pad))

    for i, (code, label) in enumerate(GATE_CODES):
        row = i // cols
        col = i % cols
        x = pad + col * (card_px + pad)
        y = pad + row * (card_px + pad) + mm_to_px(10, dpi)
        if y + card_px > h:
            break
        _draw_square_card_content(canvas, x, y, card_px, code, label, dpi)

    title_y = mm_to_px(7, dpi)
    cv2.putText(canvas, "QuantumGrasp Gate Cards (print + cut)", (pad, title_y), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (10, 10, 10), 2)
    return {str(i): code for i, (code, _) in enumerate(GATE_CODES)}


def make_single_card_image(code: str, label: str, dpi: int, card_mm: float) -> np.ndarray:
    card_px = mm_to_px(card_mm, dpi)
    card = np.full((card_px, card_px, 3), 255, dtype=np.uint8)
    _draw_square_card_content(card, 0, 0, card_px, code, label, dpi)
    return card


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate playmat + gate cards for QuantumGrasp.")
    parser.add_argument("--paper", default="A4", choices=["A4", "A3"])
    parser.add_argument("--rows", type=int, default=4)
    parser.add_argument("--cols", type=int, default=6)
    parser.add_argument("--cell-mm", type=float, default=32.0)
    parser.add_argument("--margin-mm", type=float, default=10.0)
    parser.add_argument("--anchor-mm", type=float, default=24.0)
    parser.add_argument(
        "--tag-mm",
        type=float,
        default=20.0,
        help="Legacy: anchor corner marker size on playmat (mm). Gate tag size is derived from square card.",
    )
    parser.add_argument(
        "--card-mm",
        type=float,
        default=34.0,
        help="Square gate card side length in mm (print + individual PNGs).",
    )
    parser.add_argument("--dpi", type=int, default=300)
    parser.add_argument("--out-dir", default="assets/classroom")
    parser.add_argument(
        "--portrait",
        action="store_true",
        help="Use portrait paper orientation. Default is landscape for playmat and card sheet.",
    )
    args = parser.parse_args()

    landscape = not args.portrait

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    playmat = make_canvas(args.paper, args.dpi, landscape)
    profile = draw_playmat(
        playmat,
        rows=args.rows,
        cols=args.cols,
        margin_mm=args.margin_mm,
        cell_mm=args.cell_mm,
        marker_mm=args.anchor_mm,
        dpi=args.dpi,
    )

    gate_sheet = make_canvas(args.paper, args.dpi, landscape)
    gate_map = draw_gate_sheet(gate_sheet, card_mm=args.card_mm, dpi=args.dpi)

    playmat_name = f"playmat_{args.paper.lower()}_{args.rows}x{args.cols}.png"
    gate_name = f"gate_cards_{args.paper.lower()}.png"
    cv2.imwrite(str(out_dir / playmat_name), playmat)
    cv2.imwrite(str(out_dir / gate_name), gate_sheet)
    cards_dir = out_dir / "cards"
    cards_dir.mkdir(parents=True, exist_ok=True)
    for code, label in GATE_CODES:
        card = make_single_card_image(code, label, dpi=args.dpi, card_mm=args.card_mm)
        cv2.imwrite(str(cards_dir / f"{code}.png"), card)

    gate_aruco_map = {code: i for i, (code, _) in enumerate(GATE_CODES)}
    anchor_aruco_map = {f"A{i + 1}": ANCHOR_ARUCO_BASE_ID + i for i in range(4)}
    payload = {
        "paper": args.paper,
        "landscape": landscape,
        "dpi": args.dpi,
        "profile": profile,
        "tag_mm": args.tag_mm,
        "card_mm": args.card_mm,
        "gate_marker_mapping": gate_map,
        "aruco": {
            "dictionary": ARUCO_DICT_NAME,
            "gate_marker_ids": gate_aruco_map,
            "anchor_marker_ids": anchor_aruco_map,
        },
    }
    (out_dir / "playmat_profile.json").write_text(json.dumps(payload, indent=2))
    print(f"Saved {out_dir / playmat_name}")
    print(f"Saved {out_dir / gate_name}")
    print(f"Saved card images to {cards_dir}")
    print(f"Saved {out_dir / 'playmat_profile.json'}")


if __name__ == "__main__":
    main()

