# Paints the heroine's face texture (skin + features) for the head's front
# planar UV (girl.py): u = 0.5 + x / (2 * FACE_W), v = (z - FACE_Z0) / FACE_H.
# Layout measured off design/ref_hero-girl-v2.png: large warm brown eyes set
# low and wide with white showing at the corners, a heavy upper lid with
# lash flicks, thin arched brows, a tiny nose, a small gentle smile, blush.
#
#   python face_paint.py <out.png> [expression]

import sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops

S = 1024                     # texture size
SS = 2                       # supersampling
FACE_W, FACE_Z0, FACE_H = 0.5, 1.26, 1.0

# feature layout, in head coordinates (x across, z up); the head centre is z 1.76
EYE_Z, EYE_X, EYE_RX, EYE_RZ = 1.6, 0.172, 0.08, 0.086
BROW_Z, NOSE_Z, MOUTH_Z, BLUSH_Z, BLUSH_X = 1.705, 1.528, 1.468, 1.508, 0.228
SKIN = (238, 166, 124)          # warm peach
SKIN_SHADE = (222, 138, 104)
INK = (46, 26, 18, 255)

def px(x, z):
    """head coordinates (x, z) -> pixel (supersampled)"""
    u = 0.5 + x / (2 * FACE_W); v = (z - FACE_Z0) / FACE_H
    return u * S * SS, (1 - v) * S * SS

def ell(d, x, z, rx, rz, fill):
    cx, cy = px(x, z); k = S * SS / (2 * FACE_W)
    d.ellipse([cx - rx * k, cy - rz * k, cx + rx * k, cy + rz * k], fill=fill)

def soft(im, draw_fn, blur, col):
    """a blurred layer; it starts from its own colour at zero alpha so the blur adds no dark fringe"""
    lay = Image.new('RGBA', im.size, col[:3] + (0,)); draw_fn(ImageDraw.Draw(lay))
    im.alpha_composite(lay.filter(ImageFilter.GaussianBlur(blur)))

def eye(im, x, sx, k, expr):
    d = ImageDraw.Draw(im)
    if expr in ('happy', 'excited'):
        cx, cy = px(x, EYE_Z); r = EYE_RX * k
        d.arc([cx - r, cy - r * 0.6, cx + r, cy + r * 1.1], 200, 340, fill=INK, width=int(0.016 * k))
        return
    # the white of the eye, only just showing at the corners
    ell(d, x, EYE_Z, EYE_RX, EYE_RZ, (252, 248, 242, 255))
    # iris: deep brown at the top, warm amber toward the bottom, filling most of the eye
    IR = EYE_RZ * 0.95
    iris = Image.new('RGBA', im.size, (0, 0, 0, 0)); di = ImageDraw.Draw(iris)
    for i in range(28):
        t = i / 27
        col = tuple(int(a + (b - a) * t) for a, b in zip((44, 22, 12), (150, 88, 44))) + (255,)
        ell(di, x + sx * EYE_RX * 0.08, EYE_Z + IR * 0.5 - t * IR * 1.25, EYE_RX * 1.1, IR * 0.42, col)
    ix = x + sx * EYE_RX * 0.08                                # nudged outward: a sliver of white at the inner corner
    IW = EYE_RX * 0.96                                         # the iris spans nearly the whole eye
    mask = Image.new('L', im.size, 0); ell(ImageDraw.Draw(mask), ix, EYE_Z - EYE_RZ * 0.02, IW, IR * 1.0, 255)
    eye_mask = Image.new('L', im.size, 0); ell(ImageDraw.Draw(eye_mask), x, EYE_Z, EYE_RX, EYE_RZ, 255)
    im.paste(iris, (0, 0), ImageChops.multiply(ImageChops.multiply(mask, iris.getchannel('A')), eye_mask))
    d = ImageDraw.Draw(im)
    ell(d, ix, EYE_Z + EYE_RZ * 0.03, IW * 0.5, IR * 0.52, (18, 9, 6, 255))                     # pupil
    cx, cy = px(ix, EYE_Z - EYE_RZ * 0.02)                                                   # a fine dark ring round the iris
    d.ellipse([cx - IW * k, cy - IR * k, cx + IW * k, cy + IR * k], outline=(40, 20, 12, 255), width=int(0.004 * k))
    # highlights: a big one up and to the right, a little one below left (the same light for both eyes)
    ell(d, ix + IR * 0.34, EYE_Z + IR * 0.4, IR * 0.3, IR * 0.28, (255, 255, 255, 255))
    ell(d, ix - IR * 0.36, EYE_Z - IR * 0.44, IR * 0.12, IR * 0.11, (255, 255, 255, 230))
    # the upper lid: a heavy dark line along the top, thickest outward, ending in two lash flicks
    cx, cy = px(x, EYE_Z); rx, rz = EYE_RX * k * 1.04, EYE_RZ * k * 1.03
    for w, a0, a1 in ((0.014, 196, 344), (0.02, 205 if sx > 0 else 250, 290 if sx > 0 else 335)):
        d.arc([cx - rx, cy - rz, cx + rx, cy + rz], a0, a1, fill=INK, width=int(w * k))
    ox = cx + sx * rx * 0.95; oy = cy - rz * 0.3
    for j, (lx, ly) in enumerate(((0.026, -0.008), (0.02, -0.024))):
        d.line([(ox - sx * 0.006 * k * j, oy - 0.012 * k * j), (ox + sx * lx * k, oy + ly * k)], fill=INK, width=int(0.008 * k))
    # a soft lower lash line, barely there
    d.arc([cx - rx * 0.9, cy - rz, cx + rx * 0.9, cy + rz], 40, 140, fill=(120, 72, 52, 120), width=int(0.004 * k))

