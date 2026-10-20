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

## iter_01 — the user's second Meshy model ("lite"), compared as shape only
- Source: `design/char_round4/base_lite/…/Meshy_AI_Daisy_1020225610_generate.obj` (user upload). Geometry only:
  135,031 verts / 270,378 tris, no UVs, no texture, no colours. 1.9 tall, Y-up. Watertight: 0 boundary edges,
  0 non-manifold edges, 0 non-manifold verts.
- Both models rendered in one matte clay material (`CLAY=1`): `lite_clay_*.png`, `base_clay_*.png`;
  side by side with the concept: `lite_vs_base_clay.jpg`.
- IoU (base → lite): front 0.886 → 0.856 · side 0.725 → 0.839 · back 0.879 → 0.843.
- Why: the lite model HAS the backpack (side +0.114). Front/back drop because a thin wire of hair on top of
  the bun adds height, so after height-normalising everything else reads 5–10% narrow; legs are genuinely
  15–20% too slim (70–85% bands) and the shoes 27–39% too small (95–100%).
- Visual (clay): lite = smoother, rounder hair mass and bun, cleaner clothes, no U-artefact on the back of the
  head, but the eyes are dark holes in the face. Base = carved eyes/nose/smile in the geometry (lumpy without
  texture), U-artefact at the nape, no backpack.
- QuadriFlow root cause found: in this bpy 4.2 build it refuses any mesh above a few thousand faces with the
  misleading "needs to be manifold" warning — Blender's own monkey: 7,054 faces OK, 44,054 refused. Decimating
  first (to 11,318 / 21,496) is refused too. Stopped there (rule 7).

## iter_02 — the user's third model (Hugging Face TRELLIS)
- Source: `design/char_round4/base_trellis/trellis_sample.glb` (user upload). One mesh, 300,317 verts / 291,014 tris,
  one 2048² base-colour texture, ~1.0 tall. Split at UV seams; welded it is 132,072 verts with 3,171 boundary and
  10,471 non-manifold edges (not watertight, unlike the second model).
- Renders: `trellis_{front,three,side,back}.png` (textured), `trellis_clay_*.png` (shape only);
  sheet `trellis_compare.jpg` (rows: concept · TRELLIS textured · TRELLIS clay · second model clay).
- IoU (clay): front 0.866 · side 0.728 · back 0.859 (base 0.886/0.725/0.879 · lite 0.856/0.839/0.843).
- Bands: no backpack (side 50–65% −23…−41%); bun sits high and tilts back (side 5–10% −33%, head 15–25% +9…+10%);
  hips/jeans +10…+11% too wide at 55–60% and 70–75%; shoes −13…−28% too small.
- Visual: best face of the three as a *painted* face on a mostly smooth surface (the PDF's method), clean
  sculpted-looking curls at the sides, readable flower clip, clear rolled cuffs. But: no backpack (straps only),
  eyes grey not warm brown, hair near-black, jumper and shoes grey-white, bun stands up off the head like a
  separate lump, cold overall colour.
