import * as THREE from 'three';

/**
 * A clay chip in metres, after a Paulson: 39 mm across and 3.3 mm thick, a 0.5 mm rounded rim, and
 * a 24 mm printed inlay set 0.15 mm into each face.
 */
export const CHIP = { radius: 0.0195, height: 0.0033, rim: 0.0005, inlay: 0.012, recess: 0.00015 };
/** How scripts/make-chip-maps.mjs lays out the maps: the face in the top square, the edge under it. */
export const MAP = { width: 1024, face: 1024, edge: 128, pad: 12 };

const SEGMENTS = 64;

/**
 * The chip turned from its profile, centred on the origin with its faces toward ±y. Each part of
 * the profile keeps its own vertices, so the recess has crisp steps while the rim rounds smoothly
 * into the edge. The faces map flat onto the face square of the maps and the rim and edge wrap
 * round the edge strip, both by the same angle, so an edge spot and its wedge on the face line up.
 */
export function chipGeometry() {
  const { radius: R, height, rim: b, inlay: ri, recess } = CHIP;
  const h = height / 2;
  const wall = ri + 0.0003; // the recess's outer lip, a 0.3 mm chamfer out from the inlay
  const arc = (from: number, to: number, y: number, n = 5) =>
    Array.from({ length: n + 1 }, (_, k) => {
      const t = from + ((to - from) * k) / n;
      return { r: R - b + b * Math.cos(t), y: y + b * Math.sin(t), nr: Math.cos(t), ny: Math.sin(t) };
    });
  const flat = (r0: number, r1: number, y: number, ny: number) => [
    { r: r0, y, nr: 0, ny },
    { r: r1, y, nr: 0, ny },
  ];
  const chamfer = (r0: number, y0: number, r1: number, y1: number) => {
    // The profile runs with the outside on its left, so that's where the normal points.
    const len = Math.hypot(r1 - r0, y1 - y0);
    const [nr, ny] = [-(y1 - y0) / len, (r1 - r0) / len];
    return [
      { r: r0, y: y0, nr, ny },
      { r: r1, y: y1, nr, ny },
    ];
  };
  // From the middle of the top out to the rim, round the edge, then back in along the bottom.
  const parts: { points: { r: number; y: number; nr: number; ny: number }[]; edge: boolean }[] = [
    { points: flat(0, ri, h - recess, 1), edge: false },
    { points: chamfer(ri, h - recess, wall, h), edge: false },
    { points: flat(wall, R - b, h, 1), edge: false },
    { points: [...arc(Math.PI / 2, 0, h - b), ...arc(0, -Math.PI / 2, -h + b)], edge: true },
    { points: flat(R - b, wall, -h, -1), edge: false },
    { points: chamfer(wall, -h, ri, -h + recess), edge: false },
    { points: flat(ri, 0, -h + recess, -1), edge: false },
  ];

  const position: number[] = [];
  const normal: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  const H = MAP.face + MAP.edge;
  // Face square: the rim's inner edge sits a few pixels in from its sides. Textures load flipped,
  // so v counts up from the bottom of the image.
  const scale = (MAP.face / 2 - MAP.pad) / (R - b);
  const [cu, cv] = [0.5, 1 - MAP.face / 2 / H];
  for (const { points, edge } of parts) {
    const first = position.length / 3;
    // Along the edge, v runs by arc length from the top of the rim to the bottom.
    const lengths = points.map((_, k) => (k ? Math.hypot(points[k].r - points[k - 1].r, points[k].y - points[k - 1].y) : 0));
    const total = lengths.reduce((a, l) => a + l, 0);
    let along = 0;
    points.forEach((p, k) => {
      along += lengths[k];
      for (let i = 0; i <= SEGMENTS; i++) {
        const a = (i / SEGMENTS) * Math.PI * 2;
        const [c, s] = [Math.cos(a), Math.sin(a)];
        position.push(p.r * c, p.y, -p.r * s);
        normal.push(p.nr * c, p.ny, -p.nr * s);
        if (edge) uv.push(i / SEGMENTS, (MAP.edge / H) * (1 - along / total));
        else uv.push(cu + (p.r * scale * c) / MAP.width, cv + (p.r * scale * s) / H);
      }
    });
    for (let k = 0; k < points.length - 1; k++)
      for (let i = 0; i < SEGMENTS; i++) {
        const a = first + k * (SEGMENTS + 1) + i;
        const [b2, c2, d2] = [a + 1, a + SEGMENTS + 1, a + SEGMENTS + 2];
        index.push(a, c2, b2, b2, c2, d2);
      }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}
