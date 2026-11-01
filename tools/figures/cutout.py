"""Cut a dark figure out of a white background, decontaminate edges, sink the face into shadow,
and build the glow texture (blurred alpha at three radii) the aura shader reads."""
import sys, json
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

name, face = sys.argv[1], json.loads(sys.argv[2])  # face: [cx, cy, rx, ry] in source pixels
src = np.asarray(Image.open(f'src/{name}.jpg').convert('RGB')).astype(np.float32)
H, W = src.shape[:2]
L = src.mean(2)

# Background: near-white regions connected to the border, plus enclosed white gaps in the torn cape
white = L > 232
lab, n = ndi.label(white)
sizes = ndi.sum(white, lab, range(1, n + 1))
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
keep = np.zeros(n + 1, bool)
for i in range(1, n + 1):
    if i in border or sizes[i - 1] >= 4:
        keep[i] = True
bg = keep[lab]

# Soft alpha only in a thin band next to the background; solid inside the figure
band = ndi.binary_dilation(bg, iterations=3) & ~bg
alpha = np.ones((H, W), np.float32)
alpha[bg] = 0.0
alpha[band] = np.clip((250.0 - L[band]) / (250.0 - 105.0), 0.0, 1.0)

# Remove the white fringe from edge colours: C = a*F + (1-a)*255  ->  F = (C - (1-a)*255) / a
a3 = np.maximum(alpha, 1e-3)[..., None]
fg = np.clip((src - (1.0 - alpha[..., None]) * 255.0) / a3, 0, 255)
fg[alpha < 0.02] = 0

# Sink the face into the hood's shadow (soft elliptical falloff)
cx, cy, rx, ry = face
yy, xx = np.mgrid[0:H, 0:W]
d = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
shade = np.clip((d - 0.55) / 0.6, 0.0, 1.0) ** 1.4   # 0 at centre -> 1 outside
fg *= (0.04 + 0.96 * shade)[..., None]

# Trim to the figure with a small margin
ys, xs = np.where(alpha > 0.02)
pad = 24
y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad, H)
x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad, W)
fg, alpha = fg[y0:y1, x0:x1], alpha[y0:y1, x0:x1]
h, w = alpha.shape

# Place on a fixed 2:3 canvas with room around it for the aura: feet near the bottom, centred
CW, CH = 768, 1152
scale = min((CW * 0.78) / w, (CH * 0.86) / h)
nw, nh = int(round(w * scale)), int(round(h * scale))
rgba = np.dstack([fg, alpha * 255]).astype(np.uint8)
fig = Image.fromarray(rgba, 'RGBA').resize((nw, nh), Image.LANCZOS)
canvas = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
ox, oy = (CW - nw) // 2, CH - nh - int(CH * 0.02)
canvas.paste(fig, (ox, oy), fig)
canvas.save(f'../../public/fig/{name}.png', optimize=True)

# Glow texture: alpha blurred at three radii in R, G, B
A = canvas.split()[3]
def blur(r):
    return np.asarray(A.filter(ImageFilter.GaussianBlur(r))).astype(np.float32)
g = np.dstack([blur(4), blur(16), blur(48)])
g = (g / np.maximum(g.reshape(-1, 3).max(0), 1) * 255).clip(0, 255).astype(np.uint8)
Image.fromarray(g, 'RGB').save(f'../../public/fig/{name}-glow.png', optimize=True)

# Report where the face ended up (in canvas UV, origin bottom-left) for the eyes
fx = (ox + (cx - x0) * scale) / CW
fy = 1 - (oy + (cy - 0.5 * ry - y0) * scale) / CH
print(json.dumps({'name': name, 'eyeUV': [round(fx, 4), round(fy, 4)], 'eyeSpreadUV': round(rx * 0.42 * scale / CW, 4)}))
