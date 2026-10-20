# The heroine: the anchor of the game's look (design/ref_hero-girl-v2.png).
# One skinned character on a real skeleton, so knees, elbows, spine and the
# bun bend and bounce instead of hinging like toy blocks.
#
#   python girl.py render <outdir> [pose]    Cycles turnaround (pose: idle | tpose | walk)
#   python girl.py export <file.glb>         skinned GLB with T-pose, Idle and Walk
#
# Units: 1 = the game's character unit; she is 2.4 tall to the top of the bun.
# Modelled facing -Y (glTF +Z), Z up. Her left is +X. Proportions are measured
# off the concept's front and side views (see PROPORTIONS below).

import bpy, bmesh, math, random, sys, os
from mathutils import Vector, Quaternion, Matrix
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(__file__))
from food import srgb
import face_paint

# ---------------------------------------------------------------- proportions
# (concept front view, 2.4 tall: bun top 2.40, chin 1.38, collar 1.31, shoulders
# 1.26, sweater hem 0.72, cuffs 0.20-0.36, shoes 0-0.20; face 0.68 wide)
HEAD = Vector((0, 0.01, 1.76))           # skull centre
HRX, HRY, HRZ = 0.36, 0.355, 0.38        # skull radii
TORSO = [(0.74, 0.245, 0.19), (0.8, 0.258, 0.198), (0.92, 0.266, 0.202), (1.05, 0.258, 0.196),
         (1.13, 0.238, 0.186), (1.2, 0.2, 0.165), (1.26, 0.155, 0.132), (1.3, 0.115, 0.1)]   # sweater (z, rx, ry)
BUN = HEAD + Vector((0, 0.21, 0.44))     # the updo sits on the back of the crown, clear of the hair
R = random.Random(7)

