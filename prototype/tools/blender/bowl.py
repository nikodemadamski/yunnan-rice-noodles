# The big 过桥 bowl and the little saucers, as porcelain renders for the drawn
# kitchen. Top-down orthographic like food.py. The bowl image is 2.5 R wide
# (R = the rim radius) so the soft shadow fits; the broth is still drawn live
# by food.js inside the inner opening (0.84 R).
#
#   python bowl.py <outdir>
# Output: bowl_<glaze>.png (blue, celadon, red), dish.png.

import bpy, bmesh, math, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from food import reset, mat, srgb, link

def lathe(profile, segs=128):
    """profile: [(r, z)] from the outer foot, over the rim, down the inside."""
    bm = bmesh.new(); rings = []
    for r, z in profile:
        rings.append([bm.verts.new((math.cos(j / segs * 2 * math.pi) * r, math.sin(j / segs * 2 * math.pi) * r, z)) for j in range(segs)])
    for a, b in zip(rings, rings[1:]):
        for j in range(segs):
            bm.faces.new((a[j], a[(j + 1) % segs], b[(j + 1) % segs], b[j]))
    bm.faces.new(rings[-1][::-1])
    me = bpy.data.meshes.new('lathe'); bm.to_mesh(me); bm.free()
    o = link(bpy.data.objects.new('lathe', me))
    for f in me.polygons: f.use_smooth = True
    sd = o.modifiers.new('d', 'SUBSURF'); sd.levels = sd.render_levels = 2
    return o

def porcelain(name, glaze, band, pattern=True):
    """Glazed porcelain; a band of qinghua scrolls between two rings near the rim (radius in R units)."""
    m = mat(name, glaze, rough=0.12, coat=1.0, sss=0.25, sss_rad=(1, 0.95, 0.9), spec=0.6)
    if not band: return m
    nt = m.node_tree; p = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    def op(kind, a, b=None, v=None):
        n = nt.nodes.new('ShaderNodeMath'); n.operation = kind
        for i, x in enumerate((a, b)):
            if x is None: continue
            if isinstance(x, (int, float)): n.inputs[i].default_value = x
            else: nt.links.new(x, n.inputs[i])
        return n.outputs[0]
    r = op('SQRT', op('ADD', op('MULTIPLY', sep.outputs[0], sep.outputs[0]), op('MULTIPLY', sep.outputs[1], sep.outputs[1])))
    ang = op('ARCTAN2', sep.outputs[1], sep.outputs[0])
    def ring(c, w, edge=0.003):    # 1 inside |r - c| < w, a hairline soft edge 
        return op('MAXIMUM', 0.0, op('SUBTRACT', 1.0, op('MULTIPLY', op('MAXIMUM', 0.0, op('SUBTRACT', op('ABSOLUTE', op('SUBTRACT', r, c)), w)), 1 / edge)))
    rings = op('MAXIMUM', ring(0.972, 0.006), ring(0.858, 0.005))
    if pattern:
        # a solid qinghua band with white scrolls running round it
        band_k = ring(0.912, 0.032)
        wave = op('SINE', op('ADD', op('MULTIPLY', ang, 24.0), op('MULTIPLY', op('SINE', op('MULTIPLY', ang, 12.0)), 1.6)))
        rr = op('ADD', 0.912, op('MULTIPLY', wave, 0.017))
        scroll = ring(rr, 0.004, 0.003)
        k = op('MAXIMUM', rings, op('SUBTRACT', band_k, scroll))
    else:
        k = rings
    k = op('MINIMUM', 1.0, op('MAXIMUM', 0.0, k))
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'
    mx.inputs[6].default_value = (*srgb(glaze), 1); mx.inputs[7].default_value = (*srgb(band), 1)
    nt.links.new(k, mx.inputs[0]); nt.links.new(mx.outputs[2], p.inputs['Base Color'])
    return m

def relight(s):
    """food.py's lights scaled up to a 2.5 m box, the key raised so the shadow stays short."""
    s.view_settings.exposure = -2.1
    s.cycles.samples = 64
    for o in s.objects:
        if o.type == 'LIGHT':
            k = 2.5 / 0.124; o.location = o.location * k; o.data.energy *= k * k
            if o.data.type == 'AREA': o.data.size *= k
            if o.data.energy > 3000: o.location.z *= 2.2; o.data.energy *= 3   # the key
        if o.type == 'MESH': o.scale = (12, 12, 1)
        if o.type == 'LIGHT': o.rotation_euler = (-o.location).to_track_quat('-Z', 'Y').to_euler()
    if os.environ.get('QUICK'):
        s.cycles.samples = 16
        for o in s.objects:
            if o.type == 'LIGHT': print('light', tuple(round(v, 2) for v in o.location), round(o.data.energy), round(o.data.size, 2))

