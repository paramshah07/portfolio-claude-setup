# Models a clay poker chip in Blender and exports public/models/chip.glb, after a Paulson card-suits
# mould: 39 x 3.3 mm with a rounded rim, eight edge spots of a second clay pressed through the chip,
# the four suits embossed round the band between them, and a printed label set into a recess on
# each face with a brass foil ring. Every part is geometry, so the scene colours each clay and none
# of it is painted on. The parts are separate meshes named body, inserts, label and ring, for the
# scene to instance and colour. Blender is z up and glTF y up, so the chip's faces end up toward ±y.
# Run from the repo root: blender -b --factory-startup -P scripts/make-chip.py
import math
import bmesh
import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)

R, H = 0.0195, 0.0033  # src/components/scene/objects/chip.ts CHIP
h = H / 2
RIM = 0.0005  # the rounded rim's radius
INLAY = 0.012  # the recess the label sits in
RECESS = 0.0003
LABEL = 0.00016  # the label's thickness, so its face sits 0.14 mm below the band
SPOTS = 8
SPOT = 0.0058  # each spot's width; on the face it reaches in to 15.2 mm from the middle
SPOT_IN = 0.0152
SUIT = {'r': 0.0171, 'size': 0.0038, 'relief': 0.0001}
# Round the chip. Sixty-odd chips are on the table at once, so this is as few as keeps the rim round.
SEGMENTS = 72


def material(name, color, roughness, metallic=0.0):
    m = bpy.data.materials.new(name)
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    return m


MATERIALS = {
    'clay': material('clay', (0.05, 0.05, 0.05), 0.65),
    'spot': material('spot', (0.85, 0.82, 0.75), 0.65),
    'label': material('label', (0.89, 0.85, 0.77), 0.45),
    'brass': material('brass', (0.42, 0.31, 0.17), 0.35, 1.0),
}


def obj_from(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(MATERIALS[mat])
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    return obj


def turned(name, profile, mat):
    """A solid turned from (r, z) points that start and end on the axis."""
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0, z)) for r, z in profile]
    edges = [bm.edges.new((a, b)) for a, b in zip(verts, verts[1:])]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=math.tau, steps=SEGMENTS, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-8)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from(name, bm, mat)


def rim(z, top):
    """The rounded rim as points from the band round to the side, or back for the bottom."""
    centre = z - RIM if top else z + RIM
    angles = [math.pi / 2 * (1 - k / 6) for k in range(7)] if top else [-math.pi / 2 * k / 6 for k in range(7)]
    return [(R - RIM + RIM * math.cos(a), centre + RIM * math.sin(a)) for a in angles]


def body():
    lip = INLAY + 0.0002
    top = [(0, h - RECESS), (INLAY, h - RECESS), (lip, h)] + rim(h, True)
    bottom = rim(-h, False) + [(lip, -h), (INLAY, -h + RECESS), (0, -h + RECESS)]
    return turned('body', top + bottom, 'clay')


def cutters():
    """A box for every spot, from SPOT_IN out past the rim, right through the chip."""
    bm = bmesh.new()
    for k in range(SPOTS):
        a = k / SPOTS * math.tau
        c, s = math.cos(a), math.sin(a)
        corners = [(SPOT_IN, -SPOT / 2), (R + 0.002, -SPOT / 2), (R + 0.002, SPOT / 2), (SPOT_IN, SPOT / 2)]
        ring = [[bm.verts.new((u * c - v * s, u * s + v * c, z)) for u, v in corners] for z in (-H, H)]
        bm.faces.new(ring[0][::-1])
        bm.faces.new(ring[1])
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((ring[0][i], ring[0][j], ring[1][j], ring[1][i]))
    return obj_from('cutters', bm, 'spot')


def boolean(target, cutter, operation):
    mod = target.modifiers.new(operation, 'BOOLEAN')
    mod.operation = operation
    mod.solver = 'EXACT'
    mod.object = cutter
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=mod.name)


def circle(cx, cy, r, n=14):
    return [(cx + r * math.cos(k / n * math.tau), cy + r * math.sin(k / n * math.tau)) for k in range(n)]