# ---------------------------------------------------------------- materials
def principled(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    return m, m.node_tree, m.node_tree.nodes['Principled BSDF']

def material(name, hexcol, rough=0.6, sss=0.0, sheen=0.0, coat=0.0, image=None):
    m = bpy.data.materials.get(name)
    if m: return m
    m, nt, p = principled(name)
    p.inputs['Base Color'].default_value = (*srgb(hexcol), 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Subsurface Weight'].default_value = sss
    p.inputs['Subsurface Radius'].default_value = (1, 0.42, 0.25)
    p.inputs['Subsurface Scale'].default_value = 0.05
    p.inputs['Sheen Weight'].default_value = sheen
    p.inputs['Coat Weight'].default_value = coat
    if image:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(image)
        nt.links.new(t.outputs['Color'], p.inputs['Base Color'])
    return m

def textured(name, hexcol, rough, bands=None, noise=None, sheen=0.0, sss=0.0, var=0.0, coat=0.0):
    """A material with surface direction: bands=(scale, strength, distortion) runs stripes along
    the sweep's length (UV u = around), noise=(scale, strength) adds a fine grain. var lifts
    the colour a little where the bands are raised, so strands and ribs catch the light."""
    m, nt, p = principled(name)
    base = srgb(hexcol)
    p.inputs['Base Color'].default_value = (*base, 1)        # what glTF keeps when the procedural colour is dropped
    p.inputs['Roughness'].default_value = rough
    p.inputs['Sheen Weight'].default_value = sheen
    p.inputs['Subsurface Weight'].default_value = sss
    p.inputs['Subsurface Radius'].default_value = (1, 0.5, 0.3)
    p.inputs['Subsurface Scale'].default_value = 0.03
    p.inputs['Coat Weight'].default_value = coat
    L = nt.links
    uv = nt.nodes.new('ShaderNodeTexCoord')
    height = None
    if bands:
        sc, st, dist = bands
        w = nt.nodes.new('ShaderNodeTexWave'); w.wave_type = 'BANDS'; w.bands_direction = 'X'
        w.inputs['Scale'].default_value = sc; w.inputs['Distortion'].default_value = dist
        w.inputs['Detail'].default_value = 3; w.inputs['Detail Scale'].default_value = 1.5
        L.new(uv.outputs['UV'], w.inputs['Vector'])
        bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = st; bump.inputs['Distance'].default_value = 0.01
        L.new(w.outputs['Fac'], bump.inputs['Height']); height = bump
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
        mix.inputs[6].default_value = (*[c * (1 - var) for c in base], 1); mix.inputs[7].default_value = (*[min(1, c * (1 + var)) for c in base], 1)
        L.new(w.outputs['Fac'], mix.inputs[0]); L.new(mix.outputs[2], p.inputs['Base Color'])
    else:
        p.inputs['Base Color'].default_value = (*base, 1)
    if noise:
        sc, st = noise
        n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = sc; n.inputs['Detail'].default_value = 8
        L.new(uv.outputs['Object'], n.inputs['Vector'])
        b2 = nt.nodes.new('ShaderNodeBump'); b2.inputs['Strength'].default_value = st; b2.inputs['Distance'].default_value = 0.005
        L.new(n.outputs['Fac'], b2.inputs['Height'])
        if height: L.new(height.outputs['Normal'], b2.inputs['Normal'])
        height = b2
    if height: L.new(height.outputs['Normal'], p.inputs['Normal'])
    return m

def face_material(face_png, gloss_png):
    """skin with the painted face; the eyes get a clear coat so they look wet and catch the light"""
    m, nt, p = principled('skin_face')
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(face_png)
    g = nt.nodes.new('ShaderNodeTexImage'); g.image = bpy.data.images.load(gloss_png); g.image.colorspace_settings.name = 'Non-Color'
    nt.links.new(t.outputs['Color'], p.inputs['Base Color'])
    nt.links.new(g.outputs['Color'], p.inputs['Coat Weight'])
    p.inputs['Coat Roughness'].default_value = 0.04
    p.inputs['Roughness'].default_value = 0.5
    p.inputs['Subsurface Weight'].default_value = 0.18
    p.inputs['Subsurface Radius'].default_value = (1, 0.35, 0.2); p.inputs['Subsurface Scale'].default_value = 0.03
    return m

def glass(name):
    m, nt, p = principled(name)
    p.inputs['Base Color'].default_value = (1, 1, 1, 1); p.inputs['Roughness'].default_value = 0.02
    p.inputs['Transmission Weight'].default_value = 1.0; p.inputs['IOR'].default_value = 1.33
    p.inputs['Specular IOR Level'].default_value = 0.8
    return m

# ---------------------------------------------------------------- geometry kit
def link(o):
    bpy.context.scene.collection.objects.link(o); return o

def mesh_from(name, bm, m, sub=1):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = link(bpy.data.objects.new(name, me))
    for f in me.polygons: f.use_smooth = True
    o.data.materials.append(m)
    if sub:
        s = o.modifiers.new('sub', 'SUBSURF'); s.levels = s.render_levels = sub
    return o

def catmull(pts, n):
    """Resample a polyline into n points along a Catmull-Rom spline."""
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    segs = len(pts) - 1
    for i in range(n):
        t = i / (n - 1) * segs; k = min(int(t), segs - 1); u = t - k
        p0, p1, p2, p3 = P[k], P[k + 1], P[k + 2], P[k + 3]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
    return out

def lerp_list(vals, t):
    """vals: list of tuples sampled evenly; linear interpolation at t in 0..1"""
    x = t * (len(vals) - 1); k = min(int(x), len(vals) - 2); u = x - k
    return tuple(a + (b - a) * u for a, b in zip(vals[k], vals[k + 1]))

def sweep(name, path, radii, m, rings=24, segs=20, side=None, normal_fn=None, rib=None, caps=(True, True), sub=1, section=None):
    """A soft tube along `path` with elliptical sections and UVs (u around, v along).
    radii: (rx, ry) along the path. side: the direction rx lies along (default
    world X). normal_fn(p): the direction ry lies along (hair: the head's normal,
    so locks lie flat). rib: (count, depth) or t -> (count, depth). section:
    a -> (cos-like, sin-like) to shape the cross-section (e.g. flat-bottomed)."""
    pts = catmull([Vector(p) for p in path], rings)
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UV'); ringsv = []
    for i, c in enumerate(pts):
        t = i / (rings - 1)
        tan = (pts[min(i + 1, rings - 1)] - pts[max(i - 1, 0)]).normalized()
        if normal_fn:
            b = normal_fn(c); n = tan.cross(b).normalized(); b = n.cross(tan).normalized()
        else:
            ref = Vector(side) if side else Vector((1, 0, 0))
            if abs(ref.dot(tan)) > 0.95: ref = Vector((0, 1, 0))
            n = (ref - tan * ref.dot(tan)).normalized(); b = tan.cross(n)
        rx, ry = lerp_list(radii, t)
        rb = rib(t) if callable(rib) else rib
        row = []
        for j in range(segs):
            a = j / segs * 2 * math.pi
            k = 1 + (rb[1] * math.cos(a * rb[0]) if rb else 0)
            cu, sv = section(a) if section else (math.cos(a), math.sin(a))
            row.append(bm.verts.new(c + n * cu * rx * k + b * sv * ry * k))
        ringsv.append(row)
    for i, (a, b2) in enumerate(zip(ringsv, ringsv[1:])):
        v0, v1 = i / (rings - 1), (i + 1) / (rings - 1)
        for j in range(segs):
            f = bm.faces.new((a[j], a[(j + 1) % segs], b2[(j + 1) % segs], b2[j]))
            for loop, uvv in zip(f.loops, ((j / segs, v0), ((j + 1) / segs, v0), ((j + 1) / segs, v1), (j / segs, v1))):
                loop[uvl].uv = uvv
    for end, row in ((caps[0], ringsv[0]), (caps[1], ringsv[-1])):
        if not end: continue
        first = row is ringsv[0]
        c = sum((v.co for v in row), Vector()) / len(row)
        tan = (pts[1] - pts[0]).normalized() if first else (pts[-1] - pts[-2]).normalized()
        r = sum((v.co - c).length for v in row) / len(row)
        pole = bm.verts.new(c + tan * (-1 if first else 1) * r * 0.45)
        for j in range(segs):
            f = bm.faces.new((row[(j + 1) % segs], row[j], pole) if first else (row[j], row[(j + 1) % segs], pole))
            for loop in f.loops: loop[uvl].uv = (j / segs, 0.0 if first else 1.0)
    return mesh_from(name, bm, m, sub)

def blob(name, centre, radii, m, seg=32, shape=None, sub=1, rot=None):
    """An ellipsoid (optionally turned by quaternion rot); shape(d) -> radial multiplier."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=1)
    for v in bm.verts:
        d = v.co.normalized(); k = shape(d) if shape else 1
        p = Vector((d.x * radii[0], d.y * radii[1], d.z * radii[2])) * k
        v.co = (rot @ p if rot else p) + Vector(centre)
    return mesh_from(name, bm, m, sub)

def box(n):
    """superellipsoid profile: a soft rounded box"""
    return lambda d: 1 / (abs(d.x) ** n + abs(d.y) ** n + abs(d.z) ** n) ** (1 / n)

def dashes(name, path, m, every=0.03, length=0.016, r=0.0035, offset=None):
    """Stitching: short capsules along a path, as one object."""
    pts = catmull([Vector(p) for p in path], 200)
    bm = bmesh.new(); acc = 0.0; i = 0
    while i < len(pts) - 1:
        a, b = pts[i], pts[i + 1]; seg = (b - a).length; acc += seg
        if acc >= every:
            acc = 0.0
            tan = (b - a).normalized(); c = a + (offset(a) if offset else Vector())
            res = bmesh.ops.create_uvsphere(bm, u_segments=6, v_segments=4, radius=1)
            q = Vector((0, 0, 1)).rotation_difference(tan)
            for v in res['verts']:
                v.co = c + q @ Vector((v.co.x * r, v.co.y * r, v.co.z * length / 2))
        i += 1
    return mesh_from(name, bm, m, sub=0)

# ---------------------------------------------------------------- the body plan
TH = math.radians(30)                                  # rest pose: arms 30° from the body (A-pose)
SHOULDER = (0.22, 0.0, 1.16)
def arm_points(sx):
    S = Vector((sx * SHOULDER[0], SHOULDER[1], SHOULDER[2]))
    d = Vector((sx * math.sin(TH), 0.0, -math.cos(TH)))
    E = S + d * 0.25; W = E + d * 0.25
    return S, E, W, d
def leg_points(sx):
    H = Vector((sx * 0.13, 0, 0.72)); K = Vector((sx * 0.145, 0, 0.46)); A = Vector((sx * 0.15, 0, 0.2))
    return H, K, A

def torso_r(z):
    zs = [t[0] for t in TORSO]
    if z <= zs[0]: return TORSO[0][1:]
    if z >= zs[-1]: return TORSO[-1][1:]
    for (z0, a0, b0), (z1, a1, b1) in zip(TORSO, TORSO[1:]):
        if z0 <= z <= z1:
            u = (z - z0) / (z1 - z0); return a0 + (a1 - a0) * u, b0 + (b1 - b0) * u

def on_torso(a, z, off=0.0):
    """a point on the sweater at azimuth a (0 = front, + toward her left) and height z"""
    rx, ry = torso_r(z)
    return Vector((math.sin(a) * (rx + off), -math.cos(a) * (ry + off), z))

def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    out = os.environ.get('OUT', '/tmp')
    facepng = os.path.join(out, 'face_normal.png'); face_paint.paint('normal').convert('RGB').save(facepng)
    glosspng = os.path.join(out, 'face_gloss.png'); face_paint.gloss_mask().save(glosspng)
    M = {
        'skin_face': face_material(facepng, glosspng),
        'skin': textured('skin', '#eba27a', 0.5, noise=(40, 0.02), sss=0.18),
        'ear_in': material('ear_in', '#e8957a', rough=0.55, sss=0.35),
        'nose': material('nose', '#f0977a', rough=0.45, sss=0.35),
        'knit': textured('knit', '#f5e6c8', 0.95, bands=(30, 0.55, 1.2), noise=(220, 0.22), sheen=0.5, var=0.05),
        'rib': textured('rib', '#f0dfbe', 0.95, bands=(60, 0.8, 0.2), noise=(220, 0.2), sheen=0.5, var=0.06),
        'denim': textured('denim', '#6990c4', 0.95, bands=(160, 0.25, 4.0), noise=(150, 0.3), sheen=0.3, var=0.05),
        'denim_cuff': textured('denim_cuff', '#7a9ecd', 0.95, bands=(160, 0.25, 4.0), noise=(150, 0.3), sheen=0.3, var=0.05),
        'seam': material('seam', '#56779f', rough=0.8),
        'stitch': material('stitch', '#e9d3b0', rough=0.7),
        'shoe': textured('shoe', '#f5efe4', 0.6, noise=(90, 0.04)),
        'sole': material('sole', '#e9d7ba', rough=0.75),
        'tan': material('tan', '#d9a56b', rough=0.6),
        'leather': textured('leather', '#8c4f2b', 0.48, noise=(70, 0.06), coat=0.15),
        'leather_d': textured('leather_d', '#7a4224', 0.5, noise=(70, 0.06), coat=0.1),
        'brass': material('brass', '#c99a4a', rough=0.35, coat=0.3),
        'petal': material('petal', '#fffaf2', rough=0.5, sss=0.25),
        'gold': material('gold', '#f2b23a', rough=0.45),
        'eye_gloss': glass('eye_gloss'),
        'hair': [textured(f'hair{i}', c, 0.4, bands=(14, 0.22, 6.0), noise=(120, 0.04), sheen=0.3, var=0.06)
                 for i, c in enumerate(('#5a3019', '#663820', '#4e2915'))],
        'hair_base': material('hair_base', '#5a3019', rough=0.55, sheen=0.3),
    }
    parts = {}
    build_head(parts, M)
    build_body(parts, M)
    build_hair(parts, M)
    return parts

# ---------------------------------------------------------------- head & face
def head_shape(d):
    k = 1.0
    for sx in (-1, 1):                          # soft round cheeks, low on the face
        k += 0.09 * math.exp(-((d.x - sx * 0.55) ** 2 + (d.y + 0.62) ** 2 + (d.z + 0.45) ** 2) / 0.1)
    k -= 0.04 * math.exp(-(d.x ** 2 + (d.y + 0.4) ** 2 + (d.z + 0.92) ** 2) / 0.12)   # a small round chin
    k += 0.02 * max(0.0, d.z) ** 2
    return k

def build_head(parts, M):
    head = blob('head', HEAD, (HRX, HRY, HRZ), M['skin_face'], seg=48, shape=head_shape)
    uv = head.data.uv_layers.new(name='UV')
    for poly in head.data.polygons:
        for li in poly.loop_indices:
            co = head.data.vertices[head.data.loops[li].vertex_index].co
            if co.y > HEAD.y + 0.05:
                uv.data[li].uv = (0.02, 0.02)              # the back of the head: plain skin, never a mirrored face
            else:
                uv.data[li].uv = (0.5 + co.x / (2 * face_paint.FACE_W), (co.z - face_paint.FACE_Z0) / face_paint.FACE_H)
    parts['head'] = (head, 'head')
    dg = bpy.context.evaluated_depsgraph_get(); bvh = BVHTree.FromObject(head, dg)
    # ears: a soft C-shaped rim round a shallow inner bowl, at eye level behind the cheeks
    for sx in (-1, 1):
        E = HEAD + Vector((sx * 0.352, 0.04, -0.17))
        rim = [E + Vector((sx * (0.018 + 0.006 * math.sin(a)), 0.052 * math.cos(a), 0.078 * math.sin(a)))
               for a in [math.radians(115 - k * 235 / 16) for k in range(17)]]
        ear = sweep(f'ear{sx}', rim, [(0.017, 0.016), (0.02, 0.019), (0.017, 0.016), (0.013, 0.012)], M['skin'], rings=30, segs=10)
        bowl = blob(f'earbowl{sx}', E + Vector((sx * 0.006, 0.0, 0.0)), (0.014, 0.048, 0.07), M['skin'], seg=20)
        inner = blob(f'earin{sx}', E + Vector((sx * 0.016, -0.006, -0.008)), (0.006, 0.026, 0.04), M['ear_in'], seg=16)
        for o in (ear, bowl, inner): parts[o.name] = (o, 'head')
    # the nose: tiny, but with enough shape to catch a highlight
    hit = bvh.ray_cast(Vector((0, -1.0, face_paint.NOSE_Z)), Vector((0, 1, 0)))
    nose = blob('nose', hit[0] + Vector((0, 0.008, 0)), (0.026, 0.02, 0.021), M['nose'], seg=16)
    parts['nose'] = (nose, 'head')
    neck = sweep('neck', [(0, 0.0, 1.24), (0, 0.0, 1.43)], [(0.08, 0.075)] * 2, M['skin'], rings=6, segs=16)
    parts['neck'] = (neck, ('neck', 'head', 'chest'))

# ---------------------------------------------------------------- clothes
def build_body(parts, M):
    # --- the jumper: oversized, soft, with a ribbed hem and a crew neck
    path = [(0, 0, z) for z, _, _ in TORSO]
    radii = [(rx, ry) for _, rx, ry in TORSO]
    jumper = sweep('jumper', path, radii, M['knit'], rings=22, segs=56, rib=(28, 0.008), caps=(False, False))
    parts['jumper'] = (jumper, ('hips', 'spine', 'chest', 'shoulder.L', 'shoulder.R'))
    hem = sweep('hem', [(0, 0, 0.69), (0, 0, 0.705), (0, 0, 0.75), (0, 0, 0.79)],
                [(0.232, 0.178), (0.246, 0.188), (0.252, 0.194), (0.252, 0.195)], M['rib'], rings=8, segs=96, rib=(48, 0.025), caps=(False, False))
    parts['hem'] = (hem, ('hips', 'spine'))
    collar = sweep('collar', [(0, 0, 1.265), (0, 0, 1.3), (0, 0, 1.33), (0, 0, 1.34)],
                   [(0.142, 0.122), (0.128, 0.11), (0.112, 0.098), (0.1, 0.088)], M['rib'], rings=8, segs=64, rib=(40, 0.04), caps=(False, False))
    parts['collar'] = (collar, ('chest', 'neck'))
    for sx, nm in ((1, 'L'), (-1, 'R')):
        S, E, W, d = arm_points(sx)
        # a dropped shoulder: the sleeve starts low on the body and balloons to the cuff
        fold = lambda t: (9, 0.06 * max(0.0, (t - 0.72) / 0.28)) if t > 0.72 else (14, 0.012)
        sl = sweep(f'sleeve.{nm}', [S - d * 0.06, S + d * 0.06, S + d * 0.17, E, E + d * 0.1, W - d * 0.1, W - d * 0.045],
                   [(0.1, 0.096), (0.112, 0.108), (0.13, 0.125), (0.15, 0.144), (0.172, 0.165), (0.17, 0.162), (0.125, 0.12)],
                   M['knit'], rings=26, segs=32, side=(0, 1, 0), rib=fold, caps=(True, False))
        parts[sl.name] = (sl, (f'shoulder.{nm}', f'upper_arm.{nm}', f'forearm.{nm}', f'hand.{nm}'))
        cuff = sweep(f'cuff.{nm}', [W - d * 0.075, W - d * 0.03, W + d * 0.012], [(0.098, 0.094), (0.09, 0.086), (0.083, 0.08)],
                     M['rib'], rings=6, segs=48, side=(0, 1, 0), rib=(24, 0.055), caps=(False, False))
        parts[cuff.name] = (cuff, (f'forearm.{nm}', f'hand.{nm}'))
        build_hand(parts, M, sx, nm, W, d)

    # --- jeans: two legs from a soft seat, a fly and side seams, thick rolled cuffs
    seat = blob('seat', (0, 0.0, 0.75), (0.262, 0.172, 0.12), M['denim'], seg=32, shape=lambda d: 1 + 0.06 * max(0.0, d.z))
    parts['seat'] = (seat, ('hips', 'thigh.L', 'thigh.R'))
    for sx, nm in ((1, 'L'), (-1, 'R')):
        H, K, A = leg_points(sx)
        knee = lambda t: (5, 0.012 * math.exp(-((t - 0.55) / 0.12) ** 2))     # a few soft folds at the knee
        leg = sweep(f'jeans.{nm}', [(sx * 0.1, 0, 0.82), (sx * 0.125, 0, 0.7), (sx * 0.142, 0, 0.6), K, (sx * 0.15, 0, 0.3)],
                    [(0.16, 0.16), (0.148, 0.152), (0.134, 0.14), (0.132, 0.138), (0.136, 0.142)], M['denim'],
                    rings=22, segs=28, caps=(False, False), side=(0, 1, 0), rib=knee)
        parts[leg.name] = (leg, ('hips', f'thigh.{nm}', f'shin.{nm}'))
        for side_a, tag in ((math.pi / 2, 'out'), (-math.pi / 2, 'in')):          # side seams
            pts = []
            for z in (0.68, 0.58, 0.46, 0.36):
                cxz = (sx * 0.1 + (sx * 0.15 - sx * 0.1) * (0.82 - z) / 0.52)
                r = 0.135 + (0.148 - 0.135) * max(0.0, (z - 0.6) / 0.1)
                pts.append((cxz + sx * math.sin(side_a) * (r + 0.002), -math.cos(side_a) * 0.0, z))
            s = sweep(f'seam.{nm}{tag}', pts, [(0.004, 0.004)] * 2, M['seam'], rings=12, segs=6)
            parts[s.name] = (s, (f'thigh.{nm}', f'shin.{nm}'))
        # the rolled cuff: a thick folded band, rounded at the fold
        z0 = 0.2
        cuff = sweep(f'roll.{nm}', [(sx * 0.15, 0, z0), (sx * 0.15, 0, z0 + 0.018), (sx * 0.15, 0, z0 + 0.13), (sx * 0.15, 0, z0 + 0.155), (sx * 0.15, 0, z0 + 0.168)],
                     [(0.148, 0.153), (0.157, 0.162), (0.159, 0.164), (0.153, 0.158), (0.138, 0.143)], M['denim_cuff'],
                     rings=14, segs=40, caps=(False, False), side=(0, 1, 0))
        parts[cuff.name] = (cuff, (f'shin.{nm}',))
        fold = sweep(f'fold.{nm}', [(sx * 0.15 + 0.159 * math.cos(a), 0.164 * math.sin(a), z0 + 0.145) for a in [k / 24 * 2 * math.pi for k in range(25)]],
                     [(0.012, 0.012)] * 2, M['denim_cuff'], rings=48, segs=10, caps=(False, False))   # the rolled edge
        parts[fold.name] = (fold, (f'shin.{nm}',))
        build_shoe(parts, M, sx, nm)
    # the fly: a single stitched curve at the front
    fly = dashes('fly', [(0.0, -0.172, 0.73), (0.03, -0.168, 0.68), (0.03, -0.155, 0.63), (0.0, -0.13, 0.6)], M['seam'], every=0.012, length=0.01, r=0.003)
    parts['fly'] = (fly, ('hips',))

    build_backpack(parts, M)

def build_hand(parts, M, sx, nm, W, d):
    """a chubby little hand: a soft palm, three suggested fingers and a thumb, palm toward the body"""
    side = Vector((0, 1, 0))
    inward = Vector((-sx, 0, 0))
    palm = sweep(f'palm.{nm}', [W - d * 0.03, W + d * 0.04, W + d * 0.09], [(0.055, 0.034), (0.062, 0.037), (0.057, 0.034)], M['skin'],
                 rings=8, segs=16, side=side)
    parts[palm.name] = (palm, (f'hand.{nm}',))
    for k, off in enumerate((-0.026, 0.0, 0.026)):
        base = W + d * 0.085 + side * off
        tip = base + d * (0.045 - abs(off) * 0.4) + inward * 0.018
        f = sweep(f'finger.{nm}{k}', [base, base + d * 0.025, tip], [(0.0155, 0.014), (0.0145, 0.013), (0.012, 0.011)], M['skin'], rings=6, segs=10, side=side)
        parts[f.name] = (f, (f'hand.{nm}',))
    tb = W + d * 0.03 + side * -0.04
    thumb = sweep(f'thumb.{nm}', [tb, tb + d * 0.03 + side * -0.012 + inward * 0.01, tb + d * 0.055 + side * -0.008 + inward * 0.02],
                  [(0.017, 0.016), (0.015, 0.014), (0.012, 0.011)], M['skin'], rings=6, segs=10)
    parts[thumb.name] = (thumb, (f'hand.{nm}',))

def build_shoe(parts, M, sx, nm):
    """a small chunky sneaker: a flat-bottomed cream sole with straight sides, a white upper that
    sits on it (tall at the heel, sloping to a round toe), a padded collar, a tongue with flat
    laces, a tan flash on the outside and a tan heel"""
    x = sx * 0.15
    rule = (f'foot.{nm}',)
    sgn = lambda v, e: math.copysign(abs(v) ** e, v)
    slab = lambda a: (sgn(math.cos(a), 0.45), sgn(math.sin(a), 0.45))                 # a rounded slab
    dome = lambda a: (math.cos(a), math.sin(a) if math.sin(a) > 0 else math.sin(a) * 0.15)   # flat-bottomed
    sole = sweep(f'sole.{nm}', [(x, 0.115, 0.026), (x, 0.0, 0.025), (x, -0.13, 0.025), (x, -0.215, 0.031)],
                 [(0.112, 0.026), (0.12, 0.025), (0.124, 0.025), (0.1, 0.022)], M['sole'], rings=14, segs=28, side=(1, 0, 0), section=slab)
    # upper: (y, half-width, half-height) with its flat bottom resting on the sole at z = 0.045
    prof = [(0.095, 0.104, 0.1), (0.0, 0.11, 0.088), (-0.1, 0.112, 0.056), (-0.19, 0.088, 0.032)]
    upper = sweep(f'upper.{nm}', [(x, y, 0.045 + 0.15 * ry) for y, rx, ry in prof], [(rx, ry) for y, rx, ry in prof],
                  M['shoe'], rings=16, segs=28, side=(1, 0, 0), section=dome)
    collar = sweep(f'shoecollar.{nm}', [(x + 0.07 * math.cos(a), 0.035 + 0.062 * math.sin(a), 0.168) for a in [k / 20 * 2 * math.pi for k in range(21)]],
                   [(0.018, 0.016)] * 2, M['shoe'], rings=40, segs=10, caps=(False, False))
    tongue = sweep(f'tongue.{nm}', [(x, 0.0, 0.178), (x, -0.045, 0.158), (x, -0.09, 0.128)], [(0.045, 0.011), (0.048, 0.011), (0.044, 0.01)],
                   M['shoe'], rings=10, segs=12, side=(1, 0, 0))
    for o in (sole, upper, collar, tongue): parts[o.name] = (o, rule)
    for k in range(3):                                         # flat laces lying across the tongue
        y = -0.02 - k * 0.028; z = 0.172 - k * 0.016 + 0.01
        lace = sweep(f'lace.{nm}{k}', [(x - 0.05, y + 0.004, z - 0.008), (x, y, z), (x + 0.05, y + 0.004, z - 0.008)], [(0.0055, 0.0035)] * 3,
                     M['sole'], rings=10, segs=8, normal_fn=lambda p: Vector((0, -0.4, 1)).normalized())
        parts[lace.name] = (lace, rule)
    # tan flash: a curved band following the outer side of the upper
    def side_pt(y, z):
        rx = 0.11 if y > -0.05 else 0.112 - (abs(y) - 0.05) * 0.3
        return (x + sx * (rx + 0.003), y, z)
    flash = sweep(f'flash.{nm}', [side_pt(0.075, 0.07), side_pt(0.02, 0.115), side_pt(-0.04, 0.09), side_pt(-0.1, 0.11)],
                  [(0.014, 0.003)] * 4, M['tan'], rings=20, segs=8, normal_fn=lambda p: Vector((sx, 0, 0)))
    heel = blob(f'heel.{nm}', (x, 0.108, 0.1), (0.08, 0.026, 0.058), M['tan'], seg=20)
    for o in (flash, heel): parts[o.name] = (o, rule)

def build_backpack(parts, M):
    """soft brown leather: a rounded body, a flap with a strap and buckle, a top handle,
    stitched edges; flat leather straps that lie on the jumper over each shoulder"""
    PB = Vector((0, torso_r(1.04)[1] + 0.115, 1.04))
    bag = blob('bag', PB, (0.2, 0.11, 0.24), M['leather'], seg=28, shape=box(3.4))
    flap = blob('flap', PB + Vector((0, 0.012, 0.09)), (0.207, 0.106, 0.16), M['leather_d'], seg=28, shape=box(3.2))
    tab = sweep('flaptab', [PB + Vector((0, 0.113, 0.05)), PB + Vector((0, 0.116, -0.04)), PB + Vector((0, 0.114, -0.1))],
                [(0.03, 0.006)] * 3, M['leather'], rings=8, segs=10, side=(1, 0, 0))
    buckle = sweep('buckle', [PB + Vector((-0.03, 0.122, -0.03)), PB + Vector((0.03, 0.122, -0.03)), PB + Vector((0.03, 0.122, -0.075)), PB + Vector((-0.03, 0.122, -0.075)), PB + Vector((-0.03, 0.122, -0.03))],
                   [(0.006, 0.006)] * 5, M['brass'], rings=24, segs=8, caps=(False, False))
    handle = sweep('handle', [PB + Vector((-0.06, 0.0, 0.225)), PB + Vector((-0.045, 0.0, 0.29)), PB + Vector((0.045, 0.0, 0.29)), PB + Vector((0.06, 0.0, 0.225))],
                   [(0.016, 0.009)] * 4, M['leather_d'], rings=14, segs=8, side=(0, 1, 0))
    edge = [PB + Vector((-0.2 * math.cos(a), 0.108, 0.09 - 0.15 * math.sin(a))) for a in [k / 12 * math.pi for k in range(13)]]
    stitch = dashes('flapstitch', edge, M['stitch'], every=0.022, length=0.012, r=0.003)
    for o in (bag, flap, tab, buckle, handle, stitch): parts[o.name] = (o, ('chest',))
    # straps: from the top of the bag, over the shoulder, down the chest, under the arm, back to the bag's foot
    for sx in (-1, 1):
        pts = [PB + Vector((sx * 0.11, -0.06, 0.2)), on_torso(sx * 2.6, 1.22, 0.012), Vector((sx * 0.15, -0.02, 1.302)),
               on_torso(sx * 0.42, 1.2, 0.013), on_torso(sx * 0.5, 1.06, 0.013), on_torso(sx * 0.68, 0.93, 0.013),
               on_torso(sx * 1.45, 0.86, 0.012), PB + Vector((sx * 0.15, -0.06, -0.19))]
        nrm = lambda p: (p - Vector((0, 0, 1.02))).normalized()
        st = sweep(f'strap{sx}', pts, [(0.028, 0.0065)] * len(pts), M['leather'], rings=48, segs=10, normal_fn=nrm)
        sd = lambda p, sx=sx: nrm(p) * 0.007
        stitch_a = dashes(f'strapstitch{sx}', pts[2:6], M['stitch'], every=0.02, length=0.011, r=0.0025, offset=sd)
        bk = on_torso(sx * 0.47, 1.12, 0.022)
        n = nrm(bk); u = Vector((0, 0, 1)); v = n.cross(u).normalized()
        frame = [bk + v * 0.032 + u * 0.022, bk - v * 0.032 + u * 0.022, bk - v * 0.032 - u * 0.022, bk + v * 0.032 - u * 0.022, bk + v * 0.032 + u * 0.022]
        bkl = sweep(f'strapbuckle{sx}', frame, [(0.005, 0.005)] * 5, M['brass'], rings=24, segs=8, caps=(False, False))
        for o in (st, stitch_a, bkl): parts[o.name] = (o, ('chest', 'spine'))

def daisy(parts, centre, facing, r, M, rule):
    """the little white flower: six round petals and a yellow heart"""
    rot = facing.normalized().to_track_quat('Z', 'Y')
    for i in range(6):
        a = i / 6 * 2 * math.pi
        q = rot @ Quaternion((0, 0, 1), a)
        p = blob(f'petal{len(parts)}_{i}', Vector(centre) + rot @ Vector((math.cos(a) * r * 0.55, math.sin(a) * r * 0.55, 0)),
                 (r * 0.48, r * 0.38, r * 0.16), M['petal'], seg=14, rot=q)
        parts[p.name] = (p, rule)
    c = blob(f'heart{len(parts)}', Vector(centre) + rot @ Vector((0, 0, r * 0.1)), (r * 0.3, r * 0.3, r * 0.18), M['gold'], seg=14, rot=rot)
    parts[c.name] = (c, rule)

# ---------------------------------------------------------------- hair
# Built like a real updo: a thin dark base that fits the skull, then layered
# locks (flat, lens-shaped ribbons that taper) laid nape → sides → top → fringe,
# each layer a touch above the last so they overlap like shingles, all
# gathered into a bun of wrapped locks. Every lock follows one hair surface
# (skull + volume), so nothing floats and nothing cuts through.

def skull_r(d):
    d = d.normalized()
    return 1 / math.sqrt((d.x / HRX) ** 2 + (d.y / HRY) ** 2 + (d.z / HRZ) ** 2)

def volume(d):
    """how far the hair stands off the skull in direction d"""
    d = d.normalized()
    side = math.exp(-((abs(d.x) - 0.8) ** 2 / 0.07 + (d.z - 0.2) ** 2 / 0.13))      # soft fullness over the temples and ears
    side *= min(1.0, max(0.0, (d.z + 0.05) / 0.3)) * (1.0 if d.y < 0.1 else max(0.35, 1 - (d.y - 0.1) * 1.4))   # narrowing to the nape
    v = 0.035 + 0.065 * max(0.0, d.z) + 0.13 * side + 0.045 * max(0.0, d.y) * max(0.0, d.z + 0.4)
    front = min(1.0, max(0.0, (-d.y - 0.3) / 0.3)); f = min(1.0, max(0.0, (d.z - 0.42) / 0.3))
    return v * (1 - front * (1 - (0.25 + 0.75 * f)))            # thins down onto the skin at the front hairline

def hair_pt(dirv, extra=0.0):
    d = dirv.normalized(); return HEAD + d * (skull_r(d) + volume(d) + extra)

def head_normal(p):
    return (p - HEAD).normalized()

def sph(az, el):
    """direction from the head centre: az 0 = front (-Y), + toward her left (+X); el up"""
    return Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))

def hairline(az):
    """elevation of the hairline at azimuth az: high at the forehead, over the ears, low at the nape"""
    y = -math.cos(az)
    pts = [(-1.0, 0.5), (-0.6, 0.44), (-0.2, 0.16), (0.05, 0.02), (0.4, -0.34), (1.0, -0.6)]
    for (y0, e0), (y1, e1) in zip(pts, pts[1:]):
        if y0 <= y <= y1: return e0 + (e1 - e0) * (y - y0) / (y1 - y0)
    return pts[-1][1]

def lens(w, t):
    """a lock's half-width w and thickness t along its length: narrow root, full body, tapered tip"""
    return [(w * 0.55, t * 0.5), (w, t), (w * 1.02, t), (w * 0.8, t * 0.85), (w * 0.45, t * 0.6)]

def lock(parts, name, pts, w, t, mat, rule='head', rings=24):
    o = sweep(name, pts, lens(w, t), mat, rings=rings, segs=10, normal_fn=head_normal)
    parts[o.name] = (o, rule if isinstance(rule, tuple) else (rule,))
    return o

def to_bun(parts, name, az, el0, w, layer, mat, sway):
    """one lock from the hairline at (az, el0), following the head round to the bun"""
    bun_dir = (BUN - HEAD).normalized()
    start = sph(az, el0)
    pts = []
    for k in range(10):
        t = k / 9
        d = start.lerp(bun_dir, t ** 0.9).normalized()
        side = start.cross(bun_dir).normalized() if abs(start.dot(bun_dir)) < 0.99 else Vector((1, 0, 0))
        d = (d + side * sway * math.sin(t * math.pi)).normalized()
        grow = min(1.0, t / 0.35) ** 0.7                     # rises out of the skull at the hairline
        p = HEAD + d * (skull_r(d) + 0.006 + (volume(d) + layer + 0.012 * math.sin(t * math.pi)) * grow)
        if t > 0.75:                                          # gathered into the bun's base
            p = p.lerp(BUN + (p - BUN).normalized() * 0.14, (t - 0.75) / 0.25)
        pts.append(p)
    return lock(parts, name, pts, w, 0.034, mat)

def build_hair(parts, M):
    hm, base = M['hair'], M['hair_base']
    # the base: fits the skull under the locks (never seen as a cap: every part of it is covered)
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=20, radius=1)
    for v in bm.verts:
        d = v.co.normalized() if v.co.length else Vector((0, 0, 1))
        az = math.atan2(d.x, -d.y); el = math.asin(max(-1, min(1, d.z)))
        grow = min(1.0, max(0.0, (el - hairline(az)) / 0.35)) ** 0.7
        v.co = HEAD + d * (skull_r(d) + 0.004 + volume(d) * 0.8 * grow)
    def gone(v):
        d = (v.co - HEAD).normalized()
        az = math.atan2(d.x, -d.y); return math.asin(max(-1, min(1, d.z))) < hairline(az) - 0.02
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if gone(v)], context='VERTS')
    cap = mesh_from('hair_base', bm, base, sub=1)
    parts['hair_base'] = (cap, ('head',))

    # 1) nape and back: up from the nape line into the bun
    for i in range(15):
        az = math.pi + (i / 14 - 0.5) * 2.2
        to_bun(parts, f'lock_back{i}', az, hairline(az) + 0.02, R.uniform(0.075, 0.09), 0.0, hm[i % 3], R.uniform(-0.05, 0.05))
    # 2) the sides: from above and behind the ears, sweeping back and up
    for sx in (-1, 1):
        for i in range(8):
            az = sx * (0.75 + i * 0.22)
            to_bun(parts, f'lock_side{sx}_{i}', az, hairline(az) + 0.03, R.uniform(0.075, 0.09), 0.008, hm[(i + 1) % 3], sx * -0.05)
    # 3) the top: from the part, combed straight back
    for i in range(10):
        sx = -1 if i < 5 else 1; j = i % 5
        az = sx * (0.08 + j * 0.17)
        to_bun(parts, f'lock_top{i}', az, 0.7 - j * 0.05, 0.07, 0.016, hm[(i + 2) % 3], sx * 0.03)

    # 4) the fringe: from a centre part, curved sections arc out to each side like brackets.
    # The inner ones stop above the brows; the outer ones sweep over the temples to the
    # cheeks and frame the face. Widths differ, tips taper and turn softly outward.
    FR = [  # (end azimuth, end elevation, half-width, bow)
        (0.58, 0.22, 0.06, 0.05), (0.86, 0.04, 0.066, 0.08), (1.08, -0.2, 0.058, 0.1), (1.26, -0.42, 0.048, 0.1)]
    for sx in (-1, 1):
        for j, (az_e, el_e, w, bow) in enumerate(FR):
            start = sph(sx * (0.1 + 0.04 * j), 0.95 - 0.05 * j)
            end = sph(sx * az_e, el_e)
            pts = []
            for k in range(14):
                t = k / 13
                az = sx * (0.1 + 0.04 * j + (az_e - 0.1 - 0.04 * j) * (1 - (1 - t) ** 2.0))     # swings out early, like a bracket
                el = (0.95 - 0.05 * j) + (el_e - 0.95 + 0.05 * j) * t ** 1.4
                d = sph(az, el)
                lift = 0.022 + 0.008 * (3 - j) + bow * 0.12 * math.sin(t * math.pi)
                pts.append(HEAD + d * (skull_r(d) + volume(d) * (1 - t * 0.6) + lift))
            tip, prev = pts[-1], pts[-2]
            tdir = (tip - prev).normalized(); outv = (Vector((sx, 0, 0.3)) - tdir * tdir.dot(Vector((sx, 0, 0.3)))).normalized()
            for q in range(1, 3):
                a = q / 2 * 0.9
                pts.append(tip + tdir * math.sin(a) * 0.022 + outv * (1 - math.cos(a)) * 0.016)
            lock(parts, f'fringe{sx}_{j}', pts, w, 0.03, hm[(j + (sx > 0)) % 3], rings=34)

    # 5) the bun: locks wrapped round a gathered centre, a band where it meets the head, flyaways
    ax = (BUN - HEAD).normalized(); u = ax.orthogonal().normalized(); v = ax.cross(u)
    core = blob('bun_core', BUN, (0.19, 0.19, 0.16), base, seg=24,
                rot=Vector((0, 0, 1)).rotation_difference(ax))
    parts['bun_core'] = (core, ('bun',))
    bun_n = lambda p: (p - BUN).normalized()
    def loop(name, phi, tier, mat):
        """a lock that leaves the bun's centre, loops out over its surface and tucks back in"""
        up = ax; out0 = (u * math.cos(phi) + v * math.sin(phi))
        side = up.cross(out0).normalized()
        pts = []
        for k in range(15):
            t = k / 14; a = t * math.pi                       # out and back round a petal-shaped loop
            reach = math.sin(a) * (0.25 if tier == 0 else 0.2)
            lat = math.sin(2 * a) * 0.05                      # the loop opens sideways, so it reads as a loop, not a spike
            h = (0.12 if tier == 0 else 0.2) - reach * (0.6 if tier == 0 else 0.3)
            p = BUN + out0 * reach + side * lat + up * h
            p = BUN + (p - BUN).normalized() * max((p - BUN).length, 0.1)
            pts.append(p)
        w = R.uniform(0.06, 0.074)
        o = sweep(name, pts, [(w * 0.5, 0.022), (w, 0.042), (w, 0.042), (w * 0.5, 0.022)], mat, rings=30, segs=10, normal_fn=bun_n)
        parts[o.name] = (o, ('bun',))
    for i in range(9):                                        # the lower tier, round the bun's waist
        loop(f'bunloop_a{i}', i / 9 * 2 * math.pi + R.uniform(-0.15, 0.15), 0, hm[i % 3])
    for i in range(6):                                        # the upper tier, smaller, turned between
        loop(f'bunloop_b{i}', (i + 0.5) / 6 * 2 * math.pi + R.uniform(-0.15, 0.15), 1, hm[(i + 1) % 3])
    band = [BUN - ax * 0.15 + (u * math.cos(a) + v * math.sin(a)) * 0.18 for a in [k / 24 * 2 * math.pi for k in range(25)]]
    o = sweep('bun_band', band, [(0.035, 0.02)] * 2, hm[0], rings=40, segs=10, normal_fn=bun_n, caps=(False, False))
    parts['bun_band'] = (o, ('bun',))
    for i in range(4):
        a0 = R.uniform(0, 6.28); c = BUN + ax * 0.12 + (u * math.cos(a0) + v * math.sin(a0)) * 0.1
        pts = [c + (u * math.cos(a0 + t * 2.5) + v * math.sin(a0 + t * 2.5)) * 0.07 * t + ax * 0.08 * math.sin(t * 2.4) for t in [k / 8 for k in range(9)]]
        o = sweep(f'flyaway{i}', pts, [(0.012, 0.005), (0.004, 0.003)], hm[2], rings=14, segs=6)
        parts[o.name] = (o, ('bun',))

    # 6) curls: soft loose S-shapes in front of each ear, small ones at the nape
    for sx in (-1, 1):
        top = HEAD + sph(sx * 1.2, 0.02) * (skull_r(sph(sx * 1.2, 0.02)) + 0.03)
        pts = []
        for k in range(16):
            t = k / 15
            pts.append(top + Vector((sx * (0.006 + 0.018 * math.sin(t * 2 * math.pi * 0.85)), -0.04 * math.sin(t * 2 * math.pi * 0.85 + 1.1) - 0.03 * t, -t * 0.36)))
        tip, prev = pts[-1], pts[-2]                           # ends in a soft curl
        for q in range(1, 5):
            a = q / 4 * math.pi * 1.4
            pts.append(tip + Vector((sx * 0.022 * math.sin(a), -0.022 * (1 - math.cos(a)), 0.006 * q)))
        o = sweep(f'curl{sx}', pts, [(0.026, 0.024), (0.025, 0.023), (0.019, 0.018), (0.008, 0.008)], hm[1], rings=60, segs=10)   # round: reads from every side
        parts[o.name] = (o, ('head',))
        for j in range(2):                                     # little curls behind the ears
            top = hair_pt(sph(sx * (2.1 + 0.25 * j), hairline(sx * (2.1 + 0.25 * j)) + 0.02), -0.01)
            pts = [top + Vector((sx * 0.02 * math.sin(t * 6 + j), 0.02 * t, -t * 0.15)) for t in [k / 10 for k in range(11)]]
            o = sweep(f'napecurl{sx}_{j}', pts, [(0.018, 0.017), (0.012, 0.011), (0.005, 0.005)], hm[j], rings=24, segs=8)
            parts[o.name] = (o, ('head',))

    # the flower clip, on her left above the temple
    fd = sph(0.95, 0.58)
    daisy(parts, hair_pt(fd, 0.04), fd, 0.07, M, ('head',))