def bowl(out, name, glaze, band, pattern=True):
    s = reset()
    R = 1.0
    cam = s.camera; cam.data.ortho_scale = 2.5 * R; cam.location = (0, 0, 3)
    # lights scaled from food.py's 124 mm box to this 2.5 m box (keep the same look)
    relight(s)
    # a deep noodle bowl with a rolled lip; the inside falls to a small well
    prof = [(0.42, 0.0), (0.46, 0.03), (0.62, 0.12), (0.82, 0.3), (0.95, 0.5), (1.0, 0.58), (0.995, 0.615),
            (0.975, 0.63), (0.95, 0.625), (0.93, 0.6), (0.88, 0.55), (0.84, 0.52), (0.72, 0.36), (0.55, 0.2), (0.38, 0.1), (0.0, 0.085)]
    o = lathe(prof); o.data.materials.append(porcelain('glaze', glaze, band, pattern))
    s.render.resolution_x = s.render.resolution_y = 200 if os.environ.get('QUICK') else 800
    s.render.filepath = os.path.join(out, f'bowl_{name}.png'); bpy.ops.render.render(write_still=True)

def dish(out):
    s = reset()
    cam = s.camera; cam.data.ortho_scale = 2.5; cam.location = (0, 0, 3)
    relight(s)
    prof = [(0.55, 0.0), (0.6, 0.04), (0.9, 0.1), (1.0, 0.16), (0.99, 0.19), (0.95, 0.19), (0.84, 0.13), (0.6, 0.08), (0.0, 0.07)]
    o = lathe(prof); o.data.materials.append(porcelain('dish', '#f7f3ea', '#3a6ea5', pattern=False))
    s.render.resolution_x = s.render.resolution_y = 500
    s.render.filepath = os.path.join(out, 'dish.png'); bpy.ops.render.render(write_still=True)

def broth(out, sealed):
    """The broth seen from above, filling the whole frame (code clips it to the
    level it has reached): clear golden hen broth, or sealed under the oil."""
    import random
    from food import ellipsoid
    s = reset()
    cam = s.camera; cam.data.ortho_scale = 2.0; cam.location = (0, 0, 3)
    relight(s)
    for o in list(s.objects):
        if o.type == 'MESH': bpy.data.objects.remove(o)          # no shadow catcher: the broth fills the frame
    bpy.ops.mesh.primitive_circle_add(vertices=128, radius=1.05, fill_type='NGON')
    disc = bpy.context.object
    m = mat('broth', '#f2bb4e', rough=0.04, coat=1.0, sss=0.6, sss_rad=(1, 0.6, 0.2), sss_scale=200, spec=0.6)
    # a faint, slow swell in the surface so the light isn't a flat mirror
    nt = m.node_tree; p = nt.nodes['Principled BSDF']
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 2.5
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.08
    nt.links.new(nz.outputs['Fac'], bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], p.inputs['Normal'])
    disc.data.materials.append(m)
    fat = mat('fat', '#ffd04a', rough=0.01, trans=0.9, coat=1.0, spec=0.8)
    R = random.Random(7)
    if not sealed:
        # even clear hen broth carries a few small eyes of fat
        for i in range(70):
            r = 0.008 + (R.random() ** 3) * 0.03
            a, d = R.uniform(0, 6.283), 1.02 * R.random() ** 0.5
            ellipsoid(r * 1000, r * 1000 * R.uniform(0.85, 1), r * 280, fat, (math.cos(a) * d * 1000, math.sin(a) * d * 1000, 8), R.uniform(0, 6), seg=16)
    if sealed:
        # the chicken-oil seal: a golden film, then lens-shaped beads of fat, big and small
        film = mat('film', '#ffd864', rough=0.02, trans=0.85, coat=1.0, spec=0.7)
        bpy.ops.mesh.primitive_circle_add(vertices=128, radius=1.05, fill_type='NGON', location=(0, 0, 0.004))
        f = bpy.context.object; f.data.materials.append(film)
        for i in range(260):
            r = 0.012 + (R.random() ** 3) * 0.09
            a, d = R.uniform(0, 6.283), 1.02 * R.random() ** 0.5
            o = ellipsoid(r * 1000, r * 1000 * R.uniform(0.85, 1), r * 1000 * 0.28, fat, (math.cos(a) * d * 1000, math.sin(a) * d * 1000, 8), R.uniform(0, 6), seg=20)
    s.render.resolution_x = s.render.resolution_y = 160 if os.environ.get('QUICK') else 640
    s.render.film_transparent = False
    s.render.filepath = os.path.join(out, f'broth_{"sealed" if sealed else "clear"}.png'); bpy.ops.render.render(write_still=True)

if __name__ == '__main__':
    out = sys.argv[-1]; os.makedirs(out, exist_ok=True)
    if os.environ.get('ONLY') == 'broth':
        broth(out, False); broth(out, True); sys.exit()
    broth(out, False); broth(out, True)
    bowl(out, 'blue', '#f8f4ec', '#1f4c99')
    if os.environ.get('QUICK'): sys.exit()
    bowl(out, 'celadon', '#a9cdb9', '#6f9e88', pattern=False)
    bowl(out, 'red', '#f8f4ec', '#b3261e')
    dish(out)
