# Models the poker table in Blender and exports public/models/table.glb: the felt, the padded
# leather rail in panels that join between the seats and a walnut apron under it, and brass cup holders
# set into holes cut through the rail. The scene assigns the textured materials by name (felt,
# leather, walnut, brass), so the file carries geometry and UVs in metres, which the textures tile.
# Sizes match src/components/scene/objects/layout.ts: a stadium 2.4 x 1.2 m with the felt at z = 0.
# Blender is z up and glTF y up, so Blender's -y is the scene's +z, toward the player's seat.
# Run from the repo root: blender -b --factory-startup -P scripts/make-table.py
import math
import bmesh
import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)

HALF, RADIUS, RAIL = 0.6, 0.6, 0.12  # layout.ts TABLE
FELT = RADIUS - RAIL
SEATS = 10  # the player's in the middle of the near side and the dealer's opposite
# The rail's profile, from the felt out: a padded roll 0.13 m wide and 5 cm tall that tucks under
# its own inner edge, then the walnut apron straight down 6 cm.
ROLL = {'width': 0.13, 'height': 0.05, 'round': 2.6}
APRON = 0.06
SEAM = {'width': 0.004, 'depth': 0.003}
CUP = {'radius': 0.034, 'lip': 0.006, 'depth': 0.05}


def perimeter(radius):
    return 4 * HALF + 2 * math.pi * radius


def along(s, radius):
    """The point s metres round the stadium of this radius and its outward normal, starting in front
    of the player and heading toward +x, as layout.ts does."""
    arc = math.pi * radius
    s %= perimeter(radius)
    if s < HALF:
        return (s, -radius), (0, -1)
    s -= HALF
    if s < arc:
        a = s / radius
        return (HALF + radius * math.sin(a), -radius * math.cos(a)), (math.sin(a), -math.cos(a))
    s -= arc
    if s < 2 * HALF:
        return (HALF - s, radius), (0, 1)
    s -= 2 * HALF
    if s < arc:
        a = s / radius
        return (-HALF - radius * math.sin(a), radius * math.cos(a)), (-math.sin(a), math.cos(a))
    return (s - arc - HALF, -radius), (0, -1)


def profile():
    """The rail's cross-section as (out, up, material) from the felt, with the arc length so far."""
    points = []
    n = 20
    e = 2 / ROLL['round']
    for j in range(n + 1):
        t = math.pi * (1 - j / n)
        c, s = math.cos(t), math.sin(t)
        out = ROLL['width'] / 2 * (1 + math.copysign(abs(c) ** e, c))
        up = ROLL['height'] * abs(s) ** e
        points.append((out, up, 'leather'))
    # Tucked a centimetre under the inner edge, so the felt runs in beneath it.
    points.insert(0, (0.01, -0.004, 'leather'))
    w = ROLL['width']
    points += [(w, 0.0, 'walnut'), (w, -APRON, 'walnut'), (w - 0.03, -APRON, 'walnut')]
    return points


def rail_rings():
    """Distances round the felt's edge to put a ring of the profile at: fine on the round ends,
    coarse on the straights, and three close rings for each seam. The panels join between the
    seats, where the cup holders are, so no seam runs in front of a player."""
    total = perimeter(FELT)
    rings = set()
    for k in range(64 * 2 + 1):
        # The two ends, each half a circle.
        a = k / 64
        rings.add(HALF + a * math.pi * FELT)
        rings.add(3 * HALF + math.pi * FELT + a * math.pi * FELT)
    for k in range(13):
        rings.add(k / 12 * HALF)
        rings.add(HALF + math.pi * FELT + k / 6 * HALF)
        rings.add(3 * HALF + 2 * math.pi * FELT + k / 12 * HALF)
    seams = [(k + 0.5) / SEATS * total for k in range(SEATS)]
    for s in seams:
        for d in (-SEAM['width'], 0, SEAM['width']):
            rings.add((s + d) % total)
    rings = sorted(r % total for r in rings)
    # Drop near duplicates, which would make slivers.
    kept = []
    for r in rings:
        if not kept or r - kept[-1] > 1e-4:
            kept.append(r)
    return kept, seams


def material(name, color, roughness, metallic=0.0):
    m = bpy.data.materials.new(name)
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    return m