def paint(expr='normal'):
    W = S * SS
    im = Image.new('RGBA', (W, W), SKIN + (255,))
    k = W / (2 * FACE_W)
    # warm shading toward the jaw (reads as volume)
    soft(im, lambda d: ell(d, 0, 1.36, 0.3, 0.08, SKIN_SHADE + (110,)), 50, SKIN_SHADE)
    for sx in (-1, 1):                                           # blush
        soft(im, lambda d: ell(d, sx * BLUSH_X, BLUSH_Z, 0.095, 0.06, (240, 118, 98, 210)), 30, (240, 118, 98))
    for sx in (-1, 1):
        eye(im, sx * EYE_X, sx, k, expr)
    d = ImageDraw.Draw(im)
    # brows: thin, warm brown, gently arched
    for sx in (-1, 1):
        cx, cy = px(sx * 0.17, BROW_Z); r = 0.056 * k
        d.arc([cx - r, cy - r * 0.42, cx + r, cy + r * 0.62], 205, 335, fill=(96, 56, 34, 255), width=int(0.016 * k))
    # the nose is modelled; a whisper of warmth under it
    soft(im, lambda dd: ell(dd, 0, NOSE_Z - 0.008, 0.02, 0.012, (226, 140, 118, 140)), 5, (226, 140, 118))
    d = ImageDraw.Draw(im)
    cx, cy = px(0, MOUTH_Z)
    if expr in ('happy', 'excited', 'surprised', 'curious'):
        w, h = 0.04 * k, (0.036 if expr != 'happy' else 0.03) * k
        if expr in ('surprised', 'curious'):
            ell(d, 0, MOUTH_Z - 0.006, 0.02, 0.024, (128, 50, 44, 255))
        else:
            d.chord([cx - w, cy - h * 0.6, cx + w, cy + h * 1.2], 0, 180, fill=(140, 54, 46, 255))
            d.chord([cx - w * 0.6, cy + h * 0.25, cx + w * 0.6, cy + h * 1.15], 0, 180, fill=(236, 120, 110, 255))
    elif expr == 'sad':
        d.arc([cx - 0.03 * k, cy, cx + 0.03 * k, cy + 0.035 * k], 200, 340, fill=(116, 54, 46, 255), width=int(0.008 * k))
    else:
        # a small, gentle smile with soft upturned corners
        d.arc([cx - 0.052 * k, cy - 0.04 * k, cx + 0.052 * k, cy + 0.012 * k], 30, 150, fill=(150, 60, 50, 255), width=int(0.01 * k))
    return im.resize((S, S), Image.LANCZOS)

def gloss_mask():
    """white where the face should be glossy (the eyes), black elsewhere"""
    W = S * SS; im = Image.new('L', (W, W), 0); d = ImageDraw.Draw(im)
    for sx in (-1, 1):
        cx, cy = px(sx * EYE_X, EYE_Z); k = W / (2 * FACE_W)
        d.ellipse([cx - EYE_RX * k, cy - EYE_RZ * k, cx + EYE_RX * k, cy + EYE_RZ * k], fill=255)
    return im.filter(ImageFilter.GaussianBlur(3)).resize((S // 2, S // 2), Image.LANCZOS)

if __name__ == '__main__':
    out = sys.argv[1]; expr = sys.argv[2] if len(sys.argv) > 2 else 'normal'
    paint(expr).convert('RGB').save(out)
