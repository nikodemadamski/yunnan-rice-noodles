# Renders the ingredients of 过桥米线 as sprites for the drawn kitchen.
# Real geometry, real materials (subsurface meat, wet noodles, glazed
# porcelain), lit like food photography from the top left, top-down
# orthographic, transparent with a soft contact shadow. 1 unit = 1 mm, the
# sprite box is 124 mm (food.js SIZE), rendered at 3 px per unit.
#
#   python food.py <outdir> [kind ...]        (python with the `bpy` module)
#
# Output: <outdir>/<kind>_<state>_<variant>.png, state 0 raw · 1 cooked · shell.

import bpy, bmesh, math, random, sys, os
from mathutils import Vector, noise

MM = 0.001
BOX = 124
PX = 3 * BOX

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.device = 'CPU'
    s.cycles.samples = 64
    s.cycles.use_denoising = True
    s.cycles.max_bounces = 8
    s.render.resolution_x = s.render.resolution_y = PX
    s.render.film_transparent = True
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'RGBA'
    # AgX keeps whites (noodles, egg, porcelain) from clipping; colour is lifted
    # back after (tools/blender/pack.py) so the food stays appetising
    s.view_settings.view_transform = 'AgX'
    s.view_settings.look = 'AgX - Punchy'
    s.view_settings.exposure = -1.2
    w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = (1.0, 0.86, 0.72, 1); bg.inputs[1].default_value = 0.4
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = BOX * MM
    co = bpy.data.objects.new('cam', cam); s.collection.objects.link(co); s.camera = co
    co.location = (0, 0, 0.3)
    # key: big soft window light, top left, warm
    key = light('AREA', (-0.18, 0.2, 0.22), 11.0, 0.12, (1.0, 0.93, 0.82))
    fill = light('AREA', (0.2, -0.12, 0.18), 0.9, 0.25, (0.85, 0.9, 1.0))
    rim = light('AREA', (0.05, 0.25, 0.05), 2.2, 0.08, (1.0, 0.9, 0.75))
    # shadow catcher under the food
    bpy.ops.mesh.primitive_plane_add(size=0.5, location=(0, 0, 0))
    bpy.context.object.is_shadow_catcher = True
    return s

def light(kind, loc, energy, size, col):
    d = bpy.data.lights.new('l', kind); d.energy = energy; d.color = col
    if kind == 'AREA': d.size = size
    o = bpy.data.objects.new('l', d); bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o

