# The heroine: the anchor of the game's look (design/ref_hero-girl.jpg).
# One skinned character on a real skeleton, so knees, elbows, spine and the
# bun bend and bounce instead of hinging like toy blocks.
#
#   python girl.py render <outdir> [pose]    Cycles turnaround (pose: idle | tpose | walk)
#   python girl.py export <file.glb>         skinned GLB with T-pose, Idle and Walk
#
# Units: 1 = the game's character unit; she is ~2.4 tall to the top of the bun.
# Modelled facing -Y (glTF +Z), Z up. Her left is +X.

import bpy, bmesh, math, random, sys, os
from mathutils import Vector, Quaternion, Matrix
sys.path.insert(0, os.path.dirname(__file__))
from food import srgb
import face_paint

HEAD = Vector((0, 0, 1.62))          # head centre
HRX, HRY, HRZ = 0.43, 0.40, 0.40     # head radii (wide, soft)
R = random.Random(7)

# ---------------------------------------------------------------- materials
def material(name, hexcol, rough=0.6, sss=0.0, sheen=0.0, coat=0.0, image=None):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; p = nt.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*srgb(hexcol), 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Subsurface Weight'].default_value = sss
    p.inputs['Subsurface Radius'].default_value = (1, 0.45, 0.3)
    p.inputs['Subsurface Scale'].default_value = 0.04
    p.inputs['Sheen Weight'].default_value = sheen
    p.inputs['Coat Weight'].default_value = coat
    if image:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(image)
        nt.links.new(t.outputs['Color'], p.inputs['Base Color'])
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

def sweep(name, path, radii, m, rings=24, segs=20, side=None, normal_fn=None, rib=None, caps=(True, True), sub=1, twist=0.0):
    """A soft tube along `path` (list of Vectors) with elliptical sections.
    radii: list of (rx, ry) along the path. side: the direction rx lies along
    (default: world X, projected). normal_fn(p) -> direction for ry (hair:
    the head's surface normal, so clumps lie flat). rib=(count, depth)."""
    pts = catmull([Vector(p) for p in path], rings)
    bm = bmesh.new(); ringsv = []
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
        row = []
        for j in range(segs):
            a = j / segs * 2 * math.pi + twist * t
            k = 1 + (rib[1] * math.cos(a * rib[0]) if rib else 0)
            row.append(bm.verts.new(c + n * math.cos(a) * rx * k + b * math.sin(a) * ry * k))
        ringsv.append(row)
    for a, b2 in zip(ringsv, ringsv[1:]):
        for j in range(segs):
            bm.faces.new((a[j], a[(j + 1) % segs], b2[(j + 1) % segs], b2[j]))
    # rounded ends: a pole pushed out along the tangent
    for end, row in ((caps[0], ringsv[0]), (caps[1], ringsv[-1])):
        if not end: continue
        first = row is ringsv[0]
        c = sum((v.co for v in row), Vector()) / len(row)
        tan = (pts[1] - pts[0]).normalized() if first else (pts[-1] - pts[-2]).normalized()
        r = sum((v.co - c).length for v in row) / len(row)
        pole = bm.verts.new(c + tan * (-1 if first else 1) * r * 0.45)
        for j in range(segs):
            f = (row[(j + 1) % segs], row[j], pole) if first else (row[j], row[(j + 1) % segs], pole)
            bm.faces.new(f)
    return mesh_from(name, bm, m, sub)

