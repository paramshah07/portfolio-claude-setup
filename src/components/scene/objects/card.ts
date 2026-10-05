import * as THREE from 'three';

/** A poker-size card in metres: 63 x 88 mm on 0.3 mm stock with 3.2 mm corners, like Kennard's. */
export const CARD = { w: 0.063, h: 0.088, t: 0.0003, r: 0.0032 };
/** The radius the bend morph target curls the long axis round: the ends lift about 36 degrees. */
export const BEND = 0.07;
/**
 * The peel: a player lifting the near end of their cards to read them. Beyond a fold `fold` from the
 * near edge the card stays down, and from there it curls up round a cylinder, tighter as the peel
 * goes on, until the near edge stands at `angle`, nearly upright, so the index in the near left
 * corner of the face reads from the seat. The curl is baked as `steps` morph targets after the bend,
 * at evenly spaced curvatures, so blending neighbouring steps follows the curl instead of cutting
 * across it. See setMorphs.
 */
export const PEEL = { fold: 0.058, angle: 1.3, steps: 6 };

/**
 * Sets a card's morph influences from its bend and its peel, from 0 (flat) to 1, blending the two
 * peel steps either side of it.
 */
export function setMorphs(influences: number[], bend: number, peel: number) {
  influences[0] = bend;
  const at = Math.min(Math.max(peel, 0), 1) * PEEL.steps;
  const below = Math.min(Math.floor(at), PEEL.steps - 1);
  for (let step = 1; step <= PEEL.steps; step++) influences[step] = step === below ? below + 1 - at : step === below + 1 ? at - below : 0;
}

/** An atlas cell in texture space, v up. */
export type Cell = { u0: number; v0: number; u1: number; v1: number };

/**
 * A card with real thickness and rounded corners, centred on the origin: the back faces +z and the
 * face -z, each mapped to its atlas cell and reading upright from its own side. Rows run across the
 * card from end to end, narrowing round the corners, dense enough for the morph targets: the bend,
 * which curls the card round a cylinder of radius BEND at influence 1 (and the other way at -1),
 * then the steps of the peel, which curls up the near end. The edge takes the back's border colour.
 */