# ------------------------------------------------------------ materials
def mat(name, base, rough=0.4, sss=0.0, sss_rad=(1, 0.4, 0.2), sss_scale=2.0, coat=0.0, trans=0.0,
        spec=0.5, vc=None, noise_mix=None, sheen=0.0, stretch=(0.3, 1.4, 1)):
    """Principled material. vc=(colA, colB): blend by the 'k' color attribute.
    noise_mix=(col, scale, lo, hi): streaks of col through a noise texture."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; p = nt.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*srgb(base), 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Subsurface Weight'].default_value = sss
    p.inputs['Subsurface Radius'].default_value = sss_rad
    p.inputs['Subsurface Scale'].default_value = sss_scale * MM
    p.inputs['Coat Weight'].default_value = coat
    p.inputs['Coat Roughness'].default_value = 0.08
    p.inputs['Transmission Weight'].default_value = trans
    p.inputs['Specular IOR Level'].default_value = spec
    p.inputs['Sheen Weight'].default_value = sheen
    col_out = None
    if vc:
        a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'k'
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'
        mx.inputs[6].default_value = (*srgb(vc[0]), 1); mx.inputs[7].default_value = (*srgb(vc[1]), 1)
        nt.links.new(a.outputs['Color'], mx.inputs[0])
        col_out = mx.outputs[2]
    if noise_mix:
        c, sc, lo, hi = noise_mix
        tc = nt.nodes.new('ShaderNodeTexCoord')
        nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = sc
        nz.inputs['Detail'].default_value = 6; nz.inputs['Distortion'].default_value = 0.6
        # stretch the noise along x: marbling runs with the grain
        mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = tuple(v * 25 for v in stretch)   # metres → per 40 mm
        nt.links.new(tc.outputs['Object'], mp.inputs[0]); nt.links.new(mp.outputs[0], nz.inputs['Vector'])
        cr = nt.nodes.new('ShaderNodeMapRange'); cr.inputs[1].default_value = lo; cr.inputs[2].default_value = hi
        nt.links.new(nz.outputs['Fac'], cr.inputs[0])
        mx2 = nt.nodes.new('ShaderNodeMix'); mx2.data_type = 'RGBA'
        if col_out: nt.links.new(col_out, mx2.inputs[6])
        else: mx2.inputs[6].default_value = (*srgb(base), 1)
        mx2.inputs[7].default_value = (*srgb(c), 1)
        nt.links.new(cr.outputs[0], mx2.inputs[0])
        col_out = mx2.outputs[2]
    if col_out: nt.links.new(col_out, p.inputs['Base Color'])
    return m

def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

# ------------------------------------------------------------ geometry
def link(obj):
    bpy.context.scene.collection.objects.link(obj); return obj

def finish(obj, m, thick=0.0, sub=1, smooth=True):
    obj.data.materials.append(m)
    if thick:
        sm = obj.modifiers.new('s', 'SOLIDIFY'); sm.thickness = thick * MM; sm.offset = 1
    if sub:
        sd = obj.modifiers.new('d', 'SUBSURF'); sd.levels = sd.render_levels = sub
    if smooth:
        for f in obj.data.polygons: f.use_smooth = True
    return obj

def sheet(rx, ry, R, wob=0.1, curl=0.0, wave=0.0, ripple=0.0, rings=10, segs=56, k=None, z=0.0, droop=0.0):
    """An organic thin slice: polar grid, wobbly outline, curled edges.
    k(x, y) -> 0..1 written to the 'k' colour attribute (fat edge, skin…)."""
    ph = [R.random() * 6.28 for _ in range(6)]
    def outline(a):
        return 1 + wob * (0.55 * math.sin(2 * a + ph[0]) + 0.3 * math.sin(3 * a + ph[1]) + 0.15 * math.sin(5 * a + ph[2]))
    bm = bmesh.new()
    centre = bm.verts.new((0, 0, 0))
    ringsv = []
    for i in range(1, rings + 1):
        r = i / rings; row = []
        for j in range(segs):
            a = j / segs * 2 * math.pi; o = outline(a)
            x = math.cos(a) * rx * r * o; y = math.sin(a) * ry * r * o
            zz = curl * (r ** 2.2) * max(rx, ry) * 0.18 \
                + wave * math.sin(x / rx * 3.2 + ph[3]) * 2.2 \
                + ripple * noise.noise(Vector((x * 0.18, y * 0.18, ph[4]))) * 2.5 \
                - droop * (x / rx) ** 2 * 6
            row.append(bm.verts.new((x * MM, y * MM, (zz + z) * MM)))
        ringsv.append(row)
    for j in range(segs):
        bm.faces.new((centre, ringsv[0][j], ringsv[0][(j + 1) % segs]))
    for i in range(rings - 1):
        for j in range(segs):
            a, b = ringsv[i][j], ringsv[i][(j + 1) % segs]
            c, d = ringsv[i + 1][(j + 1) % segs], ringsv[i + 1][j]
            bm.faces.new((a, d, c, b))
    me = bpy.data.meshes.new('sheet'); bm.to_mesh(me); bm.free()
    if k:
        ca = me.color_attributes.new('k', 'FLOAT_COLOR', 'POINT')
        for v in me.vertices:
            t = max(0.0, min(1.0, k(v.co.x / MM, v.co.y / MM)))
            ca.data[v.index].color = (t, t, t, 1)
    return link(bpy.data.objects.new('sheet', me))

def place(o, x=0, y=0, z=0, rot=0, tilt=(0, 0)):
    o.location = (x * MM, y * MM, z * MM); o.rotation_euler = (tilt[0], tilt[1], rot); return o

def tube(points, radius, m, res=6, name='tube', taper=None):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    cu.bevel_depth = radius * MM; cu.bevel_resolution = res; cu.use_fill_caps = True
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(points) - 1)
    for bp, p in zip(sp.bezier_points, points):
        bp.co = Vector(p) * MM; bp.handle_left_type = bp.handle_right_type = 'AUTO'
        if taper: bp.radius = taper(p)
    o = link(bpy.data.objects.new(name, cu)); o.data.materials.append(m); return o

def ellipsoid(rx, ry, rz, m, loc=(0, 0, 0), rot=0, seg=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1)
    o = bpy.context.object; o.scale = (rx * MM, ry * MM, rz * MM)
    o.location = Vector(loc) * MM; o.rotation_euler = (0, 0, rot)
    o.data.materials.append(m)
    for f in o.data.polygons: f.use_smooth = True
    return o

# ------------------------------------------------------------ the ingredients
def pork(R, cook, shell):
    meat = mat('pork', '#d0505a' if not cook else '#dcc0aa', rough=0.4 if not cook else 0.55,
               sss=0.6 if not cook else 0.3, sss_rad=(1.0, 0.3, 0.25), coat=0.22 if not cook else 0.1,
               vc=(('#cf4d58', '#f9ece4') if not cook else ('#dcbfa8', '#f6ece0')),
               noise_mix=('#f3d2cc' if not cook else '#efdfcf', 4, 0.56, 0.6))
    for i in range(3):
        rx, ry = 30 + R.uniform(-2, 2), 16 + R.uniform(-1.5, 1.5)
        o = sheet(rx, ry, R, wob=0.16, curl=0.5 + cook * 1.4, wave=0.45 + cook * 0.5, ripple=0.5 + cook * 0.6,
                  k=lambda x, y, ry=ry: (y / ry - 0.68) / 0.1)
        finish(o, meat, thick=1.4)
        place(o, (i - 1) * 9, (1 - i) * 6, i * 1.8, -0.5 + i * 0.42 + R.uniform(-0.2, 0.2))

def fish(R, cook, shell):
    flesh = mat('fish', '#dcc9c4' if not cook else '#f3eee6', rough=0.3 if not cook else 0.6,
                sss=0.7 if not cook else 0.35, sss_rad=(1, 0.8, 0.7), coat=0.4 if not cook else 0.08,
                trans=0.3 if not cook else 0, vc=(('#d9c4c0', '#3f444c') if not cook else ('#f6f1e8', '#a8a29c')),
                noise_mix=('#c7aaa6' if not cook else '#d9cfc2', 6, 0.5, 0.53), stretch=(2.5, 0.2, 1))
    for i in range(3):
        rx, ry = 27 + R.uniform(-2, 2), 15 + R.uniform(-1, 1)
        o = sheet(rx, ry, R, wob=0.08, curl=0.5 + cook * 1.8, wave=0.3, ripple=0.3 + cook,
                  k=lambda x, y, ry=ry: (y / ry - 0.66) / 0.08)
        finish(o, flesh, thick=2.2)
        place(o, (i - 1) * 10, (i - 1) * 5, i * 2.2, 0.4 - i * 0.45 + R.uniform(-0.2, 0.2))

def egg(R, cook, shell):
    if shell:
        m = mat('shell', '#d9c39b', rough=0.5, spec=0.4, noise_mix=('#3b2416', 9, 0.57, 0.6), stretch=(0.04, 0.04, 0.04))   # sphere space: unit radius
        for i, (x, y) in enumerate([(0, 0)]):
            ellipsoid(16, 12.5, 11, m, (x, y, 11), R.uniform(-0.6, 0.6))
        return
    white = mat('white', '#fbf9f4' if cook else '#f1ead6', rough=0.25 if cook else 0.03,
                sss=0.8 if cook else 0.1, sss_rad=(1, 0.95, 0.85), coat=0.3 if cook else 1, trans=0 if cook else 0.92)
    yolk = mat('yolk', '#ff8a00' if not cook else '#ffa51e', rough=0.15 if not cook else 0.35, sss=0.6,
               sss_rad=(1, 0.5, 0.1), coat=0.8 if not cook else 0.3)
    o = sheet(21, 18, R, wob=0.22, ripple=1.2, curl=-0.3, rings=10)
    finish(o, white, thick=2.5 if cook else 1.2); place(o, 0, 0, 0.5, R.uniform(0, 6))
    y = ellipsoid(9.5, 9, 5.5 if cook else 6.5, yolk, (R.uniform(-3, 3), R.uniform(-3, 3), 2.5))

def ham(R, cook, shell):
    m = mat('ham', '#b52f3b', rough=0.28, sss=0.45, sss_rad=(1, 0.3, 0.25), coat=0.55,
            vc=('#a8263a', '#f6e4d6'), noise_mix=('#d9535e', 5, 0.55, 0.7))
    for i in range(3):
        rx, ry = 28 + R.uniform(-2, 2), 15 + R.uniform(-1, 1)
        o = sheet(rx, ry, R, wob=0.1, curl=0.5, wave=0.4, ripple=0.4,
                  k=lambda x, y, ry=ry: ((-y) / ry - 0.55) / 0.15)
        finish(o, m, thick=1.2)
        place(o, (i - 1) * 9, (i - 1) * -6, i * 1.6, 0.3 + i * 0.4 + R.uniform(-0.2, 0.2))

def chrys(R, cook, shell):
    m = mat('petal', '#f7c425', rough=0.45, sss=0.5, sss_rad=(1, 0.8, 0.2), sheen=0.3)
    m2 = mat('petal2', '#ffd95a', rough=0.45, sss=0.5, sss_rad=(1, 0.8, 0.2), sheen=0.3)
    for i in range(34):
        a, d = R.uniform(0, 6.283), 30 * math.sqrt(R.random())
        o = sheet(8 + R.uniform(-1, 2), 2.0 + R.uniform(0, 0.6), R, wob=0.05, curl=1.5, rings=4, segs=20)
        finish(o, m if i % 3 else m2, thick=0.5)
        place(o, math.cos(a) * d, math.sin(a) * d, R.uniform(0, 4), R.uniform(0, 6.28), (R.uniform(-0.3, 0.3), R.uniform(-0.3, 0.3)))
    # one whole little flower head on top
    for j in range(16):
        a = j / 16 * 6.283
        o = sheet(7, 2.2, R, wob=0.05, curl=-1.2, rings=4, segs=20)
        finish(o, m2, thick=0.5); place(o, math.cos(a) * 6 + 6, math.sin(a) * 6 - 4, 5, a)
    ellipsoid(3.5, 3.5, 2, mat('c', '#e39a16', rough=0.6), (6, -4, 6))

def pea(R, cook, shell):
    stem = mat('stem', '#5ea83a', rough=0.35, sss=0.5, sss_rad=(0.6, 1, 0.3), coat=0.3)
    leaf = mat('leaf', '#3f8f2a', rough=0.32, sss=0.45, sss_rad=(0.4, 1, 0.25), coat=0.35,
               vc=('#6fbf3f', '#2f7a1e'), noise_mix=('#2c6d1c', 5, 0.55, 0.7), stretch=(1, 1, 1))
    for s in range(5):
        a0 = R.uniform(-0.6, 0.6) + s * 1.25
        L = R.uniform(38, 50)
        pts = [(math.cos(a0) * (t - 0.35) * L + R.uniform(-2, 2) * t, math.sin(a0) * (t - 0.35) * L + math.sin(t * 4) * 4, 3 + t * 3) for t in (0, 0.33, 0.66, 1)]
        tube(pts, 1.3, stem)
        for t in (0.45, 0.75, 1.0):
            px, py, pz = pts[0][0] + (pts[-1][0] - pts[0][0]) * t, pts[0][1] + (pts[-1][1] - pts[0][1]) * t, 5
            for side in (-1, 1):
                o = sheet(R.uniform(8, 11) - t * 2, R.uniform(5, 7.5) - t * 1.5, R, wob=0.15, curl=0.9, wave=0.3, rings=5, segs=24,
                          k=lambda x, y: 0.4 + y / 12)
                finish(o, leaf, thick=0.6)
                place(o, px + math.cos(a0 + side * 1.2) * 6, py + math.sin(a0 + side * 1.2) * 6, pz + R.uniform(0, 2), a0 + side * 0.9)
        # a curly tendril
        cx, cy = pts[-1][0], pts[-1][1]
        tube([(cx + math.cos(u) * (6 - u * 0.6), cy + math.sin(u) * (6 - u * 0.6), 7) for u in (0, 1.5, 3, 4.5, 6, 7.5)], 0.45, stem, res=3)

def chives(R, cook, shell):
    m = mat('chive', '#3f9a32', rough=0.3, sss=0.5, sss_rad=(0.4, 1, 0.3), coat=0.45, vc=('#6cc04a', '#2a7322'))
    for i in range(13):
        a = 0.35 + R.uniform(-0.12, 0.12); L = R.uniform(34, 44)
        cx, cy = R.uniform(-8, 8), R.uniform(-14, 14)
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=1, depth=1)
        o = bpy.context.object; o.scale = (3.4 * MM, 1.2 * MM, L * MM)
        o.rotation_euler = (0, math.pi / 2, a); o.location = (cx * MM, cy * MM, (2 + i * 0.6) * MM)
        ca = o.data.color_attributes.new('k', 'FLOAT_COLOR', 'POINT')
        for v in o.data.vertices:
            t = 0.5 + v.co.y * 0.5; ca.data[v.index].color = (t, t, t, 1)
        o.data.materials.append(m)
        sd = o.modifiers.new('d', 'SUBSURF'); sd.levels = sd.render_levels = 1
        for f in o.data.polygons: f.use_smooth = True

def tofu(R, cook, shell):
    m = mat('tofu', '#efd496', rough=0.4, sss=0.7, sss_rad=(1, 0.8, 0.4), coat=0.3,
            noise_mix=('#ddb873', 8, 0.5, 0.62), stretch=(0.4, 2, 1))
    for i in range(3):
        o = sheet(36, 10 + R.uniform(-1, 1), R, wob=0.05, ripple=0.7, wave=1.4, curl=0.8, rings=8, segs=64)
        finish(o, m, thick=0.9)
        place(o, R.uniform(-4, 4), (i - 1) * 13 + R.uniform(-2, 2), i * 2, R.uniform(-0.35, 0.35))

def jizong(R, cook, shell):
    m = mat('jz', '#eadcc2', rough=0.42, sss=0.35, sss_rad=(1, 0.85, 0.6), coat=0.3,
            vc=('#eadcc2', '#6b4a2e'), noise_mix=('#c9b08a', 10, 0.5, 0.56), stretch=(0.08, 4, 1))
    cap = mat('cap', '#7b5f48', rough=0.5, sss=0.2, sss_rad=(1, 0.8, 0.6), noise_mix=('#4f3a2a', 0.5, 0.45, 0.7), stretch=(0.04, 0.04, 0.04))
    for i in range(3):
        o = sheet(32, 7.5, R, wob=0.12, ripple=0.4, curl=0.4, rings=8, segs=56,
                  k=lambda x, y: (x / 32 - 0.55) / 0.2 + abs(y) / 30)
        finish(o, m, thick=2.5)
        a = (i - 1) * 0.25 + R.uniform(-0.15, 0.15); x0, y0 = R.uniform(-3, 3), (i - 1) * 12
        place(o, x0, y0, i * 2.5, a)
        # the little grey-brown cap at the top of the stem, split with it
        ellipsoid(7, 8.5, 3.2, cap, (x0 + math.cos(a) * 29, y0 + math.sin(a) * 29, i * 2.5 + 2), a)

def chilli(R, cook, shell):
    oil = mat('oil', '#c8311b', rough=0.04, trans=0.55, coat=1.0, spec=0.7, sss=0.2, sss_rad=(1, 0.2, 0.1))
    o = sheet(30, 26, R, wob=0.18, rings=8)
    finish(o, oil, thick=1.6); place(o, 0, 0, 0)
    flake = mat('flake', '#7d1208', rough=0.5, sss=0.3, sss_rad=(1, 0.2, 0.1))
    seed = mat('seed', '#f3e2bd', rough=0.5)
    for i in range(46):
        a, d = R.uniform(0, 6.283), 24 * math.sqrt(R.random())
        s = sheet(R.uniform(1.4, 3.2), R.uniform(1, 2.2), R, wob=0.3, rings=2, segs=8)
        finish(s, flake, thick=0.4, sub=0); place(s, math.cos(a) * d, math.sin(a) * d, 1.7, R.uniform(0, 6))
    for i in range(16):
        a, d = R.uniform(0, 6.283), 22 * math.sqrt(R.random())
        ellipsoid(1.6, 0.9, 0.6, seed, (math.cos(a) * d, math.sin(a) * d, 1.9), R.uniform(0, 6), seg=12)

def noodles(R, cook, shell):
    m = mat('noodle', '#efe6d2', rough=0.2, sss=0.85, sss_rad=(1, 0.9, 0.7), sss_scale=4, coat=0.6,
            noise_mix=('#fbf7ee', 3, 0.5, 0.8))
    # a nest of long round rice noodles, wound loosely (like a portion lifted from the pot)
    for s in range(26):
        a = R.uniform(0, 6.283); turns = R.uniform(0.5, 1.1)
        zb = s * 0.5; pts = []
        n = 12; ph = R.uniform(0, 6)
        for i in range(n):
            t = i / (n - 1); ang = a + t * turns * 6.283
            r = 20 + 15 * math.sin(t * R.uniform(3, 7) + ph) + R.uniform(-3, 3)
            r = max(0, min(36, r))
            pts.append((math.cos(ang) * r * 1.05 + R.uniform(-2, 2), math.sin(ang) * r * 0.95 + R.uniform(-2, 2), zb + 2 + math.sin(t * 9 + s) * 1.5))
        tube(pts, 1.25, m, res=4)

KINDS = dict(pork=pork, fish=fish, egg=egg, ham=ham, chrys=chrys, pea=pea, chives=chives, tofu=tofu,
             jizong=jizong, chilli=chilli, noodles=noodles)
STATES = dict(pork=[0, 1], fish=[0, 1], egg=['shell', 0, 1])

def render(kind, state, variant, out):
    reset()
    R = random.Random(variant * 31 + len(kind) * 7)
    shell = state == 'shell'
    KINDS[kind](R, 0 if shell else state, shell)
    s = bpy.context.scene
    s.render.filepath = os.path.join(out, f'{kind}_{state}_{variant}.png')
    bpy.ops.render.render(write_still=True)

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out = argv[0]; kinds = argv[1:] or list(KINDS)
    os.makedirs(out, exist_ok=True)
    variants = int(os.environ.get('VARIANTS', 3))
    for k in kinds:
        for st in STATES.get(k, [1]):
            for v in range(variants):
                render(k, st, v, out)
                print('rendered', k, st, v, flush=True)