def blob(name, centre, radii, m, seg=32, shape=None, sub=1):
    """An ellipsoid; shape(d) -> radial multiplier for unit direction d."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=1)
    for v in bm.verts:
        d = v.co.normalized(); k = shape(d) if shape else 1
        v.co = Vector((d.x * radii[0], d.y * radii[1], d.z * radii[2])) * k + Vector(centre)
    return mesh_from(name, bm, m, sub)

# ---------------------------------------------------------------- the body plan
TH = math.radians(38)                                  # rest pose: arms 38° from the body (A-pose)
def arm_points(sx):
    S = Vector((sx * 0.27, 0.0, 1.11))
    d = Vector((sx * math.sin(TH), 0.0, -math.cos(TH)))
    E = S + d * 0.27; W = E + d * 0.24
    return S, E, W, d
def leg_points(sx):
    H = Vector((sx * 0.14, 0, 0.74)); K = Vector((sx * 0.15, 0, 0.44)); A = Vector((sx * 0.155, 0, 0.15))
    return H, K, A

def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    out = os.environ.get('OUT', '/tmp')
    facepng = os.path.join(out, 'face_normal.png'); face_paint.paint('normal').convert('RGB').save(facepng)
    skin_face = material('skin_face', '#f7cdb2', rough=0.55, sss=0.3, image=facepng)
    skin = material('skin', '#f7cdb2', rough=0.55, sss=0.3)
    blush = material('ear_in', '#f4b3a3', rough=0.6, sss=0.3)
    knit = material('knit', '#efe1c6', rough=0.92, sheen=0.7)
    denim = material('denim', '#5a82bb', rough=0.85, sheen=0.25)
    denim_in = material('denim_in', '#8eacd6', rough=0.85, sheen=0.2)
    shoe = material('shoe', '#fbf8f1', rough=0.55)
    sole = material('sole', '#eadfca', rough=0.75)
    tan = material('tan', '#d89a59', rough=0.6)
    hair_m = [material(f'hair{i}', c, rough=0.5, sheen=0.5, coat=0.08) for i, c in enumerate(('#2e1910', '#3b2216', '#4a2b1b'))]
    leather = material('leather', '#9a5c38', rough=0.5, coat=0.25)
    leather_d = material('leather_d', '#7c482b', rough=0.55, coat=0.2)
    petal = material('petal', '#ffffff', rough=0.5, sss=0.2)
    gold = material('gold', '#f4c23e', rough=0.5)
    parts = {}                                     # name -> (object, weighting rule)

    # --- head: wide and soft, chubby cheeks, small round chin; front-projected UVs carry the face
    def head_shape(d):
        k = 1.0
        for sx in (-1, 1):                          # cheeks
            k += 0.075 * math.exp(-((d.x - sx * 0.55) ** 2 + (d.y + 0.62) ** 2 + (d.z + 0.38) ** 2) / 0.09)
        k -= 0.05 * math.exp(-((d.x) ** 2 + (d.y + 0.35) ** 2 + (d.z + 0.92) ** 2) / 0.12)   # a small chin
        k += 0.02 * max(0, d.z) ** 2                # a rounder crown
        return k
    head = blob('head', HEAD, (HRX, HRY, HRZ), skin_face, seg=44, shape=head_shape)
    uv = head.data.uv_layers.new(name='UV')
    for poly in head.data.polygons:
        for li in poly.loop_indices:
            co = head.data.vertices[head.data.loops[li].vertex_index].co
            uv.data[li].uv = (0.5 + co.x / (2 * face_paint.FACE_W), (co.z - face_paint.FACE_Z0) / face_paint.FACE_H)
    parts['head'] = (head, 'head')
    for sx in (-1, 1):
        ear = blob(f'ear{sx}', HEAD + Vector((sx * 0.43, 0.04, -0.05)), (0.06, 0.09, 0.11), skin, seg=20)
        parts[f'ear{sx}'] = (ear, 'head')
        inner = blob(f'earin{sx}', HEAD + Vector((sx * 0.455, 0.02, -0.05)), (0.025, 0.055, 0.07), blush, seg=16)
        parts[f'earin{sx}'] = (inner, 'head')
    nose = blob('nose', HEAD + Vector((0, -0.405, -0.125)), (0.026, 0.02, 0.018), skin, seg=16)
    parts['nose'] = (nose, 'head')
    neck = sweep('neck', [(0, 0, 1.15), (0, 0, 1.3)], [(0.085, 0.08)] * 2, skin, rings=6, segs=16)
    parts['neck'] = (neck, ('neck', 'head', 'chest'))

    # --- the jumper: oversized and blousy, dropped shoulders, ribbed through
    torso_path = [(0, 0, 0.7), (0, 0, 0.8), (0, 0, 0.95), (0, 0, 1.06), (0, 0, 1.14), (0, 0, 1.2), (0, 0, 1.25)]
    torso_r = [(0.33, 0.27), (0.375, 0.305), (0.37, 0.3), (0.35, 0.28), (0.32, 0.25), (0.25, 0.2), (0.15, 0.13)]
    jumper = sweep('jumper', torso_path, torso_r, knit, rings=18, segs=52, rib=(26, 0.035), caps=(False, False))
    parts['jumper'] = (jumper, ('hips', 'spine', 'chest', 'shoulder.L', 'shoulder.R'))
    hem = sweep('hem', [(0, 0, 0.66), (0, 0, 0.74)], [(0.335, 0.27), (0.35, 0.285)], knit, rings=6, segs=96, rib=(48, 0.04), caps=(False, False))
    parts['hem'] = (hem, ('hips', 'spine'))
    collar = sweep('collar', [(0, 0, 1.2), (0, 0, 1.27)], [(0.16, 0.14), (0.125, 0.115)], knit, rings=6, segs=64, rib=(36, 0.05), caps=(False, False))
    parts['collar'] = (collar, ('chest', 'neck'))
    for sx, nm in ((1, 'L'), (-1, 'R')):
        S, E, W, d = arm_points(sx)
        side = Vector((0, 1, 0))
        sl = sweep(f'sleeve.{nm}', [S - d * 0.06, S + d * 0.1, E, E + d * 0.14, W - d * 0.06],
                   [(0.12, 0.12), (0.155, 0.15), (0.165, 0.158), (0.158, 0.15), (0.14, 0.135)], knit,
                   rings=16, segs=28, side=side, rib=(14, 0.04), caps=(True, False))   # closed at the shoulder: it shows when the arm lifts
        parts[f'sleeve.{nm}'] = (sl, (f'shoulder.{nm}', f'upper_arm.{nm}', f'forearm.{nm}', f'hand.{nm}'))
        cuff = sweep(f'cuff.{nm}', [W - d * 0.08, W + d * 0.01], [(0.12, 0.115), (0.092, 0.088)], knit,
                     rings=6, segs=48, side=side, rib=(24, 0.06), caps=(False, False))
        parts[f'cuff.{nm}'] = (cuff, (f'forearm.{nm}', f'hand.{nm}'))
        # little mitten hands, the thumb forward
        hand = sweep(f'hand.{nm}', [W - d * 0.02, W + d * 0.05, W + d * 0.11], [(0.055, 0.042), (0.062, 0.045), (0.05, 0.038)], skin,
                     rings=8, segs=16, side=side)
        parts[f'handm.{nm}'] = (hand, (f'hand.{nm}',))
        thumb = sweep(f'thumb.{nm}', [W + d * 0.02 + Vector((0, -0.03, 0)), W + d * 0.05 + Vector((0, -0.07, 0))], [(0.022, 0.022), (0.02, 0.02)], skin, rings=5, segs=10)
        parts[f'thumb.{nm}'] = (thumb, (f'hand.{nm}',))

    # --- wide jeans with big double-rolled cuffs
    seat = sweep('seat', [(0, 0, 0.6), (0, 0, 0.72), (0, 0, 0.84)], [(0.26, 0.22), (0.3, 0.24), (0.3, 0.24)], denim, rings=6, segs=32, caps=(True, False))
    parts['seat'] = (seat, ('hips', 'thigh.L', 'thigh.R'))
    for sx, nm in ((1, 'L'), (-1, 'R')):
        H, K, A = leg_points(sx)
        leg = sweep(f'jeans.{nm}', [H + Vector((0, 0, 0.08)), H, K, A + Vector((0, 0, 0.06))],
                    [(0.155, 0.15), (0.16, 0.155), (0.158, 0.152), (0.17, 0.162)], denim, rings=14, segs=24, caps=(False, False), side=(0, 1, 0))
        parts[f'jeans.{nm}'] = (leg, ('hips', f'thigh.{nm}', f'shin.{nm}'))
        # one big roll: a thick band, fatter at the folded top edge
        roll = sweep(f'roll.{nm}', [A + Vector((0, 0, 0.01)), A + Vector((0, 0, 0.06)), A + Vector((0, 0, 0.12)), A + Vector((0, 0, 0.15))],
                     [(0.178, 0.17), (0.188, 0.178), (0.2, 0.19), (0.17, 0.162)], denim_in, rings=8, segs=28, caps=(False, False))
        parts[f'roll.{nm}'] = (roll, (f'shin.{nm}',))
        # chunky sneakers: a cream sole, a rounded white upper, laces, tan heel tab and side flash
        x = A.x
        so = sweep(f'sole.{nm}', [(x, 0.12, 0.035), (x, 0.0, 0.035), (x, -0.16, 0.035), (x, -0.25, 0.04)],
                   [(0.105, 0.04), (0.11, 0.04), (0.112, 0.04), (0.09, 0.035)], sole, rings=8, segs=16, side=(1, 0, 0))
        up = sweep(f'upper.{nm}', [(x, 0.1, 0.1), (x, 0.0, 0.11), (x, -0.13, 0.095), (x, -0.22, 0.075)],
                   [(0.1, 0.085), (0.105, 0.09), (0.1, 0.075), (0.075, 0.05)], shoe, rings=10, segs=18, side=(1, 0, 0))
        collar_s = sweep(f'shoecollar.{nm}', [(x, 0.03, 0.12), (x, 0.03, 0.2)], [(0.1, 0.09), (0.095, 0.085)], shoe, rings=4, segs=24, caps=(False, False))
        tab = blob(f'heeltab.{nm}', (x, 0.12, 0.15), (0.04, 0.02, 0.05), tan, seg=16)
        flash = sweep(f'flash.{nm}', [(x + sx * 0.104, 0.04, 0.08), (x + sx * 0.108, -0.04, 0.1), (x + sx * 0.1, -0.12, 0.085)],
                      [(0.008, 0.02)] * 3, tan, rings=8, segs=10, side=(1, 0, 0))
        for k in range(3):
            lace = blob(f'lace.{nm}{k}', (x, -0.06 - k * 0.045, 0.19 - k * 0.025), (0.05, 0.012, 0.012), shoe, seg=12)
            parts[f'lace.{nm}{k}'] = (lace, (f'foot.{nm}',))
        for o in (so, up, collar_s, tab, flash):
            parts[o.name] = (o, (f'foot.{nm}',))

    build_hair(parts, hair_m, petal, gold)

    # --- the backpack: soft brown leather, a rounded flap, a pocket with a daisy, straps
    PB = Vector((0, 0.33, 1.0))
    box = lambda n: (lambda d: 1 / (abs(d.x) ** n + abs(d.y) ** n + abs(d.z) ** n) ** (1 / n))   # a superellipsoid: a soft rounded box
    bag = blob('bag', PB, (0.25, 0.12, 0.27), leather, seg=28, shape=box(3.2))
    flap = blob('flap', PB + Vector((0, 0.015, 0.14)), (0.262, 0.125, 0.15), leather_d, seg=28, shape=box(3.0))
    pocket = blob('pocket', PB + Vector((0, 0.12, -0.1)), (0.16, 0.035, 0.1), leather_d, seg=20, shape=box(3.0))
    for o in (bag, flap, pocket): parts[o.name] = (o, ('chest',))
    daisy(parts, PB + Vector((0, 0.158, -0.09)), Vector((0, 1, 0)), 0.045, petal, gold, ('chest',))
    for sx in (-1, 1):
        st = sweep(f'strap{sx}', [(sx * 0.17, 0.25, 0.86), (sx * 0.24, -0.05, 0.92), (sx * 0.25, -0.24, 1.08), (sx * 0.2, -0.12, 1.2), (sx * 0.17, 0.2, 1.18)],
                   [(0.03, 0.009)] * 5, leather_d, rings=24, segs=8, normal_fn=lambda p: Vector((p.x, p.y, 0)).normalized())
        parts[st.name] = (st, ('chest', 'spine'))
    return parts

def daisy(parts, centre, facing, r, petal, gold, rule):
    rot = facing.to_track_quat('Z', 'Y')
    for i in range(9):
        a = i / 9 * 2 * math.pi
        p = blob(f'petal{len(parts)}_{i}', (0, 0, 0), (r * 0.48, r * 0.2, r * 0.08), petal, seg=12)
        p.rotation_euler = (rot @ Quaternion((0, 0, 1), a)).to_euler()
        p.location = Vector(centre) + rot @ Vector((math.cos(a) * r * 0.55, math.sin(a) * r * 0.55, 0))
        parts[p.name] = (p, rule)
    c = blob(f'heart{len(parts)}', Vector(centre) + rot @ Vector((0, 0, r * 0.06)), (r * 0.3, r * 0.3, r * 0.15), gold, seg=12)
    c.rotation_euler = rot.to_euler()
    parts[c.name] = (c, rule)

# ---------------------------------------------------------------- hair
def on_head(dirv, lift):
    """A point on the hair surface in direction dirv from the head centre."""
    d = dirv.normalized()
    rr = 1 / math.sqrt((d.x / HRX) ** 2 + (d.y / HRY) ** 2 + (d.z / HRZ) ** 2)
    return HEAD + d * (rr + lift)

def head_normal(p):
    return (p - HEAD).normalized()

SHELL = 0.06          # the shell's outer surface sits ~this far above the skull; strands lie just over it

def build_hair(parts, hm, petal, gold):
    shell_m = material('hair_shell', '#2e1910', rough=0.75, sheen=0.4)
    # the shell: the hair's volume over the skull, pulled up; the face stays clear
    shell = blob('hair_shell', HEAD + Vector((0, 0.02, 0.02)), (HRX + 0.03, HRY + 0.035, HRZ + 0.04), shell_m, seg=48)
    bm = bmesh.new(); bm.from_mesh(shell.data)
    c = HEAD
    def gone(v):
        d = (v.co - c); x, y, z = d.x / HRX, d.y / HRY, d.z / HRZ
        if z > 0.42: return False                  # crown
        if y > 0.2 and z > -0.66 + 0.75 * abs(x): return False     # the back, the nape curving up behind the ears
        if abs(x) > 0.62 and y > -0.35 and z > 0.12: return False   # over the ears' tops
        return True
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if gone(v)], context='VERTS'); bm.to_mesh(shell.data); bm.free()
    so = shell.modifiers.new('thick', 'SOLIDIFY'); so.thickness = 0.02; so.offset = -1
    shell.modifiers.move(len(shell.modifiers) - 1, 0)
    parts['hair_shell'] = (shell, ('head',))

    BUN = HEAD + Vector((0, 0.12, 0.47))           # the bun sits high, a little back
    # broad sculpted locks sweeping up from the hairline into the bun (Ghibli / AC: few, chunky, soft)
    def hairline(a):
        """elevation (radians) where the shell's edge is, at azimuth a (0 = front)"""
        x, y = math.sin(a), -math.cos(a)
        if y < -0.35: return 0.5                            # front: under the bangs
        if y < 0.2: return 0.16                             # over the ears
        return math.asin(max(-0.95, -0.66 + 0.75 * abs(x)))  # the nape, curving up behind the ears
    n = 26
    for i in range(n):
        a = (i + 0.5) / n * 2 * math.pi + R.uniform(-0.04, 0.04)
        start_dir = Vector((math.sin(a), -math.cos(a), 0))
        el0 = hairline(a) + 0.04
        pts = []
        for k in range(8):
            t = k / 7
            el = el0 + (1.32 - el0) * t
            dirv = start_dir * math.cos(el) + Vector((0, 0, 1)) * math.sin(el)
            p = on_head(dirv, SHELL + 0.004 + 0.022 * math.sin(t * math.pi) ** 0.7)
            p = p.lerp(BUN + (p - BUN).normalized() * 0.16, max(0, t - 0.72) / 0.28)
            pts.append(p)
        w = R.uniform(0.12, 0.15)
        o = sweep(f'lock{i}', pts, [(w * 0.55, 0.012), (w, 0.032), (w * 0.95, 0.036), (w * 0.7, 0.03), (w * 0.4, 0.02)], hm[i % 3],
                  rings=22, segs=10, normal_fn=head_normal)
        parts[o.name] = (o, ('head',))
    # little curls along the nape and behind the ears: a soft, lumpy hairline
    for i in range(12):
        a = math.pi + (i / 11 - 0.5) * 2.4
        start_dir = Vector((math.sin(a), -math.cos(a), 0))
        el = hairline(a) + 0.02
        p0 = on_head(start_dir * math.cos(el) + Vector((0, 0, 1)) * math.sin(el), SHELL + 0.005)
        nrm = head_normal(p0); dn = Vector((0, 0, -1)); sd = dn.cross(nrm).normalized()
        pts = [p0 + dn * (0.05 * math.sin(t * 2.4)) + sd * (0.03 * (1 - math.cos(t * 2.4))) + nrm * 0.01 * t for t in [k / 6 for k in range(7)]]
        o = sweep(f'napecurl{i}', pts, [(0.035, 0.016), (0.03, 0.014), (0.012, 0.008)], hm[i % 3], rings=12, segs=8, normal_fn=head_normal)
        parts[o.name] = (o, ('head',))

    # the bun: a fat cinnamon-roll spiral on a dome (the sheet's top view), lobes round its base
    core = blob('bun_core', BUN + Vector((0, 0, 0.0)), (0.25, 0.24, 0.17), hm[0], seg=32)
    parts['bun_core'] = (core, ('bun',))
    def dome(r, a, lift=0.0):
        return BUN + Vector((math.cos(a) * r, math.sin(a) * r, math.sqrt(max(0, 0.27 ** 2 - r * r)) * 0.62 - 0.0 + lift))
    # two interleaved spirals winding in to a closed, raised centre
    for j in range(2):
        ph = j * math.pi
        spiral = [dome(0.25 * (1 - k / 44) ** 0.9, ph + 0.6 + k / 44 * 2.0 * 2 * math.pi, 0.03 + 0.012 * (k / 44) ** 3) for k in range(45)]
        o = sweep(f'bun_spiral{j}', spiral, [(0.075, 0.055), (0.09, 0.065), (0.085, 0.065), (0.075, 0.065), (0.07, 0.07)], hm[1 + j], rings=90, segs=10,
                  normal_fn=lambda p: (p - BUN).normalized())
        parts[o.name] = (o, ('bun',))
    for i in range(3):                                 # a couple of loose wisps escaping the bun
        a0 = R.uniform(0, 6.28)
        pts = [dome(0.18 + 0.1 * t, a0 + t * 1.6, 0.06 * math.sin(t * 3)) for t in [k / 8 for k in range(9)]]
        o = sweep(f'bunwisp{i}', pts, [(0.018, 0.01), (0.012, 0.008), (0.004, 0.004)], hm[2], rings=16, segs=6)
        parts[o.name] = (o, ('bun',))

    # bangs: six soft locks swept from a side part, tips turning under in a gentle curl
    part = Vector((-0.12, -0.6, 0.86))
    for i in range(6):
        f = i / 5
        x_end = -0.62 + f * 1.3
        ln = 0.95 - abs(f - 0.45) * 0.35
        pts = []
        for k in range(9):
            t = k / 8
            dirv = part.lerp(Vector((x_end, -1.0, 0.24 + 0.2 * abs(x_end))), t * ln)
            dirv += Vector((0.06 * math.sin(t * math.pi) * (1 if f > 0.25 else -1), 0, 0.03 * math.sin(t * 2 * math.pi + i)))
            pts.append(on_head(dirv, SHELL + 0.026 - 0.03 * t ** 2))
        tip, prev = pts[-1], pts[-2]
        tdir = (tip - prev).normalized(); nrm = head_normal(tip)
        for k in range(1, 4):                            # turn under: toward the face, then back up a touch
            a2 = k / 3 * math.pi * 0.75
            pts.append(tip + tdir * math.sin(a2) * 0.03 + nrm * (1 - math.cos(a2)) * 0.022)
        w = R.uniform(0.1, 0.12)
        o = sweep(f'bang{i}', pts, [(w * 0.6, 0.016), (w, 0.03), (w * 0.95, 0.03), (w * 0.75, 0.026), (w * 0.4, 0.016)],
                  hm[i % 3], rings=30, segs=10, normal_fn=head_normal)
        parts[o.name] = (o, ('head',))
    # temple tendrils: soft loose S-curls from the hair's edge, just in front of the ears
    for sx in (-1, 1):
        for k in range(2):
            top = on_head(Vector((sx * 0.9, -0.32 + k * 0.2, 0.22)), SHELL + 0.005)
            pts = []
            for j in range(11):
                t = j / 10
                p = top + Vector((sx * (0.012 + 0.03 * t), -0.035 * math.sin(t * 2.4 * math.pi + k), -t * (0.3 - k * 0.07)))
                pts.append(p)
            o = sweep(f'tendril{sx}{k}', pts, [(0.032, 0.02), (0.03, 0.018), (0.022, 0.014), (0.01, 0.008)], hm[2 - k], rings=30, segs=8,
                      normal_fn=lambda p, sx=sx: Vector((sx, -0.2, 0)).normalized())
            parts[o.name] = (o, ('head',))
    # wisps at the nape
    for k in range(4):
        x = -0.18 + k * 0.12
        top = on_head(Vector((x, 0.8, -0.55)), 0.03)
        pts = [top + Vector((0.02 * math.sin(t * 6 + k), 0.015 * t, -t * 0.12)) for t in [j / 6 for j in range(7)]]
        o = sweep(f'wisp{k}', pts, [(0.022, 0.01), (0.012, 0.006)], hm[k % 3], rings=10, segs=6, normal_fn=head_normal)
        parts[o.name] = (o, ('head',))
    # the daisy clip, on her left above the ear
    daisy(parts, on_head(Vector((0.72, -0.45, 0.55)), SHELL + 0.055), Vector((0.72, -0.45, 0.55)), 0.075, petal, gold, ('head',))

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
    bone('hips', (0, 0, 0.74), (0, 0, 0.86), 'root')
    bone('spine', (0, 0, 0.86), (0, 0, 1.0), 'hips')
    bone('chest', (0, 0, 1.0), (0, 0, 1.16), 'spine')
    bone('neck', (0, 0, 1.16), (0, 0, 1.3), 'chest')
    bone('head', (0, 0, 1.3), (0, 0, 1.8), 'neck')
    bone('bun', HEAD + Vector((0, 0.08, 0.3)), HEAD + Vector((0, 0.16, 0.58)), 'head')
    for sx, nm in ((1, 'L'), (-1, 'R')):
        S, E, W, d = arm_points(sx)
        bone(f'shoulder.{nm}', (sx * 0.05, 0, 1.13), S, 'chest')
        bone(f'upper_arm.{nm}', S, E, f'shoulder.{nm}')
        bone(f'forearm.{nm}', E, W, f'upper_arm.{nm}')
        bone(f'hand.{nm}', W, W + d * 0.12, f'forearm.{nm}')
        H, K, A = leg_points(sx)
        bone(f'thigh.{nm}', H, K, 'hips')
        bone(f'shin.{nm}', K, A, f'thigh.{nm}')
        bone(f'foot.{nm}', A, (A.x, -0.18, 0.05), f'shin.{nm}')
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