# ---------------------------------------------------------------- skeleton & weights
BONES = {}
def build_rig(parts):
    arm = bpy.data.armatures.new('rig'); rig = link(bpy.data.objects.new('rig', arm))
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    def bone(name, h, t, parent=None):
        b = arm.edit_bones.new(name); b.head = Vector(h); b.tail = Vector(t)
        if parent: b.parent = arm.edit_bones[parent]; b.use_connect = False
        BONES[name] = (Vector(h), Vector(t))
    bone('root', (0, 0, 0), (0, 0, 0.2))
    bone('hips', (0, 0, 0.72), (0, 0, 0.86), 'root')
    bone('spine', (0, 0, 0.86), (0, 0, 1.02), 'hips')
    bone('chest', (0, 0, 1.02), (0, 0, 1.22), 'spine')
    bone('neck', (0, 0, 1.22), (0, 0, 1.4), 'chest')
    bone('head', (0, 0, 1.4), (0, 0, 1.95), 'neck')
    bone('bun', BUN - (BUN - HEAD).normalized() * 0.12, BUN + (BUN - HEAD).normalized() * 0.12, 'head')
    for sx, nm in ((1, 'L'), (-1, 'R')):
        S, E, W, d = arm_points(sx)
        bone(f'shoulder.{nm}', (sx * 0.06, 0, 1.18), S, 'chest')
        bone(f'upper_arm.{nm}', S, E, f'shoulder.{nm}')
        bone(f'forearm.{nm}', E, W, f'upper_arm.{nm}')
        bone(f'hand.{nm}', W, W + d * 0.12, f'forearm.{nm}')
        H, K, A = leg_points(sx)
        bone(f'thigh.{nm}', H, K, 'hips')
        bone(f'shin.{nm}', K, A, f'thigh.{nm}')
        bone(f'foot.{nm}', A, (A.x, -0.18, 0.04), f'shin.{nm}')
    bpy.ops.object.mode_set(mode='OBJECT')
    # weights: each part only listens to its own bones; smooth falloff by distance to the bone
    def seg_dist(p, a, b):
        ab = b - a; t = max(0, min(1, (p - a).dot(ab) / ab.length_squared)); return (a + ab * t - p).length
    for name, (o, rule) in parts.items():
        bones = (rule,) if isinstance(rule, str) else rule
        for b in bones: o.vertex_groups.new(name=b)
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            ws = [1 / (seg_dist(p, *BONES[b]) + 0.03) ** 4 for b in bones]
            tot = sum(ws)
            for b, w in zip(bones, ws):
                if w / tot > 0.01: o.vertex_groups[b].add([v.index], w / tot, 'REPLACE')
        mod = o.modifiers.new('rig', 'ARMATURE'); mod.object = rig
        o.parent = rig
    return rig