export function cardGeometry(back: Cell, face: Cell, { across = 12, along = 24, arc = 6 } = {}) {
  const { w, h, t, r } = CARD;
  const straight = h / 2 - r;
  // Each row as [y, half its width], bottom to top.
  const rows: [number, number][] = [];
  for (let i = arc; i >= 1; i--) rows.push([-straight - r * Math.sin((i / arc) * (Math.PI / 2)), w / 2 - r + r * Math.cos((i / arc) * (Math.PI / 2))]);
  for (let j = 0; j <= along; j++) rows.push([-straight + (2 * straight * j) / along, w / 2]);
  for (let i = 1; i <= arc; i++) rows.push([straight + r * Math.sin((i / arc) * (Math.PI / 2)), w / 2 - r + r * Math.cos((i / arc) * (Math.PI / 2))]);
  const C = across + 1;
  const at = (row: number, k: number): [number, number] => [-rows[row][1] + (2 * rows[row][1] * k) / across, rows[row][0]];

  const position: number[] = [];
  const normal: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  const map = (cell: Cell, x: number, y: number, mirror: boolean) => [
    cell.u0 + (mirror ? 0.5 - x / w : 0.5 + x / w) * (cell.u1 - cell.u0),
    cell.v0 + (0.5 + y / h) * (cell.v1 - cell.v0),
  ];

  // The back on +z, then the face on -z, mirrored so it reads from underneath, wound the other way.
  for (const [z, cell, mirror] of [
    [t / 2, back, false],
    [-t / 2, face, true],
  ] as const) {
    const first = position.length / 3;
    rows.forEach((_, row) => {
      for (let k = 0; k < C; k++) {
        const [x, y] = at(row, k);
        position.push(x, y, z);
        normal.push(0, 0, Math.sign(z));
        uv.push(...map(cell, x, y, mirror));
      }
    });
    for (let row = 0; row < rows.length - 1; row++)
      for (let k = 0; k < across; k++) {
        const a = first + row * C + k;
        const [b, c, d] = [a + 1, a + C, a + C + 1];
        index.push(...(mirror ? [a, d, b, a, c, d] : [a, b, d, a, d, c]));
      }
  }

  // The edge: the outline anticlockwise from the bottom right, up the right side, across the top,
  // down the left and back along the bottom, as a strip from the back down to the face.
  const loop: [number, number][] = [];
  for (let row = 0; row < rows.length; row++) loop.push([row, across]);
  for (let k = across - 1; k > 0; k--) loop.push([rows.length - 1, k]);
  for (let row = rows.length - 1; row >= 0; row--) loop.push([row, 0]);
  for (let k = 1; k < across; k++) loop.push([0, k]);
  const first = position.length / 3;
  loop.forEach(([row, k], i) => {
    const [x, y] = at(row, k);
    // Outward is the tangent turned a quarter clockwise, the tangent from the neighbours either side.
    const [px, py] = at(...loop[(i + loop.length - 1) % loop.length]);
    const [nx, ny] = at(...loop[(i + 1) % loop.length]);
    const len = Math.hypot(nx - px, ny - py);
    for (const z of [t / 2, -t / 2]) {
      position.push(x, y, z);
      normal.push((ny - py) / len, -(nx - px) / len, 0);
      uv.push(...map(back, x, y, false));
    }
  });
  for (let i = 0; i < loop.length; i++) {
    const [top, bottom] = [first + 2 * i, first + 2 * i + 1];
    const [nextTop, nextBottom] = [first + 2 * ((i + 1) % loop.length), first + 2 * ((i + 1) % loop.length) + 1];
    index.push(top, bottom, nextBottom, top, nextBottom, nextTop);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);

  // The bend as offsets: each point swings round the axis at z = BEND by y / BEND radians, keeping
  // its distance from it, and each normal turns with it.
  const bent: number[] = [];
  const turned: number[] = [];
  for (let i = 0; i < position.length; i += 3) {
    const [y, z, ny, nz] = [position[i + 1], position[i + 2], normal[i + 1], normal[i + 2]];
    const [s, c] = [Math.sin(y / BEND), Math.cos(y / BEND)];
    bent.push(0, (BEND - z) * s - y, BEND - (BEND - z) * c - z);
    turned.push(0, ny * c - nz * s - ny, ny * s + nz * c - nz);
  }

  // Each step of the peel as offsets, the same curl about the fold instead, at curvature k: d is how
  // far a point lies past the fold toward the near edge, and only points past it move.
  const fold = -h / 2 + PEEL.fold;
  const steps = Array.from({ length: PEEL.steps }, (_, step) => {
    const k = ((step + 1) / PEEL.steps) * (PEEL.angle / PEEL.fold);
    const peeled: number[] = [];
    const tipped: number[] = [];
    for (let i = 0; i < position.length; i += 3) {
      const [y, z, ny, nz] = [position[i + 1], position[i + 2], normal[i + 1], normal[i + 2]];
      const d = fold - y;
      if (d <= 0) {
        peeled.push(0, 0, 0);
        tipped.push(0, 0, 0);
        continue;
      }
      const [s, c] = [Math.sin(k * d), Math.cos(k * d)];
      peeled.push(0, d - (1 / k - z) * s, 1 / k - (1 / k - z) * c - z);
      tipped.push(0, ny * c + nz * s - ny, nz * c - ny * s - nz);
    }
    return [new THREE.Float32BufferAttribute(peeled, 3), new THREE.Float32BufferAttribute(tipped, 3)];
  });
  g.morphAttributes.position = [new THREE.Float32BufferAttribute(bent, 3), ...steps.map(([p]) => p)];
  g.morphAttributes.normal = [new THREE.Float32BufferAttribute(turned, 3), ...steps.map(([, n]) => n)];
  g.morphTargetsRelative = true;
  g.computeBoundingSphere();
  // Room for the bend, which the bounds don't see, so a curled card is never culled.
  g.boundingSphere!.radius += h / 4;
  return g;
}

/** The cell of card i in an atlas laid out as scripts/make-card-faces.mjs packs it. */
export function atlasCell(
  { cell, cols }: { cell: { w: number; h: number; gutter: number }; cols: number },
  count: number,
  i: number,
): Cell {
  const [dx, dy] = [cell.w + cell.gutter, cell.h + cell.gutter];
  const [W, H] = [dx * cols - cell.gutter, dy * Math.ceil(count / cols) - cell.gutter];
  const [col, row] = [i % cols, Math.floor(i / cols)];
  // Textures load flipped, so v counts up from the bottom of the image.
  return { u0: (col * dx) / W, u1: (col * dx + cell.w) / W, v0: 1 - (row * dy + cell.h) / H, v1: 1 - (row * dy) / H };
}
