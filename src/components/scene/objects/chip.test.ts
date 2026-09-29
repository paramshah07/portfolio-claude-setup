import { expect, test } from 'vitest';
import * as THREE from 'three';
import { CHIP, MAP, chipGeometry } from './chip';

const g = chipGeometry();
const pos = g.attributes.position as THREE.BufferAttribute;
const nor = g.attributes.normal as THREE.BufferAttribute;
const uv = g.attributes.uv as THREE.BufferAttribute;

test('the chip is 39 x 3.3 mm and every triangle faces out', () => {
  const box = new THREE.Box3().setFromBufferAttribute(pos);
  expect(box.max.x).toBeCloseTo(CHIP.radius, 7);
  expect(box.max.y - box.min.y).toBeCloseTo(CHIP.height, 7);
  const index = g.index!;
  const [a, b, c, n] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let t = 0; t < index.count; t += 3) {
    const [i, j, k] = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
    a.fromBufferAttribute(pos, i);
    const area = b.fromBufferAttribute(pos, j).sub(a).cross(c.fromBufferAttribute(pos, k).sub(a));
    if (area.lengthSq() < 1e-24) continue;
    expect(area.dot(n.fromBufferAttribute(nor, i).add(b.fromBufferAttribute(nor, j)).add(c.fromBufferAttribute(nor, k)))).toBeGreaterThan(0);
  }
});

test('faces map inside the face square, and only the rim and edge onto the edge strip', () => {
  const H = MAP.face + MAP.edge;
  for (let i = 0; i < pos.count; i++) {
    const [u, v, r] = [uv.getX(i), uv.getY(i), Math.hypot(pos.getX(i), pos.getZ(i))];
    expect(u).toBeGreaterThanOrEqual(0);
    expect(u).toBeLessThanOrEqual(1);
    if (v <= MAP.edge / H + 1e-6) expect(r).toBeGreaterThanOrEqual(CHIP.radius - CHIP.rim - 1e-7);
    else expect(v).toBeGreaterThanOrEqual((MAP.edge + MAP.pad) / H - 1e-6);
  }
});