# ---------------------------------------------------------------- poses & motion
def set_rot(pb, axis, ang):
    """Rotate a pose bone by `ang` about a world-space axis (relative to its rest)."""
    M = pb.bone.matrix_local.to_3x3()
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = (M.inverted() @ Quaternion(Vector(axis), ang).to_matrix() @ M).to_quaternion()

def rot2(pb, rots):
    """Compose several world-axis rotations for one bone."""
    M = pb.bone.matrix_local.to_3x3(); q = Quaternion()
    for axis, ang in rots: q = Quaternion(Vector(axis), ang) @ q
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = (M.inverted() @ q.to_matrix() @ M).to_quaternion()

def key_all(rig, frame):
    for pb in rig.pose.bones:
        pb.keyframe_insert('rotation_quaternion', frame=frame)
        pb.keyframe_insert('location', frame=frame)

def reset_pose(rig):
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = Quaternion(); pb.location = (0, 0, 0)

ARMS_DOWN = math.radians(17)                         # from the 30° rest to hanging relaxed, just clear of the body

def pose_relaxed(rig, swing=0.0, bend=0.12):
    P = rig.pose.bones
    for sx, nm in ((1, 'L'), (-1, 'R')):
        # the forearm inherits the upper arm's turn: it only adds the elbow's bend.
        # arms swing against the same-side leg (thigh L turns by -0.45·sin, arm L by +swing)
        rot2(P[f'upper_arm.{nm}'], [((0, 1, 0), sx * ARMS_DOWN), ((1, 0, 0), swing * sx)])
        set_rot(P[f'forearm.{nm}'], (1, 0, 0), -bend)

