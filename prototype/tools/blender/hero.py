# The heroine, modelled to design/ref_hero-girl.jpg: a chibi with a big curly
# bun and a daisy clip, a chunky cream knit jumper, rolled-up jeans, white
# sneakers and a little brown backpack.
#
# Game units (1 = the game's character unit, ~2.9 tall), modelled facing -Y
# (glTF's +Z after export). The head is a 0.78 sphere centred at 1.95 so the
# game's drawn faces (characters.js faceTexture) sit on it exactly.
# Parts are separate objects under named empties the game animates:
#   body > (torso, legs, backpack) · head > (skull, hair, ears) · arm_L / arm_R (pivot at the shoulder)
#
#   python hero.py render <outdir>     turnaround renders to check against the sheet
#   python hero.py export <file.glb>

import bpy, bmesh, math, random, sys, os
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(__file__))
from food import srgb

HEAD_Y, HEAD_R = 2.72, 0.78       # measured off the sheet: head ≈ 45% of her height with the bun
R = random.Random(11)

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, hexcol, rough=0.6, sss=0.0, sheen=0.0, coat=0.0):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*srgb(hexcol), 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Subsurface Weight'].default_value = sss
    p.inputs['Subsurface Radius'].default_value = (1, 0.4, 0.25)
    p.inputs['Subsurface Scale'].default_value = 0.05
    p.inputs['Sheen Weight'].default_value = sheen
    p.inputs['Coat Weight'].default_value = coat
    return m

def empty(name, parent=None, loc=(0, 0, 0)):
    o = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(o)
    o.location = loc
    if parent: o.parent = parent
    return o

def adopt(o, parent, name=None):
    """Parent keeping the world transform."""
    bpy.context.view_layer.update()
    mw = o.matrix_world.copy(); o.parent = parent; o.matrix_world = mw
    if name: o.name = name
    return o

def smooth(o, sub=2):
    for f in o.data.polygons: f.use_smooth = True
    if sub:
        m = o.modifiers.new('sub', 'SUBSURF'); m.levels = m.render_levels = sub
    return o

def lathe(name, prof, m, segs=48, loc=(0, 0, 0), scale=(1, 1, 1), cap_top=True, cap_bottom=True):
    """Revolve [(r, z)] round Z."""
    bm = bmesh.new(); rings = []
    for r, z in prof:
        rings.append([bm.verts.new((math.cos(j / segs * 6.2832) * r, math.sin(j / segs * 6.2832) * r, z)) for j in range(segs)])
    for a, b in zip(rings, rings[1:]):
        for j in range(segs): bm.faces.new((a[j], a[(j + 1) % segs], b[(j + 1) % segs], b[j]))
    if cap_bottom: bm.faces.new(rings[0][::-1])
    if cap_top: bm.faces.new(rings[-1])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    o.location = loc; o.scale = scale; o.data.materials.append(m)
    return o

