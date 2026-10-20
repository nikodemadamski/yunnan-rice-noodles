# Paints the heroine's face texture (skin + features) for the head's front
# planar UV (girl.py): u = 0.5 + x / (2 * FACE_W), v = (z - FACE_Z0) / FACE_H.
# Big glossy brown eyes with two catch-lights, little brows, a button nose,
# a small smile and soft blush, after design/ref_hero-girl.jpg.
#
#   python face_paint.py <out.png> [expression]

import sys, math
from PIL import Image, ImageDraw, ImageFilter

S = 1024                     # texture size
SS = 2                       # supersampling
FACE_W, FACE_Z0, FACE_H = 0.5, 1.12, 1.0
HEAD_Z = 1.62
SKIN = (248, 204, 172)          # warm apricot
SKIN_SHADE = (236, 178, 146)

def px(x, z):
    """head coordinates (x, z) -> pixel (supersampled)"""
    u = 0.5 + x / (2 * FACE_W); v = (z - FACE_Z0) / FACE_H
    return u * S * SS, (1 - v) * S * SS

def ell(d, x, z, rx, rz, fill):
    cx, cy = px(x, z); k = S * SS / (2 * FACE_W)
    d.ellipse([cx - rx * k, cy - rz * k, cx + rx * k, cy + rz * k], fill=fill)

def soft_layer(size, draw_fn, blur, col):
    # start from the colour at zero alpha so the blur doesn't drag in a dark fringe
    lay = Image.new('RGBA', size, col[:3] + (0,)); draw_fn(ImageDraw.Draw(lay))
    return lay.filter(ImageFilter.GaussianBlur(blur))

def paint(expr='normal'):
    W = S * SS
    im = Image.new('RGBA', (W, W), SKIN + (255,))
    k = W / (2 * FACE_W)
    # warm shading toward the jaw and round the edges of the face (reads as volume)
    im.alpha_composite(soft_layer(im.size, lambda d: ell(d, 0, HEAD_Z - 0.3, 0.3, 0.1, SKIN_SHADE + (120,)), 60, SKIN_SHADE))
    # blush: big soft peach ovals under the eyes
    for sx in (-1, 1):
        im.alpha_composite(soft_layer(im.size, lambda d: ell(d, sx * 0.255, 1.455, 0.1, 0.062, (242, 118, 96, 200)), 34, (242, 118, 96)))
    d = ImageDraw.Draw(im)
    EY, EX, ERX, ERZ = 1.545, 0.17, 0.074, 0.086
    ink = (52, 30, 20, 255)
    for sx in (-1, 1):
        x = sx * EX
        if expr in ('happy', 'excited'):
            # closed happy eyes: a soft upward arch
            cx, cy = px(x, EY); r = ERX * k
            d.arc([cx - r, cy - r * 0.7, cx + r, cy + r * 1.1], 200, 340, fill=ink, width=int(0.016 * k))
            continue
        # the eye: dark rim, warm iris (dark at the top, amber at the bottom), pupil, catch-lights
        ell(d, x, EY, ERX, ERZ, (40, 22, 14, 255))
        iris = Image.new('RGBA', im.size, (0, 0, 0, 0)); di = ImageDraw.Draw(iris)
        steps = 24
        for i in range(steps):
            t = i / (steps - 1)
            col = tuple(int(a + (b - a) * t) for a, b in zip((30, 16, 10), (122, 70, 38))) + (255,)
            ell(di, x, EY + ERZ * 0.62 - t * ERZ * 1.2, ERX * 0.8 * (1 - 0.25 * abs(t - 0.55)), ERZ * 0.35, col)
        mask = Image.new('L', im.size, 0); ell(ImageDraw.Draw(mask), x, EY - ERZ * 0.06, ERX * 0.82, ERZ * 0.86, 255)
        im.paste(iris, (0, 0), Image.composite(iris, Image.new('RGBA', im.size, (0, 0, 0, 0)), mask).getchannel('A'))
        d = ImageDraw.Draw(im)
        ell(d, x, EY + ERZ * 0.08, ERX * 0.5, ERZ * 0.52, (20, 10, 6, 255))                    # pupil
        ell(d, x + ERX * 0.3, EY + ERZ * 0.38, ERX * 0.32, ERZ * 0.29, (255, 255, 255, 255))   # big catch-light (light from the top right)
        ell(d, x - ERX * 0.32, EY - ERZ * 0.38, ERX * 0.13, ERZ * 0.11, (255, 255, 255, 235))           # small lower catch-light
        # upper lash line: a thicker arc that flicks out at the corner
        cx, cy = px(x, EY); rx, rz = ERX * k * 1.08, ERZ * k * 1.06
        d.arc([cx - rx, cy - rz, cx + rx, cy + rz], 200, 340, fill=ink, width=int(0.016 * k))
        ox = cx + sx * rx * 0.93; oy = cy - rz * 0.42
        d.line([(ox, oy), (ox + sx * 0.024 * k, oy - 0.014 * k)], fill=ink, width=int(0.009 * k))
        d.line([(ox - sx * 0.008 * k, oy - 0.018 * k), (ox + sx * 0.012 * k, oy - 0.034 * k)], fill=ink, width=int(0.008 * k))
    # brows: small, soft, high
    for sx in (-1, 1):
        cx, cy = px(sx * 0.165, 1.685); r = 0.052 * k
        d.arc([cx - r, cy - r * 0.4, cx + r, cy + r * 0.7], 210, 330, fill=(104, 62, 38, 255), width=int(0.02 * k))
    # nose: a tiny warm button with a highlight
    im.alpha_composite(soft_layer(im.size, lambda dd: ell(dd, 0, 1.49, 0.022, 0.016, (236, 130, 110, 210)), 4, (236, 130, 110)))
    d = ImageDraw.Draw(im)
    ell(d, -0.006, 1.497, 0.006, 0.005, (255, 236, 222, 230))
    # mouth
    cx, cy = px(0, 1.425)
    if expr in ('happy', 'excited', 'surprised', 'curious'):
        w, h = 0.045 * k, 0.04 * k if expr != 'happy' else 0.032 * k
        if expr in ('surprised', 'curious'):
            ell(d, 0, 1.418, 0.022, 0.026, (120, 48, 44, 255))
        else:
            d.chord([cx - w, cy - h * 0.6, cx + w, cy + h * 1.2], 0, 180, fill=(134, 52, 46, 255))
            d.chord([cx - w * 0.6, cy + h * 0.25, cx + w * 0.6, cy + h * 1.15], 0, 180, fill=(238, 120, 112, 255))
    elif expr == 'sad':
        d.arc([cx - 0.03 * k, cy, cx + 0.03 * k, cy + 0.035 * k], 200, 340, fill=(110, 52, 44, 255), width=int(0.008 * k))
    else:
        d.arc([cx - 0.048 * k, cy - 0.04 * k, cx + 0.048 * k, cy + 0.014 * k], 30, 150, fill=(168, 64, 52, 255), width=int(0.011 * k))
    return im.resize((S, S), Image.LANCZOS)

if __name__ == '__main__':
    out = sys.argv[1]; expr = sys.argv[2] if len(sys.argv) > 2 else 'normal'
    paint(expr).convert('RGB').save(out)