def make_action(rig, name, frames, fn):
    act = bpy.data.actions.new(name); act.use_fake_user = True
    rig.animation_data_create(); rig.animation_data.action = act
    for f in frames:
        reset_pose(rig); fn(f); key_all(rig, f)
    for fc in act.fcurves:
        for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'
    return act

def animate(rig):
    P = rig.pose.bones
    # T-pose: arms straight out
    def tpose(f):
        for sx, nm in ((1, 'L'), (-1, 'R')):
            set_rot(P[f'upper_arm.{nm}'], (0, 1, 0), -sx * (math.pi / 2 - TH))
    make_action(rig, 'TPose', [0, 1], tpose)
    # Idle: breathing, a slow sway of the head, the bun settling
    def idle(f):
        t = f / 60 * 2 * math.pi
        pose_relaxed(rig, swing=0.03 * math.sin(t), bend=0.15)
        set_rot(P['chest'], (1, 0, 0), 0.02 * math.sin(t))
        rot2(P['head'], [((0, 1, 0), 0.05 * math.sin(t * 0.5)), ((1, 0, 0), 0.02 * math.sin(t))])
        set_rot(P['bun'], (1, 0, 0), 0.04 * math.sin(t - 0.6))
        P['root'].location = (0, 0.004 * math.sin(t), 0)       # bone-local y = world up
    make_action(rig, 'Idle', list(range(0, 61, 5)), idle)
    # Walk: a bouncy chibi step, arms swinging against the legs, the bun lagging behind
    def walk(f):
        t = f / 24 * 2 * math.pi
        s, c = math.sin(t), math.cos(t)
        pose_relaxed(rig, swing=0.38 * s, bend=0.25)
        for sx, nm, ph in ((1, 'L', 0), (-1, 'R', math.pi)):
            sw = math.sin(t + ph)
            set_rot(P[f'thigh.{nm}'], (1, 0, 0), -0.45 * sw)
            lift = max(0, math.sin(t + ph + math.pi / 2))         # knee bends as the leg swings through
            set_rot(P[f'shin.{nm}'], (1, 0, 0), 0.7 * lift ** 2)
            set_rot(P[f'foot.{nm}'], (1, 0, 0), -0.3 * lift ** 2 + 0.2 * sw * (sw < 0))
        bob = abs(math.cos(t))
        P['root'].location = (0, 0.035 * bob - 0.02, 0)
        rot2(P['hips'], [((0, 0, 1), 0.08 * s), ((0, 1, 0), 0.03 * c)])
        rot2(P['chest'], [((0, 0, 1), -0.12 * s), ((1, 0, 0), -0.06)])
        rot2(P['head'], [((0, 0, 1), 0.06 * s), ((0, 1, 0), -0.04 * c), ((1, 0, 0), 0.04 * bob)])
        set_rot(P['bun'], (1, 0, 0), 0.12 * math.sin(2 * t - 1.0))
    make_action(rig, 'Walk', list(range(0, 25, 2)), walk)
    rig.animation_data.action = bpy.data.actions['Idle']