def sphere(name, r, m, loc, scale=(1, 1, 1), seg=24, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=r, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = scale; o.data.materials.append(m)
    for f in o.data.polygons: f.use_smooth = True
    return o

def tube(name, pts, radius, m, taper=None, res=6, bevel_res=4):
    """A curve with a round bevel through pts (Bezier, auto handles); taper(t) scales the radius."""
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    cu.bevel_depth = radius; cu.bevel_resolution = bevel_res; cu.use_fill_caps = True; cu.resolution_u = res
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for i, (bp, p) in enumerate(zip(sp.bezier_points, pts)):
        bp.co = Vector(p); bp.handle_left_type = bp.handle_right_type = 'AUTO'
        bp.radius = taper(i / (len(pts) - 1)) if taper else 1
    o = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(m)
    return o

def ribs(o, count, depth, axis='Z', twist=0.0):
    """Knit ribbing: a wave displacement running round the part (real geometry, reads in any light)."""
    tex = bpy.data.textures.new(o.name + '_rib', 'WOOD')
    tex.wood_type = 'BANDNOISE' if twist else 'BANDS'; tex.noise_basis_2 = 'SIN'; tex.turbulence = twist
    d = o.modifiers.new('rib', 'DISPLACE'); d.texture = tex; d.strength = depth; d.mid_level = 0.5
    d.texture_coords = 'LOCAL'
    # wood bands run along x+y; rotate the texture space so bands wrap round the axis
    tex_space = empty(o.name + '_ribspace'); tex_space.parent = o
    tex_space.scale = (1 / count, 1 / count, 1 / count); tex_space.rotation_euler = (0, math.pi / 2, 0) if axis == 'Z' else (0, 0, 0)
    d.texture_coords = 'OBJECT'; d.texture_coords_object = tex_space
    return o

# ---------------------------------------------------------------- the build
def build():
    clear()
    skin = material('skin', '#ffd6bb', rough=0.55, sss=0.35)
    knit = material('knit', '#f2e4cb', rough=0.9, sheen=0.6)
    denim = material('denim', '#5d84bb', rough=0.85, sheen=0.2)
    denim_in = material('denim_in', '#9bb8de', rough=0.85)
    shoe = material('shoe', '#fbf8f2', rough=0.5)
    sole = material('sole', '#e6dccb', rough=0.7)
    tan = material('tan', '#d79a55', rough=0.6)
    hair = material('hair', '#3a2116', rough=0.5, sheen=0.5)
    hair_hi = material('hair_hi', '#4d2e1d', rough=0.5, sheen=0.5)
    leather = material('leather', '#93593a', rough=0.55, coat=0.2)
    leather_d = material('leather_d', '#7a4529', rough=0.6)
    petal = material('petal', '#ffffff', rough=0.5, sss=0.2)
    gold = material('gold', '#f3c33c', rough=0.5)

    root = empty('hero')
    body = empty('body', root)
    head = empty('head', root, (0, 0, HEAD_Y))

    # --- legs: wide jeans, rolled cuffs, sneakers
    for side, name in ((1, 'L'), (-1, 'R')):
        x = side * 0.23
        legp = empty(f'leg_{name}', root, (x, 0, 1.08))
        leg = lathe(f'jeans_{name}', [(0.21, 0.3), (0.235, 0.45), (0.245, 0.7), (0.245, 0.95), (0.23, 1.1)], denim, loc=(x, 0, 0))
        adopt(smooth(leg, 1), legp)
        cuff = lathe(f'cuff_{name}', [(0.21, 0.2), (0.27, 0.22), (0.285, 0.3), (0.275, 0.38), (0.22, 0.4)], denim_in, loc=(x, 0, 0))
        adopt(smooth(cuff, 1), legp)
        # sneaker: a rounded upper on a thick sole, a tan heel tab and lace bumps
        up = sphere(f'shoe_{name}', 0.21, shoe, (x, -0.06, 0.13), (1, 1.35, 0.68))
        adopt(up, legp)
        so = lathe(f'sole_{name}', [(0.21, 0.0), (0.225, 0.02), (0.225, 0.07), (0.21, 0.075)], sole, segs=32, loc=(x, -0.06, 0), scale=(1, 1.35, 1))
        adopt(smooth(so, 1), legp)
        tab = sphere(f'heel_{name}', 0.07, tan, (x, 0.2, 0.16), (1.0, 0.45, 1.1)); adopt(tab, legp)
        for k in range(3):
            lace = sphere(f'lace_{name}{k}', 0.04, shoe, (x, -0.12 - k * 0.07, 0.25 - k * 0.035), (1.7, 0.7, 0.55), seg=12); adopt(lace, legp)

    # --- the jumper: a chunky bell, ribbed hem and collar, cable-ish ribs
    torso = lathe('jumper', [(0.45, 1.0), (0.58, 1.04), (0.63, 1.2), (0.63, 1.5), (0.6, 1.72), (0.5, 1.88), (0.34, 1.97), (0.24, 2.0)], knit, segs=64)
    smooth(torso, 2); ribs(torso, 26, 0.022)
    adopt(torso, body)
    hem = lathe('hem', [(0.44, 0.94), (0.58, 0.95), (0.6, 0.98), (0.6, 1.07), (0.57, 1.09)], knit, segs=64)
    smooth(hem, 1); ribs(hem, 60, 0.02); adopt(hem, body)
    collar = lathe('collar', [(0.22, 1.93), (0.34, 1.95), (0.35, 2.03), (0.3, 2.06), (0.22, 2.05)], knit, segs=48)
    smooth(collar, 1); ribs(collar, 48, 0.015); adopt(collar, body)

    # --- arms: puffy knit sleeves with ribbed cuffs, small round hands; pivot at the shoulder
    for side, name in ((1, 'L'), (-1, 'R')):
        SH = (side * 0.6, 0, 1.8)
        piv = empty(f'arm_{name}', root, SH)
        sl = lathe(f'sleeve_{name}', [(0.12, 0.04), (0.2, -0.02), (0.235, -0.25), (0.22, -0.5), (0.17, -0.62)], knit, segs=32, loc=SH)
        sl.rotation_euler = (0, side * 0.1, 0)
        smooth(sl, 2); ribs(sl, 30, 0.016, twist=0.0); adopt(sl, piv)
        cf = lathe(f'scuff_{name}', [(0.15, -0.6), (0.175, -0.61), (0.175, -0.7), (0.14, -0.72)], knit, segs=32, loc=SH)
        cf.rotation_euler = sl.rotation_euler
        smooth(cf, 1); ribs(cf, 60, 0.012); adopt(cf, piv)
        hand = sphere(f'hand_{name}', 0.13, skin, (side * 0.68, 0, 1.8 - 0.8), (0.95, 0.85, 1.05)); adopt(hand, piv)
        thumb = sphere(f'thumb_{name}', 0.055, skin, (side * 0.63, -0.09, 1.8 - 0.73), (0.9, 0.9, 1.2)); adopt(thumb, piv)

    # --- backpack: soft leather, a rounded flap, a front pocket with a daisy; straps over the shoulders
    PY, PZ = 0.6, 1.45
    pack = empty('backpack', body, (0, PY, PZ))
    bag = lathe('bag', [(0.0, -0.33), (0.3, -0.32), (0.36, -0.22), (0.36, 0.14), (0.31, 0.28), (0.0, 0.31)], leather, segs=40,
                loc=(0, PY, PZ), scale=(1.0, 0.55, 1.0))
    smooth(bag, 2); adopt(bag, pack)
    flap = sphere('flap', 0.34, leather_d, (0, PY - 0.03, PZ + 0.21), (1.07, 0.62, 0.42)); adopt(flap, pack)
    pocket = lathe('pocket', [(0.0, -0.12), (0.2, -0.12), (0.22, -0.05), (0.22, 0.07), (0.0, 0.09)], leather_d, segs=32,
                   loc=(0, PY + 0.19, PZ - 0.14), scale=(1, 0.35, 1))
    smooth(pocket, 2); adopt(pocket, pack)
    for side in (1, -1):
        st = tube(f'strap_{side}', [(side * 0.3, 0.5, 1.2), (side * 0.42, 0.0, 1.3), (side * 0.4, -0.55, 1.6), (side * 0.3, -0.1, 1.97), (side * 0.27, 0.45, 1.78)], 0.04, leather_d)
        st.data.bevel_resolution = 2
        adopt(st, body)
    daisy(pack, (0, PY + 0.27, PZ - 0.12), petal, gold, 0.08, facing=Vector((0, 1, 0)))

    # --- head: the 0.78 sphere (the game's face goes on its front), ears, cheeks under the face
    skull = sphere('skull', HEAD_R, skin, (0, 0, HEAD_Y), seg=48); adopt(skull, head)
    for side in (1, -1):
        ear = sphere(f'ear_{side}', 0.15, skin, (side * 0.77, 0.04, HEAD_Y - 0.05), (0.5, 0.8, 1.0)); adopt(ear, head)

    build_hair(head, hair, hair_hi)
    daisy(head, (-0.5, -0.6, HEAD_Y + 0.5), petal, gold, 0.12, facing=Vector((-0.5, -0.8, 0.35)))
    return root

def daisy(parent, loc, petal, gold, r, facing):
    """A little daisy: eight petals and a gold heart, turned to face `facing`."""
    bpy.context.view_layer.update()
    g = empty('daisy', parent); g.location = parent.matrix_world.inverted() @ Vector(loc)
    g.rotation_euler = facing.to_track_quat('Z', 'Y').to_euler()
    for i in range(8):
        a = i / 8 * 6.2832
        p = sphere(f'petal{i}', r * 0.42, petal, (0, 0, 0), (1.0, 0.45, 0.22), seg=12)
        p.parent = g; p.location = (math.cos(a) * r * 0.62, math.sin(a) * r * 0.62, 0); p.rotation_euler = (0, 0, a)
    c = sphere('heart', r * 0.32, gold, (0, 0, 0), (1, 1, 0.6), seg=12); c.parent = g; c.location = (0, 0, r * 0.1)
    return g

def curl(name, centre, axis_dir, radius, turns, length, thick, m, taper=True):
    """One springy ringlet: a helix along axis_dir."""
    ax = Vector(axis_dir).normalized()
    u = ax.orthogonal().normalized(); v = ax.cross(u)
    pts = []
    n = max(6, int(turns * 8))
    for i in range(n + 1):
        t = i / n; a = t * turns * 6.2832
        rr = radius * (1 - 0.35 * t)
        p = Vector(centre) + ax * (t * length) + u * math.cos(a) * rr + v * math.sin(a) * rr
        pts.append(tuple(p))
    return tube(name, pts, thick, m, taper=(lambda t: 1.0 - 0.55 * t) if taper else None, res=4, bevel_res=3)

def build_hair(head, hair, hair_hi):
    c = Vector((0, 0, HEAD_Y))
    # the cap: a dome over the skull framing the face, down past the ears at the back
    r = HEAD_R + 0.035
    cap = sphere('hair_cap', r, hair, tuple(c), seg=64)
    bm = bmesh.new(); bm.from_mesh(cap.data)
    def gone(v):
        # an updo: everything pulled up into the bun. Hair on top, at the back
        # down to the nape, and over the sides only above the ears.
        x, y, z = v.co.x / r, v.co.y / r, v.co.z / r
        if z > 0.38: return False
        if y > 0.25 and z > -0.6: return False
        if abs(x) > 0.5 and y > -0.3 and z > 0.08: return False
        return True
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if gone(v)], context='VERTS'); bm.to_mesh(cap.data); bm.free()
    sol = cap.modifiers.new('thick', 'SOLIDIFY'); sol.thickness = 0.045; sol.offset = 1
    smooth(cap, 2)
    tex = bpy.data.textures.new('comb', 'WOOD'); tex.wood_type = 'BANDNOISE'; tex.turbulence = 2; tex.noise_scale = 0.12
    d = cap.modifiers.new('comb', 'DISPLACE'); d.texture = tex; d.strength = 0.006
    adopt(cap, head)

    # combed strands sweeping up from the nape and temples into the bun
    bc = c + Vector((0, 0.08, HEAD_R + 0.25))
    for i in range(26):
        a = math.pi / 2 + (i / 25 - 0.5) * 4.2 + R.uniform(-0.05, 0.05)   # round the back and sides
        e0 = R.uniform(-0.62, -0.3) if abs(math.cos(a)) < 0.6 else R.uniform(0.0, 0.25)
        pts = []
        for k in range(6):
            t = k / 5
            el = e0 + t * (0.78 - e0)                            # from low on the head up to the crown
            rr = r + 0.03
            p = c + Vector((math.cos(a) * math.cos(el) * rr, math.sin(a) * math.cos(el) * rr, math.sin(el) * rr))
            p = p.lerp(bc + (p - bc).normalized() * 0.3, max(0, t - 0.75) * 3)   # gathered into the bun
            pts.append(tuple(p))
        if pts[0][1] - c.y < -0.25 and pts[0][2] - c.z < 0.3: continue   # keep the face clear
        o = tube(f'strand{i}', pts, 0.04, hair if i % 2 else hair_hi, taper=lambda t: 0.25 + 0.75 * min(1, t * 2.5), res=4, bevel_res=2)
        adopt(o, head)

    # the bun: a big puffy nest of thick ringlets sitting on top
    bc = c + Vector((0, 0.08, HEAD_R + 0.25))
    core = sphere('bun_core', 0.4, hair, tuple(bc), (1.08, 1.0, 0.85), seg=32); adopt(core, head)
    for i in range(34):
        a = i / 34 * 6.2832 * 2.6 + R.uniform(-0.2, 0.2)
        el = -0.35 + (i / 34) * 1.6 + R.uniform(-0.1, 0.1)
        dirv = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el) * 0.85))
        start = bc + dirv * 0.34
        tang = dirv.cross(Vector((0, 0, 1))).normalized() if abs(dirv.z) < 0.95 else Vector((1, 0, 0))
        tang = (tang + Vector((R.uniform(-.3, .3), R.uniform(-.3, .3), R.uniform(-.3, .3)))).normalized()
        o = curl(f'bun_curl{i}', start, tang, R.uniform(0.085, 0.11), R.uniform(1.0, 1.6), R.uniform(0.2, 0.3), 0.07, hair if i % 3 else hair_hi)
        adopt(o, head)
    # a few loops round the base where the bun meets the head
    for i in range(10):
        a = i / 10 * 6.2832
        p = bc + Vector((math.cos(a) * 0.36, math.sin(a) * 0.34, -0.22))
        o = curl(f'bun_base{i}', p, Vector((-math.sin(a), math.cos(a), 0.1)), 0.08, 1.1, 0.22, 0.065, hair)
        adopt(o, head)
    # bangs: curly locks across the forehead down to the brows, parted off centre
    for i in range(9):
        x = -0.6 + i * 0.15 + R.uniform(-0.02, 0.02)
        ang = x / r
        top = c + Vector((math.sin(ang) * 0.82, -math.cos(ang) * 0.6, 0.55 - abs(x) * 0.22))
        o = curl(f'bang{i}', top, Vector((x * 0.3, -0.45, -1.0)), R.uniform(0.075, 0.095), R.uniform(0.9, 1.3), 0.3 - abs(x) * 0.08, 0.07, hair if i % 2 else hair_hi)
        adopt(o, head)
    # side locks framing the cheeks, and long springy tendrils past the ears
    for side in (1, -1):
        o = curl(f'sidelock{side}', c + Vector((side * 0.7, -0.38, 0.3)), Vector((side * 0.1, -0.15, -1.0)), 0.075, 1.6, 0.45, 0.065, hair)
        adopt(o, head)
        for k in range(2):
            top = c + Vector((side * (0.8 - k * 0.04), -0.05 + k * 0.25, 0.15))
            o = curl(f'tendril{side}{k}', top, Vector((side * 0.12, -0.05, -1.0)), 0.07, 2.4 - k * 0.6, 0.65 - k * 0.15, 0.05, hair)
            adopt(o, head)
    # wisps at the nape
    for k in range(5):
        x = -0.4 + k * 0.2
        o = curl(f'nape{k}', c + Vector((x, 0.62, -0.42)), Vector((0, 0.25, -1)), 0.06, 1.2, 0.22, 0.05, hair)
        adopt(o, head)

