# Silhouette comparison of a render against a reference view (super_prompt.pdf §6).
#
#   python tools/compare_silhouette.py <ref.png> <render.png> <out_prefix>
#     -> prints IoU and the per-band width report; writes <out_prefix>_side_by_side.png
#        (reference | render | overlay: red = missing volume, blue = too much, grey = match)
#
# Masks: the render's alpha; the reference's character is separated from its
# flat cream backdrop by a flood fill from the border (tolerant of the soft floor
# shadow, stopped by the character's outline). Both silhouettes are cropped to
# their bounding box, scaled to the same height and centred, so the score is
# about shape, not framing. Bands: 20 horizontal slices, width compared per band
# (TOO WIDE / TOO NARROW when off by more than 5%).

import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

H = 1000

def ref_mask(path):
    im = np.asarray(Image.open(path).convert('RGB').filter(ImageFilter.GaussianBlur(1.2))).astype(float)
    h, w, _ = im.shape
    border = np.concatenate([im[0], im[-1], im[:, 0], im[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((im - bg) ** 2).sum(-1))
    # background = near the backdrop colour AND connected to the border
    near = dist < 16
    # the soft floor shadow (only near the bottom): the backdrop's own hue, just darker
    lum = im.sum(-1); bl = bg.sum()
    chroma = np.abs(im / np.maximum(lum[..., None], 1) - bg / bl).sum(-1)
    shadow = (chroma < 0.02) & (lum < bl) & (lum > 0.55 * bl)
    shadow[: int(h * 0.88)] = False
    near |= shadow
    lab, _ = ndimage.label(near)
    edge_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgm = np.isin(lab, list(edge_labels))
    # the soft floor shadow: low-saturation, darker backdrop below the feet
    m = ~bgm
    m = ndimage.binary_opening(m, iterations=2)
    m = ndimage.binary_fill_holes(m)
    lab, n = ndimage.label(m)
    if n: m = lab == (np.argmax(np.bincount(lab.ravel())[1:]) + 1)
    return m

def render_mask(path):
    a = np.asarray(Image.open(path).convert('RGBA'))[..., 3] > 128
    return ndimage.binary_fill_holes(a)

def normalise(m):
    """crop to the silhouette, scale to height H, and centre on the head (the top 40%),
    so a missing or extra part (a backpack) shows up as itself instead of shifting everything"""
    ys, xs = np.nonzero(m)
    m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = m.shape; k = H / h
    im = Image.fromarray((m * 255).astype(np.uint8)).resize((max(1, int(w * k)), H), Image.BILINEAR)
    m = np.asarray(im) > 127
    head_x = np.nonzero(m[: int(H * 0.4)])[1].mean()
    W = 1000; out = np.zeros((H, W), bool); w = m.shape[1]; x0 = int(round(W / 2 - head_x))
    out[:, max(0, x0):max(0, x0) + min(w, W)] = m[:, max(0, -x0):max(0, -x0) + min(w, W)]
    return out

def bands(m, n=20):
    rows = np.array_split(m, n, axis=0)
    return [r.any(0).sum() for r in rows]

if __name__ == '__main__':
    ref, ren, out = sys.argv[1], sys.argv[2], sys.argv[3]
    A, B = normalise(ref_mask(ref)), normalise(render_mask(ren))
    iou = (A & B).sum() / max(1, (A | B).sum())
    print(f'IoU {iou:.3f}')
    for i, (wa, wb) in enumerate(zip(bands(A), bands(B))):
        d = (wb - wa) / max(1, wa)
        flag = 'TOO WIDE' if d > 0.05 else 'TOO NARROW' if d < -0.05 else 'ok'
        print(f'band {i:2d} ({i * 5:3d}-{i * 5 + 5:3d}% from top)  ref {wa:4d}  model {wb:4d}  {d:+.0%}  {flag}')
    ov = np.full((H, 1000, 3), 255, np.uint8)
    ov[A & B] = (170, 170, 170); ov[A & ~B] = (220, 40, 40); ov[~A & B] = (40, 80, 220)
    tile = lambda m: np.stack([np.where(m, 60, 245)] * 3, -1).astype(np.uint8)
    Image.fromarray(np.concatenate([tile(A), tile(B), ov], 1)).resize((1500, 500)).save(out + '_side_by_side.png')