# ---------------------------------------------------------------- render / export
def studio(res=(560, 720)):
    s = bpy.context.scene
    s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = int(os.environ.get('SAMPLES', 64)); s.cycles.use_denoising = True
    s.render.film_transparent = True
    s.view_settings.view_transform = 'AgX'; s.view_settings.look = 'AgX - Punchy'; s.view_settings.exposure = -0.6
    w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (1, 0.9, 0.8, 1); bg.inputs[1].default_value = 0.75
    # warm, soft studio: a big key from the front left, a broad fill, a warm rim from behind
    for loc, e, size, col in (((-2.6, -4.2, 4.2), 820, 5.0, (1, 0.93, 0.84)), ((4.2, -2.8, 2.4), 260, 5.0, (1, 0.95, 0.9)), ((0.8, 4.6, 3.8), 380, 3.0, (1, 0.88, 0.76))):
        d = bpy.data.lights.new('l', 'AREA'); d.energy = e; d.size = size; d.color = col
        o = link(bpy.data.objects.new('l', d)); o.location = loc
        o.rotation_euler = (Vector((0, 0, 1.2)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=30); bpy.context.object.is_shadow_catcher = True
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = 2.75
    co = link(bpy.data.objects.new('cam', cam)); s.camera = co
    s.render.resolution_x, s.render.resolution_y = res
    return co

def details(out):
    """close-ups like the concept's detail panels: face, hair, sweater and backpack, jeans and shoes"""
    os.environ['OUT'] = out
    parts = build(); rig = build_rig(parts); animate(rig)
    rig.animation_data.action = bpy.data.actions['Idle']; s = bpy.context.scene; s.frame_set(0)
    co = studio((640, 640)); co.data.type = 'PERSP'; co.data.lens = 85
    for name, eye, target in (('face', (0.0, -3.2, 1.7), (0, 0, 1.66)), ('hair', (1.6, 1.9, 2.6), (0, 0.05, 1.95)),
                              ('sweater', (1.5, -1.7, 1.25), (0.1, 0, 1.02)), ('jeans', (0.9, -2.0, 0.45), (0, 0, 0.3))):
        co.location = eye; co.rotation_euler = (Vector(target) - Vector(eye)).to_track_quat('-Z', 'Y').to_euler()
        s.render.filepath = os.path.join(out, f'detail_{name}.png'); bpy.ops.render.render(write_still=True)

def render(out, pose='idle'):
    os.environ['OUT'] = out
    parts = build(); rig = build_rig(parts); animate(rig)
    rig.animation_data.action = bpy.data.actions[{'idle': 'Idle', 'tpose': 'TPose', 'walk': 'Walk'}[pose]]
    s = bpy.context.scene; s.frame_set(6 if pose == 'walk' else 0)
    co = studio((760, 720) if pose == 'tpose' else (560, 720))
    if pose == 'tpose': co.data.ortho_scale = 3.0
    views = [('front', 0), ('three', 35), ('side', 90), ('back', 180)] if pose != 'walk' else [('three', 35), ('side', 90)]
    for name, deg in views:
        a = math.radians(deg); d = 12
        co.location = (math.sin(a) * d, -math.cos(a) * d, 1.22 + d * 0.06)
        co.rotation_euler = (Vector((0, 0, 1.22)) - co.location).to_track_quat('-Z', 'Y').to_euler()
        s.render.filepath = os.path.join(out, f'{pose}_{name}.png'); bpy.ops.render.render(write_still=True)

def export(path):
    os.environ['OUT'] = os.path.dirname(path) or '.'
    parts = build(); rig = build_rig(parts); animate(rig)
    # for a phone: no subdivision on the small dense parts (smooth shading carries them)
    small = ('sole', 'upper', 'shoecollar', 'roll', 'hem', 'collar', 'cuff', 'lock', 'fringe', 'frame', 'curl', 'napecurl', 'flyaway', 'bun', 'petal', 'heart', 'lace', 'strap', 'finger', 'thumb', 'palm', 'flash', 'heel', 'ear', 'nose', 'hair_base', 'eye_lens', 'tongue', 'seam', 'fly', 'buckle', 'handle', 'flaptab', 'flapstitch', 'fold')
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.name.startswith(small):
            for m in [m for m in o.modifiers if m.type == 'SUBSURF']: o.modifiers.remove(m)
    # glTF can't carry procedural colour: fall back to each material's own base colour
    for mat in bpy.data.materials:
        if not mat.use_nodes: continue
        for l in list(mat.node_tree.links):
            if l.to_socket.name == 'Base Color' and l.from_node.type != 'TEX_IMAGE':
                mat.node_tree.links.remove(l)
    tris = 0
    for o in bpy.data.objects:
        if o.type == 'MESH':
            dg = bpy.context.evaluated_depsgraph_get(); me = o.evaluated_get(dg).to_mesh()
            tris += sum(len(p.vertices) - 2 for p in me.polygons)
    print('triangles', tris)
    dg = bpy.context.evaluated_depsgraph_get(); cnt = {}
    for o in bpy.data.objects:
        if o.type == 'MESH':
            k = o.name.rstrip('0123456789.LR').rstrip('_.{}-')
            cnt[k] = cnt.get(k, 0) + sum(len(p.vertices) - 2 for p in o.evaluated_get(dg).to_mesh().polygons)
    print(sorted(cnt.items(), key=lambda kv: -kv[1])[:12])
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True,
                              export_animations=True, export_animation_mode='ACTIONS', export_skins=True,
                              export_cameras=False, export_lights=False)

if __name__ == '__main__':
    args = sys.argv[1:]
    cmd = args[0]
    if cmd == 'render': render(args[1], args[2] if len(args) > 2 else 'idle')
    if cmd == 'details': details(args[1])
    if cmd == 'export': export(args[1])
