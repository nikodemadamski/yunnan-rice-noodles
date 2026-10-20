# Round 4, Phase 3: clean the generated base (super_prompt.pdf §4 Phase 3).
#
#   python tools/char_round4_clean.py <meshy_base.glb> <out.blend> [target_faces]
#
# 1. Import, normalise: height 1.0, feet on Z = 0, centred, facing -Y.
# 2. Sample the generated base-colour texture into a per-vertex colour ('gen_col').
# 3. Label every vertex by part (skin, hair, jumper, jeans, shoes, straps, flower) from its colour and
#    position, then smooth the labels so parts have clean borders.
# 4. Voxel remesh (closes the surface) → QuadriFlow to clean quads (no symmetry: the hair and flower
#    are asymmetric). Colours and labels come back from the nearest source vertex.
# 5. Split into objects by part; mirror -X onto +X for the body and clothes (hair and flower stay as they are).
# The untouched source stays in the file, hidden, in its own collection ('meshy_src').

import bpy, bmesh, sys, os, colorsys
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
SRC, OUT = args[0], args[1]
TARGET = int(args[2]) if len(args) > 2 else 24000
PARTS = ['skin', 'hair', 'jumper', 'jeans', 'shoes', 'straps', 'flower']
SYMMETRIC = {'skin', 'jumper', 'jeans', 'shoes', 'straps'}
COLOURS = {'skin': '#e9b18f', 'hair': '#5a3420', 'jumper': '#efe2c9', 'jeans': '#7d9cc7', 'shoes': '#f1e9dc', 'straps': '#8a4f2c', 'flower': '#fffaf0'}

def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

# ---------------------------------------------------------------- 1. import & normalise
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
src = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
for o in list(bpy.context.scene.objects):
    if o is not src and o.type == 'EMPTY':
        mw = src.matrix_world.copy(); src.parent = None; src.matrix_world = mw
        bpy.data.objects.remove(o)
bpy.context.view_layer.objects.active = src; src.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
co = np.zeros(len(src.data.vertices) * 3); src.data.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
lo, hi = co.min(0), co.max(0); k = 1.0 / (hi[2] - lo[2])
co = (co - np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]])) * k
src.data.vertices.foreach_set('co', co.ravel()); src.data.update()
src.name = 'meshy_src'

# ---------------------------------------------------------------- 2. generated colour per vertex
img = next(n.image for n in src.active_material.node_tree.nodes
           if n.type == 'TEX_IMAGE' and any(l.to_socket.name == 'Base Color' for l in n.outputs['Color'].links))
W, H = img.size
px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)[..., :3]          # stored sRGB values
me = src.data
uv = np.zeros(len(me.loops) * 2); me.uv_layers[0].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
lv = np.zeros(len(me.loops), int); me.loops.foreach_get('vertex_index', lv)
xs = np.clip((uv[:, 0] % 1.0) * (W - 1), 0, W - 1).astype(int); ys = np.clip((uv[:, 1] % 1.0) * (H - 1), 0, H - 1).astype(int)
acc = np.zeros((len(me.vertices), 3)); cnt = np.zeros(len(me.vertices))
np.add.at(acc, lv, px[ys, xs]); np.add.at(cnt, lv, 1)
vcol = acc / np.maximum(cnt, 1)[:, None]

# ---------------------------------------------------------------- 3. label the parts
hsv = np.array([colorsys.rgb_to_hsv(*c) for c in vcol])
h, s, v = hsv[:, 0], hsv[:, 1], hsv[:, 2]
x, y, z = co[:, 0], co[:, 1], co[:, 2]
CHIN = 0.545
lab = np.full(len(co), -1)
face = (y < -0.1) & (z > CHIN) & (z < 0.8) & (np.abs(x) < 0.17)
blue = (vcol[:, 2] > vcol[:, 0] + 0.02) & (z < 0.42)
dark = v < 0.36
skinlike = (h > 0.02) & (h < 0.11) & (s > 0.3) & (v > 0.5)
light = (s < 0.32) & (v > 0.5)
lab[light & (z < 0.42)] = PARTS.index('jumper')
lab[light & (z < 0.075)] = PARTS.index('shoes')
lab[blue] = PARTS.index('jeans')
lab[skinlike] = PARTS.index('skin')
lab[dark & (z > 0.45)] = PARTS.index('hair')
lab[dark & (z <= 0.45) & (z > 0.25)] = PARTS.index('straps')
lab[(v < 0.5) & (s > 0.35) & (z <= 0.53) & (z > 0.25) & (np.abs(x) < 0.17)] = PARTS.index('straps')
lab[face] = PARTS.index('skin')                                    # eyes, brows and mouth belong to the face
lab[light & (z > 0.62) & (x > 0.05) & (y < 0.05)] = PARTS.index('flower')   # the cream flower on her left temple
# neighbours: fill the unlabelled, then a few rounds of majority smoothing
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
nbr = [[e.other_vert(vv).index for e in vv.link_edges] for vv in bm.verts]
bm.free()
for it in range(6):
    new = lab.copy()
    for i, ns in enumerate(nbr):
        vals = lab[ns]; vals = vals[vals >= 0]
        if len(vals) == 0: continue
        b = np.bincount(vals, minlength=len(PARTS))
        if lab[i] < 0 or b.max() >= len(vals) * 0.75: new[i] = b.argmax()
    lab = new
