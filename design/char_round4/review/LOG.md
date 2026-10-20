# Round 4 review log (super_prompt.pdf §6)

Reference views: `design/char_round4/reference/ref_{front,three,side,back}.png`, cropped from
`design/ref_hero-girl-v2.png` (same crop height for all four).
Tools: `tools/render_views.py` (ortho, transparent, height-normalised), `tools/compare_silhouette.py`
(IoU after cropping to the silhouette, scaling to equal height and centring on the head; 20 bands, ±5%).
Blender: bpy 4.2.0 (5.2 not installed; awaiting the user's yes).

## iter_00 — the user's Meshy base, unchanged
- Source: `design/char_round4/base/meshy_base.glb` (user upload; generator trimesh/Meshy). One mesh,
  142,104 verts / 189,916 tris, base-colour + metallic-roughness textures (WebP), no rig, no animation.
  Already 1.0 tall (Y-up ±0.501), facing -Y after import.
- Renders: `iter_00_{front,three,side,back}.png`; side by side: `iter_00_compare.jpg`; overlays: `iter_00_overlays.jpg`.
- IoU: front 0.886 · side 0.725 · back 0.879
- Bands flagged (front): sleeves/upper body 25–50% +5…+7% TOO WIDE; hips 55–60% +15%, 70–75% +10% TOO WIDE; feet 95–100% −16% (residual floor shadow in the reference mask).
- Bands flagged (side): the backpack is missing (50–70% −27…−39%); head 10–25% +13…+20% TOO WIDE (head sits forward, bun further back).
- Top 3 visual differences:
  1. No backpack at all (only the strap tops at the shoulders); concept has a brown leather pack with flap, buckle, handle.
  2. Hair is near-black and stringy at the edges (thin wire-like curls stick out of the bun and sides); concept is warm medium brown, soft clumps.
  3. Back of the head shows a hard U-shaped artefact above the nape; jumper slightly grey; shoes lack the tan accents.
- Next: Phase 3 (clean the base: separate parts, remesh, symmetrise), then add the backpack.

## Phase 3 — attempt 1 (blocked, stopped per rule 7)
- `tools/char_round4_clean.py` run on the base: labelled 142,104 verts (skin 41,423 · hair 64,220 · jumper 8,347 ·
  jeans 12,236 · shoes 10,596 · straps 4,667 · flower 615). **Labelling is wrong**: the shaded cream jumper
  (saturation 0.30–0.35) fell into the skin rule; fix = restrict skin to the head (z > 0.5) and hands (|x| > 0.14, z 0.25–0.36).
- Split naming bug: every part came out named "skin" (separate-by-material renumbers slots; must read the slot's material name).
- **QuadriFlow blocked** (Blender 4.2 bpy): on the voxel-remeshed character it returns FINISHED but does nothing, warning
  "The mesh needs to be manifold and have face normals that point in a consistent direction". Tried:
  1. voxel 0.0035 (301,204 faces) and 0.006 (52,662 faces): 0 non-manifold edges;
  2. 0 non-manifold verts; delete-non-manifold + fill holes + recalc normals;
  3. kept only the largest of 8 loose parts (52,316 faces) + recalc normals.
  Same call on a voxel-remeshed test mesh works (7,054 → 1,911 faces).
- `round4_base.blend` from this attempt is not usable (no quad remesh, wrong labels); not committed.