def face_decal(head, png):
    """The game's drawn face on the same sphere patch characters.js uses
    (three.js SphereGeometry(0.785, 32, 20, π/2-0.68, 1.36, π/2-0.5, 1.0)), for previews."""
    ws, hs, r = 32, 20, 0.785
    p0, pl, t0, tl = math.pi / 2 - 0.68, 1.36, math.pi / 2 - 0.5, 1.0
    bm = bmesh.new(); uv = bm.loops.layers.uv.new()
    grid = []
    for i in range(hs + 1):
        row = []
        for j in range(ws + 1):
            u, v = j / ws, i / hs
            phi, th = p0 + u * pl, t0 + v * tl
            x3, y3, z3 = -r * math.cos(phi) * math.sin(th), r * math.cos(th), r * math.sin(phi) * math.sin(th)
            row.append((bm.verts.new((x3, -z3, y3 + HEAD_Y)), (u, 1 - v)))
        grid.append(row)
    for i in range(hs):
        for j in range(ws):
            q = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]
            f = bm.faces.new([a for a, _ in q])
            for loop, (_, t) in zip(f.loops, q): loop[uv].uv = t
    me = bpy.data.meshes.new('face'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('face', me); bpy.context.scene.collection.objects.link(o)
    for f in me.polygons: f.use_smooth = True
    m = bpy.data.materials.new('face'); m.use_nodes = True; nt = m.node_tree
    img = nt.nodes.new('ShaderNodeTexImage'); img.image = bpy.data.images.load(png)
    em = nt.nodes['Principled BSDF']
    nt.links.new(img.outputs['Color'], em.inputs['Base Color']); nt.links.new(img.outputs['Alpha'], em.inputs['Alpha'])
    em.inputs['Roughness'].default_value = 0.6
    m.blend_method = 'BLEND'
    o.data.materials.append(m)
    adopt(o, head)
    return o

# ---------------------------------------------------------------- render / export
def studio():
    s = bpy.context.scene
    s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = int(os.environ.get('SAMPLES', 48)); s.cycles.use_denoising = True
    s.render.film_transparent = True
    s.view_settings.view_transform = 'AgX'; s.view_settings.look = 'AgX - Punchy'; s.view_settings.exposure = 0.0
    w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (1, 0.92, 0.84, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.6
    for loc, e, size, col in (((-3, -4, 5), 900, 3, (1, 0.94, 0.86)), ((4, -2, 2.5), 250, 4, (0.85, 0.9, 1)), ((0, 5, 4), 500, 2, (1, 0.9, 0.8))):
        d = bpy.data.lights.new('l', 'AREA'); d.energy = e; d.size = size; d.color = col
        o = bpy.data.objects.new('l', d); s.collection.objects.link(o); o.location = loc
        o.rotation_euler = (Vector((0, 0, 1.5)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=30); bpy.context.object.is_shadow_catcher = True
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = 4.6
    co = bpy.data.objects.new('cam', cam); s.collection.objects.link(co); s.camera = co
    s.render.resolution_x, s.render.resolution_y = 520, 620
    return co

def render(out):
    root = build(); co = studio(); s = bpy.context.scene
    if os.environ.get('FACE'): face_decal(bpy.data.objects['head'], os.environ['FACE'])
    os.makedirs(out, exist_ok=True)
    views = [('front', 0), ('three', 35), ('side', 90), ('back', 180)]
    for name, deg in views:
        a = math.radians(deg); d = 12
        co.location = (math.sin(a) * d, -math.cos(a) * d, 1.9 + d * 0.12)
        co.rotation_euler = (Vector((0, 0, 1.9)) - co.location).to_track_quat('-Z', 'Y').to_euler()
        s.render.filepath = os.path.join(out, f'hero_{name}.png'); bpy.ops.render.render(write_still=True)

def export(path):
    """One mesh per material under each moving part, light enough for a phone."""
    build()
    vl = bpy.context.view_layer
    # curves → meshes; subdivision at 1 for the game
    for o in list(bpy.data.objects):
        for m in getattr(o, 'modifiers', []):
            if m.type == 'SUBSURF': m.levels = min(m.levels, 1)
    for o in list(bpy.data.objects):
        if o.type == 'CURVE':
            o.data.resolution_u = 3; o.data.bevel_resolution = min(o.data.bevel_resolution, 2)
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.data.objects:
        if o.type in ('MESH', 'CURVE'): o.select_set(True); vl.objects.active = o
    bpy.ops.object.convert(target='MESH')          # applies modifiers too
    # join by (part, material)
    parts = ['body', 'head', 'arm_L', 'arm_R', 'leg_L', 'leg_R', 'backpack']
    def part_of(o):
        p = o.parent
        while p and p.name not in parts and p.name != 'daisy': p = p.parent
        while p and p.name not in parts: p = p.parent
        return p
    groups = {}
    for o in [o for o in bpy.data.objects if o.type == 'MESH']:
        p = part_of(o)
        if not p: continue
        key = (p.name, o.data.materials[0].name if o.data.materials else 'none')
        groups.setdefault(key, []).append(o)
    for (pn, mn), objs in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs: o.select_set(True)
        vl.objects.active = objs[0]
        if len(objs) > 1: bpy.ops.object.join()
        j = vl.objects.active; j.name = f'{pn}_{mn}'
        mw = j.matrix_world.copy(); j.parent = bpy.data.objects[pn]; j.matrix_world = mw
    for o in bpy.data.objects:
        if o.type == 'MESH' and 'hair' in o.name:        # curls are dense: collapse to a third, the shape holds
            d = o.modifiers.new('dec', 'DECIMATE'); d.ratio = 0.3
            vl.objects.active = o; bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
            bpy.ops.object.modifier_apply(modifier='dec')
    for o in sorted([o for o in bpy.data.objects if o.type == 'MESH'], key=lambda o: -len(o.data.polygons))[:12]:
        print('part', o.name, sum(len(p.vertices) - 2 for p in o.data.polygons))
    tris = sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == 'MESH' for p in o.data.polygons)
    print('triangles', tris)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True,
                              export_extras=False, export_cameras=False, export_lights=False)

if __name__ == '__main__':
    cmd, out = sys.argv[-2], sys.argv[-1]
    if cmd == 'render': render(out)
    if cmd == 'export': export(out)