def srgb(hex_):
    c = [int(hex_[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


MATERIALS = {
    'felt': material('felt', srgb('#2E4C3A'), 0.9),
    'leather': material('leather', srgb('#3A3329'), 0.5),
    'walnut': material('walnut', srgb('#3B2517'), 0.45),
    'brass': material('brass', srgb('#AD9773'), 0.35, 1.0),
}


def mesh_object(name, bm, materials):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in materials:
        me.materials.append(MATERIALS[m])
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    for poly in me.polygons:
        poly.use_smooth = True
    return obj


def build_felt():
    """The felt: a flat stadium running 2 cm in under the rail, with UVs in metres."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    radius = FELT + 0.02
    n = 256
    verts = [bm.verts.new((*along(k / n * perimeter(radius), radius)[0], 0)) for k in range(n)]
    face = bm.faces.new(verts)
    bmesh.ops.triangulate(bm, faces=[face], quad_method='BEAUTY', ngon_method='BEAUTY')
    for f in bm.faces:
        for loop in f.loops:
            loop[uv].uv = (loop.vert.co.x, loop.vert.co.y)
    return mesh_object('felt', bm, ['felt'])


def build_rail():
    """The rail: the profile swept round the felt's edge, a shallow groove at every seat, with u
    running round the table and v across the profile, both in metres."""
    rings, seams = rail_rings()
    points = profile()
    lengths = [0.0]
    for (a, b, _), (c, d, _) in zip(points, points[1:]):
        lengths.append(lengths[-1] + math.hypot(c - a, d - b))
    total = perimeter(FELT)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    grid = []
    for s in rings:
        (x, y), (nx, ny) = along(s, FELT)
        # Seams pull the leather in along the profile's inward normal; the apron stays straight.
        groove = SEAM['depth'] if any(abs(((s - t + total / 2) % total) - total / 2) < 1e-6 for t in seams) else 0
        row = []
        for j, (out, up, mat) in enumerate(points):
            if groove and mat == 'leather' and 0 < j < len(points) - 4:
                # The profile's own normal at this point, from its neighbours.
                (a, b, _), (c, d, _) = points[j - 1], points[j + 1]
                length = math.hypot(c - a, d - b)
                pn = (-(d - b) / length, (c - a) / length)
                out, up = out - groove * pn[0], up - groove * pn[1]
            row.append(bm.verts.new((x + nx * out, y + ny * out, up)))
        grid.append(row)
    for i in range(len(rings)):
        nxt = (i + 1) % len(rings)
        u0, u1 = rings[i], rings[nxt] if nxt else total
        for j in range(len(points) - 1):
            # Rings run anticlockwise seen from above and the profile runs outward over the roll, so
            # this order faces every quad out of the leather.
            f = bm.faces.new((grid[i][j], grid[i][j + 1], grid[nxt][j + 1], grid[nxt][j]))
            f.material_index = 0 if points[j + 1][2] == 'leather' else 1
            for loop, (u, v) in zip(f.loops, ((u0, lengths[j]), (u0, lengths[j + 1]), (u1, lengths[j + 1]), (u1, lengths[j]))):
                loop[uv].uv = (u, v)
    bm.normal_update()
    return mesh_object('rail', bm, ['leather', 'walnut'])


def crest(out):
    """The height of the rail's top at a distance out from the felt's edge."""
    points = profile()
    best = max((p for p in points if p[2] == 'leather'), key=lambda p: -abs(p[0] - out))
    return best[1]


def build_cups(rail):
    """Holes cut through the rail between the seats, each with a brass cup whose lip sits on the
    leather around it."""
    out = ROLL['width'] / 2
    top = crest(out)
    total = perimeter(FELT)
    cutters = []
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    r, lip = CUP['radius'], CUP['lip']
    # The lip's skirt runs a centimetre down into the leather, which falls away either side of the crest.
    section = [(r + lip, top - 0.012), (r + lip, top + 0.0015), (r + lip - 0.001, top + 0.0028), (r + 0.001, top + 0.0028), (r, top + 0.001), (r, top - CUP['depth']), (0, top - CUP['depth'])]
    for k in range(SEATS):
        (x, y), (nx, ny) = along((k + 0.5) / SEATS * total, FELT)
        cx, cy = x + nx * out, y + ny * out
        bpy.ops.mesh.primitive_cylinder_add(radius=r + 0.0005, depth=0.3, location=(cx, cy, top), vertices=64)
        cutters.append(bpy.context.object)
        ring_count = 64
        rings = []
        for i in range(ring_count):
            a = i / ring_count * math.tau
            rings.append([bm.verts.new((cx + rr * math.cos(a), cy + rr * math.sin(a), z)) for rr, z in section])
        for i in range(ring_count):
            n2 = (i + 1) % ring_count
            for j in range(len(section) - 1):
                # Anticlockwise round and down the section, so the outside of the lip faces out and
                # the inside of the cup faces in.
                f = bm.faces.new((rings[i][j], rings[n2][j], rings[n2][j + 1], rings[i][j + 1]))
                for loop in f.loops:
                    loop[uv].uv = (loop.vert.co.x, loop.vert.co.y)
    bm.normal_update()
    cups = mesh_object('cups', bm, ['brass'])
    # One boolean for all ten holes.
    bpy.ops.object.select_all(action='DESELECT')
    for c in cutters:
        c.select_set(True)
    bpy.context.view_layer.objects.active = cutters[0]
    bpy.ops.object.join()
    cutter = bpy.context.object
    mod = rail.modifiers.new('holes', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter
    bpy.context.view_layer.objects.active = rail
    bpy.ops.object.modifier_apply(modifier='holes')
    bpy.data.objects.remove(cutter)
    return cups


felt = build_felt()
rail = build_rail()
cups = build_cups(rail)
for obj in (felt, rail, cups):
    obj.select_set(True)
bpy.ops.export_scene.gltf(
    filepath='public/models/table.glb',
    export_format='GLB',
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_meshopt_compression_enable=True,
    export_meshopt_extension='EXT_meshopt_compression',
)
print('public/models/table.glb:', ', '.join(f'{o.name} {len(o.data.vertices)} verts' for o in (felt, rail, cups)))