ARMS_DOWN = math.radians(24)                         # from the 38° rest to hanging relaxed

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
    s.view_settings.view_transform = 'AgX'; s.view_settings.look = 'AgX - Punchy'; s.view_settings.exposure = -0.15
    w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (1, 0.93, 0.86, 1); bg.inputs[1].default_value = 0.9
    for loc, e, size, col in (((-2.5, -4, 4.5), 700, 3.5, (1, 0.95, 0.88)), ((4, -2.5, 2.2), 220, 4, (0.88, 0.92, 1)), ((0.5, 4.5, 3.5), 420, 2.5, (1, 0.9, 0.8))):
        d = bpy.data.lights.new('l', 'AREA'); d.energy = e; d.size = size; d.color = col
        o = link(bpy.data.objects.new('l', d)); o.location = loc
        o.rotation_euler = (Vector((0, 0, 1.2)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=30); bpy.context.object.is_shadow_catcher = True
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = 2.9
    co = link(bpy.data.objects.new('cam', cam)); s.camera = co
    s.render.resolution_x, s.render.resolution_y = res
    return co

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
        co.location = (math.sin(a) * d, -math.cos(a) * d, 1.25 + d * 0.1)
        co.rotation_euler = (Vector((0, 0, 1.25)) - co.location).to_track_quat('-Z', 'Y').to_euler()
        s.render.filepath = os.path.join(out, f'{pose}_{name}.png'); bpy.ops.render.render(write_still=True)

def export(path):
    os.environ['OUT'] = os.path.dirname(path) or '.'
    parts = build(); rig = build_rig(parts); animate(rig)
    # for a phone: no subdivision on the small dense parts (smooth shading carries them)
    small = ('lock', 'bang', 'tendril', 'napecurl', 'wisp', 'bun', 'petal', 'heart', 'lace', 'strap', 'thumb', 'flash', 'ear', 'nose', 'hair_shell')
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.name.startswith(small):
            for m in [m for m in o.modifiers if m.type == 'SUBSURF']: o.modifiers.remove(m)
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
    if cmd == 'export': export(args[1])
