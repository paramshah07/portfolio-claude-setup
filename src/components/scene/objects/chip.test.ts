import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { CHIP } from './chip';

// Each mesh's bounds straight from the glTF JSON chunk, so the test needs no loader or decoder.
function bounds(file: string) {
  const glb = readFileSync(file);
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
  return Object.fromEntries(
    json.meshes.map((m: { name: string; primitives: { attributes: { POSITION: number } }[] }) => {
      const { min, max } = json.accessors[m.primitives[0].attributes.POSITION];
      return [m.name, { min, max }];
    }),
  ) as Record<string, { min: number[]; max: number[] }>;
}

test('the chip model has its four parts, 39 x 3.3 mm, with the label below the band', () => {
  const parts = bounds('public/models/chip.glb');
  expect(Object.keys(parts).sort()).toEqual(['body', 'inserts', 'label', 'ring']);
  // The edge spots run right round the rim and through the chip.
  expect(parts.inserts.max[0]).toBeCloseTo(CHIP.radius, 5);
  expect(parts.inserts.max[1] - parts.inserts.min[1]).toBeCloseTo(CHIP.height, 5);
  // So a label on the top chip of a stack sits where the scene expects it.
  expect(parts.label.max[1]).toBeCloseTo(CHIP.height / 2 - CHIP.label, 5);
});
