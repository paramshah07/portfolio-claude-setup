import { expect, test } from 'vitest';
import * as THREE from 'three';
import atlas from './atlas.json';
import { BEND, CARD, atlasCell, cardGeometry } from './card';

const count = atlas.cards.length + 1;
const [back, face] = [atlasCell(atlas, count, count - 1), atlasCell(atlas, count, 0)];
const g = cardGeometry(back, face);
const pos = g.attributes.position as THREE.BufferAttribute;
const nor = g.attributes.normal as THREE.BufferAttribute;
const uv = g.attributes.uv as THREE.BufferAttribute;
const all = Array.from({ length: pos.count }, (_, i) => i);

// Positions are float32, so they match to about 1e-8 m.
test('the card is 63 x 88 x 0.3 mm with rounded corners', () => {
  const box = new THREE.Box3().setFromBufferAttribute(pos);
  expect(box.min.toArray().map((v) => +v.toFixed(5))).toEqual([-CARD.w / 2, -CARD.h / 2, -CARD.t / 2]);
  expect(box.max.toArray().map((v) => +v.toFixed(5))).toEqual([CARD.w / 2, CARD.h / 2, CARD.t / 2]);
  // Nothing pokes out past the corner arcs.
  const [cx, cy] = [CARD.w / 2 - CARD.r, CARD.h / 2 - CARD.r];
  for (const i of all) {
    const [x, y] = [Math.abs(pos.getX(i)), Math.abs(pos.getY(i))];
    if (x > cx && y > cy) expect(Math.hypot(x - cx, y - cy)).toBeLessThanOrEqual(CARD.r + 1e-7);
  }
});

test('the back and face each read upright from their own side, and the edge faces out', () => {
  for (const i of all) {
    const [x, z, nz] = [pos.getX(i), pos.getZ(i), nor.getZ(i)];
    if (Math.abs(nz) < 0.5) {
      // Edge: horizontal and pointing away from the middle.
      expect(nor.getX(i) * x + nor.getY(i) * pos.getY(i)).toBeGreaterThan(0);
    } else if (x === CARD.w / 2) {
      // The right edge seen from the back is the left edge seen from the face.
      expect(uv.getX(i)).toBeCloseTo(nz > 0 ? back.u1 : face.u0, 6);
      expect(Math.sign(z)).toBe(Math.sign(nz));
    }
  }
  // Every triangle's winding agrees with its normals, so neither side is culled.
  const index = g.index!;
  const [a, b, c, n] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let t = 0; t < index.count; t += 3) {
    const [i, j, k] = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, j).sub(a);
    c.fromBufferAttribute(pos, k).sub(a);
    const area = b.clone().cross(c);
    if (area.lengthSq() < 1e-20) continue;
    n.fromBufferAttribute(nor, i).add(new THREE.Vector3().fromBufferAttribute(nor, j)).add(new THREE.Vector3().fromBufferAttribute(nor, k));
    expect(area.dot(n)).toBeGreaterThan(0);
  }
});

test('the bend curls the ends round a cylinder and leaves the middle alone', () => {
  const bend = g.morphAttributes.position![0];
  for (const i of all) {
    const [y, z] = [pos.getY(i) + bend.getY(i), pos.getZ(i) + bend.getZ(i)];
    // Every point keeps its distance from the axis at z = BEND.
    expect(Math.hypot(y, z - BEND)).toBeCloseTo(BEND - pos.getZ(i), 7);
    if (pos.getY(i) === 0) expect(Math.hypot(bend.getY(i), bend.getZ(i))).toBeLessThan(1e-12);
  }
});