# Each suit as overlapping convex pieces in a unit box, up being toward the rim. Overlapping pieces
# share their top, so they read as one shape.
SUITS = {
    'spade': [circle(-0.22, -0.06, 0.25), circle(0.22, -0.06, 0.25), [(-0.46, 0.0), (0.46, 0.0), (0, 0.5)], [(0, -0.1), (0.16, -0.5), (-0.16, -0.5)]],
    'heart': [circle(-0.22, 0.14, 0.26), circle(0.22, 0.14, 0.26), [(-0.47, 0.06), (0, -0.5), (0.47, 0.06)]],
    'diamond': [[(0, 0.5), (-0.34, 0), (0, -0.5), (0.34, 0)]],
    'club': [circle(0, 0.22, 0.2), circle(-0.22, -0.08, 0.2), circle(0.22, -0.08, 0.2), [(0, -0.02), (0.14, -0.5), (-0.14, -0.5)]],
}


def suits():
    """The suits embossed round the band in the gaps between the spots, on both faces."""
    bm = bmesh.new()
    order = ['spade', 'heart', 'diamond', 'club'] * (SPOTS // 4)
    for k, suit in enumerate(order):
        a = (k + 0.5) / SPOTS * math.tau
        # Up points out toward the rim, so the shape's y runs along the radius.
        up, across = (math.cos(a), math.sin(a)), (-math.sin(a), math.cos(a))
        for face in (1, -1):
            for piece in SUITS[suit]:
                # Mirrored across on the bottom face, so it reads the right way round from below.
                flat = [
                    (up[0] * (SUIT['r'] + y * SUIT['size']) + across[0] * x * SUIT['size'] * face, up[1] * (SUIT['r'] + y * SUIT['size']) + across[1] * x * SUIT['size'] * face)
                    for x, y in piece
                ]
                base = [bm.verts.new((x, y, face * (h - 0.00002))) for x, y in flat]
                top = [bm.verts.new((x, y, face * (h + SUIT['relief']))) for x, y in flat]
                # Wound so the top faces away from the chip on either face.
                bm.faces.new(top if face > 0 else top[::-1])
                bm.faces.new(base[::-1] if face > 0 else base)
                for i in range(len(flat)):
                    j = (i + 1) % len(flat)
                    side = (base[i], base[j], top[j], top[i])
                    bm.faces.new(side if face > 0 else side[::-1])
    return obj_from('suits', bm, 'clay')


def label_and_ring():
    """The label disc in each recess, with its edge rounded off, and the foil ring printed on it."""
    t, r = LABEL, INLAY - 0.00005
    floor = h - RECESS
    label = turned('label', [(0, floor - 0.00001), (r, floor - 0.00001), (r, floor + t - 0.00004), (r - 0.00004, floor + t), (0, floor + t)], 'label')
    bm = bmesh.new()
    for face in (1, -1):
        z = face * (floor + t + 0.00003)
        inner = [bm.verts.new((0.0109 * math.cos(k / SEGMENTS * math.tau), 0.0109 * math.sin(k / SEGMENTS * math.tau), z)) for k in range(SEGMENTS)]
        outer = [bm.verts.new((0.0113 * math.cos(k / SEGMENTS * math.tau), 0.0113 * math.sin(k / SEGMENTS * math.tau), z)) for k in range(SEGMENTS)]
        for k in range(SEGMENTS):
            j = (k + 1) % SEGMENTS
            quad = (inner[k], outer[k], outer[j], inner[j])
            bm.faces.new(quad if face > 0 else quad[::-1])
    ring = obj_from('ring', bm, 'brass')
    # The bottom face's label is the top one turned over.
    bottom = label.copy()
    bottom.data = label.data.copy()
    bottom.scale.z = -1
    bpy.context.collection.objects.link(bottom)
    return label, bottom, ring


def join(objects, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = joined.data.name = name
    return joined


chip = body()
cut = cutters()
inserts = chip.copy()
inserts.data = chip.data.copy()
inserts.name = inserts.data.name = 'inserts'
bpy.context.collection.objects.link(inserts)
boolean(inserts, cut, 'INTERSECT')
inserts.data.materials[0] = MATERIALS['spot']
boolean(chip, cut, 'DIFFERENCE')
bpy.data.objects.remove(cut)
chip = join([chip, suits()], 'body')
top_label, bottom_label, ring = label_and_ring()
label = join([top_label, bottom_label], 'label')

parts = [chip, inserts, label, ring]
for o in parts:
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    # Smooth where the surface curves, sharp at the recess steps, spot seams and suit edges.
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
bpy.ops.object.select_all(action='DESELECT')
for o in parts:
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath='public/models/chip.glb',
    export_format='GLB',
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_normals=True,
    export_texcoords=False,
    export_materials='EXPORT',
    export_meshopt_compression_enable=True,
    export_meshopt_extension='EXT_meshopt_compression',
)
print('public/models/chip.glb:', ', '.join(f'{o.name} {len(o.data.polygons)} faces' for o in parts))
