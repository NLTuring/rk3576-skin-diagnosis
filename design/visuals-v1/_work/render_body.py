"""Render the licensed reference mesh for static design boards, not product code."""
from pathlib import Path
import json
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
vertices, triangles, group_vertices = [], [], {}
group = ""
for line in (ROOT / "assets/makehuman-base.obj").read_text().splitlines():
    if line.startswith("v "):
        vertices.append([float(v) for v in line.split()[1:4]])
    elif line.startswith("g "):
        group = line[2:]
    elif line.startswith("f "):
        indices = [int(v.split("/")[0]) - 1 for v in line.split()[1:]]
        group_vertices.setdefault(group, set()).update(indices)
        if group in {"body", "helper-l-eye", "helper-r-eye"}:
            triangles.extend([[indices[0], indices[i], indices[i + 1]] for i in range(1, len(indices)-1)])

v = np.asarray(vertices, dtype=np.float32)
f = np.asarray(triangles, dtype=np.int32)
angle = np.deg2rad(-5)
rotation = np.array([[np.cos(angle), 0, np.sin(angle)], [0, 1, 0], [-np.sin(angle), 0, np.cos(angle)]])
v = v @ rotation.T
used = np.unique(f)
bottom, top = v[used, 1].min(), v[used, 1].max()
width, height = 2000, 3040
scale = (height - 66) / (top - bottom)
xy = np.column_stack((width / 2 + v[:, 0] * scale, 30 + (top - v[:, 1]) * scale))
normal = np.zeros_like(v)
face_normal = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
for corner in range(3):
    np.add.at(normal, f[:, corner], face_normal)
normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-10)
light = np.array([-.6, .65, 1.1])
light /= np.linalg.norm(light)
fill = np.array([.8, .15, .8])
fill /= np.linalg.norm(fill)
canvas = np.zeros((height, width, 4), dtype=np.uint8)
depth = np.full((height, width), -np.inf, dtype=np.float32)
base = np.array([246, 242, 231])
for face in f:
    points = xy[face]
    x0 = max(0, int(np.floor(points[:, 0].min())))
    x1 = min(width-1, int(np.ceil(points[:, 0].max())))
    y0 = max(0, int(np.floor(points[:, 1].min())))
    y1 = min(height-1, int(np.ceil(points[:, 1].max())))
    if x0 > x1 or y0 > y1:
        continue
    ax, ay = points[0]
    bx, by = points[1]
    cx, cy = points[2]
    denominator = (by-cy)*(ax-cx) + (cx-bx)*(ay-cy)
    if abs(denominator) < 1e-9:
        continue
    xx, yy = np.meshgrid(np.arange(x0, x1+1)+.5, np.arange(y0, y1+1)+.5)
    wa = ((by-cy)*(xx-cx)+(cx-bx)*(yy-cy))/denominator
    wb = ((cy-ay)*(xx-cx)+(ax-cx)*(yy-cy))/denominator
    wc = 1-wa-wb
    z = wa*v[face[0], 2]+wb*v[face[1], 2]+wc*v[face[2], 2]
    take = (wa >= -1e-6) & (wb >= -1e-6) & (wc >= -1e-6) & (z > depth[y0:y1+1, x0:x1+1])
    if not take.any():
        continue
    n = wa[..., None]*normal[face[0]] + wb[..., None]*normal[face[1]] + wc[..., None]*normal[face[2]]
    n /= np.maximum(np.linalg.norm(n, axis=2, keepdims=True), 1e-9)
    diffuse = np.maximum(0, n @ light)
    secondary = np.maximum(0, n @ fill)
    # Soft diffuse material keeps the mesh readable without metallic highlights.
    intensity = .66 + .28*diffuse + .06*secondary
    color = np.clip(base[None, None, :] * intensity[..., None], 0, 255).astype(np.uint8)
    patch = canvas[y0:y1+1, x0:x1+1]
    patch[take, :3] = color[take]
    patch[take, 3] = 255
    depth[y0:y1+1, x0:x1+1][take] = z[take]

Image.fromarray(canvas).save(ROOT / "assets/body-matte.png")
landmarks = {}
for name, groups in {
    "left_forearm": ["joint-l-elbow", "joint-l-hand"],
    "right_upperarm": ["joint-r-elbow", "joint-r-shoulder"],
    "left_shin": ["joint-l-knee", "joint-l-ankle"],
}.items():
    centers = [v[list(group_vertices[g])].mean(0) for g in groups]
    point = np.mean(centers, axis=0)
    landmarks[name] = [float((width/2 + point[0]*scale)/width), float((30+(top-point[1])*scale)/height)]
(ROOT / "assets/body-landmarks.json").write_text(json.dumps(landmarks, indent=2))
print(json.dumps({"output": str(ROOT / "assets/body-matte.png"), "triangles": len(f), "landmarks": landmarks}, indent=2))
