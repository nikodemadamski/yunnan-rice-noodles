# Orthographic front / three-quarter / side / back renders of a character,
# transparent background, the same scale every time (super_prompt.pdf §6).
#
#   python tools/render_views.py <model.glb|.blend> <out_prefix> [samples]
#     -> <out_prefix>_front.png, _three.png, _side.png, _back.png
#
# The model is normalised first: height 1.0, feet on Z = 0, centred in X/Y,
# facing -Y (the concept's front view looks at her face). Side = her left side
# (the concept's side view, with the flower clip, faces screen-left).

import bpy, sys, os, math
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
src, prefix = args[0], args[1]
samples = int(args[2]) if len(args) > 2 else 32

if src.endswith('.blend'):
    bpy.ops.wm.open_mainfile(filepath=src)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)

meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.visible_get()]
dg = bpy.context.evaluated_depsgraph_get()
pts = [o.matrix_world @ v.co for o in meshes for v in o.evaluated_get(dg).to_mesh().vertices]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
if os.environ.get('NORMALISE', '1') == '1':
    k = 1.0 / (hi.z - lo.z)
    root = bpy.data.objects.new('normalise', None); bpy.context.scene.collection.objects.link(root)
    for o in bpy.context.scene.objects:
        if o.parent is None and o is not root: o.parent = root
    root.scale = (k, k, k)
    root.location = (-(lo.x + hi.x) / 2 * k, -(lo.y + hi.y) / 2 * k, -lo.z * k)
    bpy.context.view_layer.update()

s = bpy.context.scene
s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = samples; s.cycles.use_denoising = True
s.render.film_transparent = True
s.render.resolution_x, s.render.resolution_y = 700, 900
s.view_settings.view_transform = 'AgX'; s.view_settings.look = 'AgX - Base Contrast'
w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (1, 0.92, 0.84, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.8
for loc, e, size, col in (((-2.6, -4.2, 4.2), 820 / 6, 4.0, (1, 0.93, 0.84)), ((4.2, -2.8, 2.4), 260 / 6, 4.0, (1, 0.95, 0.9)), ((0.8, 4.6, 3.8), 380 / 6, 3.0, (1, 0.88, 0.76))):
    d = bpy.data.lights.new('l', 'AREA'); d.energy = e; d.size = size; d.color = col
    o = bpy.data.objects.new('l', d); s.collection.objects.link(o); o.location = Vector(loc) * 0.42
    o.rotation_euler = (Vector((0, 0, 0.5)) - o.location).to_track_quat('-Z', 'Y').to_euler()
cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = 1.3
co = bpy.data.objects.new('cam', cam); s.collection.objects.link(co); s.camera = co
os.makedirs(os.path.dirname(prefix) or '.', exist_ok=True)
for name, deg in (('front', 0), ('three', 35), ('side', 90), ('back', 180)):
    a = math.radians(deg); d = 10
    co.location = (math.sin(a) * d, -math.cos(a) * d, 0.5)
    co.rotation_euler = (Vector((0, 0, 0.5)) - co.location).to_track_quat('-Z', 'Y').to_euler()
    s.render.filepath = os.path.abspath(f'{prefix}_{name}.png'); bpy.ops.render.render(write_still=True)
print('bbox before normalise', tuple(round(v, 3) for v in lo), tuple(round(v, 3) for v in hi))
