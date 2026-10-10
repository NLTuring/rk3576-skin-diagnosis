"""Prepare the already-licensed MakeHuman reference for local browser loading."""
from pathlib import Path
import json
import shutil
import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "design/visuals-v1/assets"
OUT = ROOT / "public/models"
MEDIA = ROOT / "public/media"
OUT.mkdir(parents=True, exist_ok=True)
MEDIA.mkdir(parents=True, exist_ok=True)
vertices, faces, group_indices = [], [], {}
group = ""
for line in (SOURCE / "makehuman-base.obj").read_text().splitlines():
    if line.startswith("v "):
        vertices.append([float(n) for n in line.split()[1:4]])
    elif line.startswith("g "):
        group = line[2:]
    elif line.startswith("f "):
        indices = [int(n.split("/")[0])-1 for n in line.split()[1:]]
        group_indices.setdefault(group, set()).update(indices)
        if group in {"body", "helper-l-eye", "helper-r-eye"}:
            faces += [[indices[0],indices[i],indices[i+1]] for i in range(1,len(indices)-1)]
v = np.asarray(vertices)
f = np.asarray(faces)
mesh = trimesh.Trimesh(vertices=v, faces=f, process=True)
(OUT / "body.glb").write_bytes(trimesh.exchange.gltf.export_glb(mesh))

def surface_at(x, y):
    tri = v[f]
    ax, ay = tri[:,0,0],tri[:,0,1]
    bx, by = tri[:,1,0],tri[:,1,1]
    cx, cy = tri[:,2,0],tri[:,2,1]
    denominator = (by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
    good = abs(denominator)>1e-8
    denominator = np.where(good,denominator,1)
    a = ((by-cy)*(x-cx)+(cx-bx)*(y-cy))/denominator
    b = ((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/denominator
    c = 1-a-b
    z=a*tri[:,0,2]+b*tri[:,1,2]+c*tri[:,2,2]
    z=np.where(good & (a>=0)&(b>=0)&(c>=0),z,-np.inf)
    return float(z.max()+0.025) if np.isfinite(z).any() else 1.0

points={}
for key, groups in {
    "leftForearm":["joint-l-elbow","joint-l-hand"],
    "rightUpperarm":["joint-r-elbow","joint-r-shoulder"],
    "leftShin":["joint-l-knee","joint-l-ankle"],
}.items():
    point=np.mean([v[list(group_indices[g])].mean(0) for g in groups],axis=0)
    points[key]=[round(float(point[0]),4),round(float(point[1]),4),round(surface_at(point[0],point[1]),4)]
(OUT / "landmarks.json").write_text(json.dumps(points,indent=2))
for name in ["makehuman-LICENSE.md","makehuman-LICENSE-ASSETS.md","sources.json"]:
    shutil.copy2(SOURCE/name,OUT/name)
shutil.copy2(SOURCE/"body-matte.png",MEDIA/"body-front.png")
shutil.copy2(SOURCE/"arm-reference.png",MEDIA/"arm-reference.png")
print(json.dumps({"glbBytes":(OUT/"body.glb").stat().st_size,"points":points},indent=2))