lab[lab < 0] = PARTS.index('jumper')
print('labels', {p: int((lab == i).sum()) for i, p in enumerate(PARTS)})

# ---------------------------------------------------------------- 4. remesh
work = src.copy(); work.data = src.data.copy(); work.name = 'remesh'
bpy.context.scene.collection.objects.link(work)
for m in list(work.data.materials): pass
bpy.ops.object.select_all(action='DESELECT'); work.select_set(True); bpy.context.view_layer.objects.active = work
work.data.remesh_voxel_size = 0.0035
bpy.ops.object.voxel_remesh()
print('voxel remesh faces', len(work.data.polygons))
bpy.ops.object.quadriflow_remesh(use_mesh_symmetry=False, use_preserve_sharp=False, use_preserve_boundary=False,
                                 preserve_attributes=False, smooth_normals=False, mode='FACES', target_faces=TARGET, seed=0)
print('quadriflow faces', len(work.data.polygons))
# labels and colours back from the nearest source vertex
kd = KDTree(len(co))
for i, c in enumerate(co): kd.insert(c, i)
kd.balance()
wm = work.data
wl = np.array([lab[kd.find(vv.co)[1]] for vv in wm.vertices])
wc = np.array([vcol[kd.find(vv.co)[1]] for vv in wm.vertices])
ca = wm.color_attributes.new('gen_col', 'FLOAT_COLOR', 'POINT')
for i, c in enumerate(wc):
    ca.data[i].color = (*[((cc + 0.055) / 1.055) ** 2.4 if cc > 0.04045 else cc / 12.92 for cc in c], 1.0)   # store linear
# ---------------------------------------------------------------- 5. split by part, symmetrise the body and clothes
wm.materials.clear()
mats = []
for p in PARTS:
    m = bpy.data.materials.new(p); m.use_nodes = True
    pr = m.node_tree.nodes['Principled BSDF']
    pr.inputs['Base Color'].default_value = (*srgb(COLOURS[p]), 1); pr.inputs['Roughness'].default_value = 0.6
    att = m.node_tree.nodes.new('ShaderNodeVertexColor'); att.layer_name = 'gen_col'
    m.node_tree.links.new(att.outputs['Color'], pr.inputs['Base Color'])        # the generated colours as the guide
    wm.materials.append(m); mats.append(m)
for f in wm.polygons:
    b = np.bincount(wl[list(f.vertices)], minlength=len(PARTS)); f.material_index = int(b.argmax())
    f.use_smooth = True
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='MATERIAL'); bpy.ops.object.mode_set(mode='OBJECT')
col = bpy.data.collections.new('round4_base'); bpy.context.scene.collection.children.link(col)
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH' and o is not src]:
    if not o.data.polygons: bpy.data.objects.remove(o); continue
    part = PARTS[max(range(len(PARTS)), key=lambda i: sum(1 for f in o.data.polygons if f.material_index == i))]
    o.name = part; o.data.name = part
    for c in o.users_collection: c.objects.unlink(o)
    col.objects.link(o)
    if part in SYMMETRIC:
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.symmetrize(direction='NEGATIVE_X'); bpy.ops.object.mode_set(mode='OBJECT')
    print('part', part, 'faces', len(o.data.polygons))
# the source, hidden, in its own collection
srccol = bpy.data.collections.new('meshy_src'); bpy.context.scene.collection.children.link(srccol)
for c in src.users_collection: c.objects.unlink(src)
srccol.objects.link(src); src.hide_render = True; src.hide_set(True)
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(OUT))
print('saved', OUT)
