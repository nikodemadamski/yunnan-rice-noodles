# Blender PNGs -> game WebP sprites: AgX's colour back up a touch (food should
# look appetising, not documentary), trimmed shadow haze, WebP with alpha.
#   python pack.py <in_dir> <out_dir>
import sys, os, glob
from PIL import Image, ImageEnhance

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
for f in sorted(glob.glob(os.path.join(src, '*.png'))):
    im = Image.open(f).convert('RGBA')
    rgb, a = im.convert('RGB'), im.getchannel('A')
    rgb = ImageEnhance.Color(rgb).enhance(1.25)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.06)
    a = a.point(lambda v: 0 if v < 6 else v)          # the shadow catcher's faint haze at the edges
    out = Image.merge('RGBA', (*rgb.split(), a))
    out.save(os.path.join(dst, os.path.basename(f)[:-4] + '.webp'), 'WEBP', quality=86, method=6)
    print(os.path.basename(f), os.path.getsize(os.path.join(dst, os.path.basename(f)[:-4] + '.webp')) // 1024, 'KB')
