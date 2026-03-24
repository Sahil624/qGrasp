#!/usr/bin/env python3
"""
Generate printable marker sheet for QuantumGrasp.
Creates ArUco markers 0-4 mapping to H, X, Y, Z, CX gates.
Requires: pip install opencv-python
"""

try:
    import cv2
    import numpy as np
except ImportError:
    print("Install opencv-python: pip install opencv-python")
    exit(1)

# ArUco 4x4 dictionary
aruco_dict = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
marker_size = 200  # pixels per marker
margin = 40
gates = ["H (Hadamard)", "X (Pauli-X)", "Y (Pauli-Y)", "Z (Pauli-Z)", "CX (CNOT)"]

# Create markers 0-4 (try both API styles for OpenCV compatibility)
def draw_marker(dict_obj, marker_id, size):
    try:
        return cv2.aruco.generateImageMarker(dict_obj, marker_id, size)
    except AttributeError:
        return cv2.aruco.drawMarker(dict_obj, marker_id, size)

markers = []
for i in range(5):
    img = draw_marker(aruco_dict, i, marker_size)
    img = cv2.copyMakeBorder(img, margin, margin + 30, margin, margin, cv2.BORDER_CONSTANT, value=255)
    cv2.putText(img, gates[i], (10, marker_size + margin + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.5, 0, 1)
    markers.append(img)

# Arrange in a grid (e.g., 2 rows)
row1 = np.hstack([markers[0], np.ones((markers[0].shape[0], 20), dtype=np.uint8) * 255, markers[1], np.ones((markers[0].shape[0], 20), dtype=np.uint8) * 255, markers[2]])
row2 = np.hstack([markers[3], np.ones((markers[0].shape[0], 20), dtype=np.uint8) * 255, markers[4], np.ones((markers[0].shape[0], 20), dtype=np.uint8) * 255, np.ones_like(markers[0]) * 255])
sheet = np.vstack([row1, np.ones((20, row1.shape[1]), dtype=np.uint8) * 255, row2])

# Add title
title = np.ones((60, sheet.shape[1]), dtype=np.uint8) * 255
cv2.putText(title, "QuantumGrasp - Gate Markers (print and cut)", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, 0, 2)
sheet = np.vstack([title, sheet])

output_path = "assets/markers/quantum_grasp_markers.png"
import os
os.makedirs(os.path.dirname(output_path), exist_ok=True)
cv2.imwrite(output_path, sheet)
print(f"Saved to {output_path}")
