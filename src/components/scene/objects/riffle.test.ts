import { expect, test } from 'vitest';
import { CHIP } from './chip';
import { STACK, riffle, stacks, type Pose } from './riffle';

const { radius: R, height: H } = CHIP;

// Seen from the front, a chip is a rectangle 2R wide and H tall turned by its tilt, and every chip
// stands in that plane, so two chips meet only where their rectangles do. This is how far they
// overlap along the axis that separates them best: zero for chips touching, negative for a gap.
function overlap(a: Pose, b: Pose) {
  const corners = (p: Pose) =>
    [
      [-R, -H / 2],
      [R, -H / 2],
      [R, H / 2],
      [-R, H / 2],
    ].map(([x, y]) => [p.x + x * Math.cos(p.tilt) - y * Math.sin(p.tilt), p.y + x * Math.sin(p.tilt) + y * Math.cos(p.tilt)]);
  return Math.min(
    ...[a.tilt, a.tilt + Math.PI / 2, b.tilt, b.tilt + Math.PI / 2].map((t) => {
      const along = (p: Pose) => corners(p).map(([x, y]) => x * Math.cos(t) + y * Math.sin(t));
      const [pa, pb] = [along(a), along(b)];
      return Math.min(Math.max(...pa) - Math.min(...pb), Math.max(...pb) - Math.min(...pa));
    }),
  );
}
const lowest = (p: Pose) => p.y - R * Math.abs(Math.sin(p.tilt)) - (H / 2) * Math.cos(p.tilt);

test('it starts as two stacks of ten, side by side and apart', () => {
  const poses = riffle(0);
  poses.forEach((p, chip) => {
    const side = chip < STACK ? -1 : 1;
    expect(Math.sign(p.x)).toBe(side);
    expect(Math.abs(p.x)).toBeGreaterThan(R);
    expect(p.y).toBeCloseTo(((chip % STACK) + 0.5) * H, 9);
    expect(p.tilt).toBeCloseTo(0, 12);
  });
});

test('a riffle leaves one squared pile, alternating between the stacks from the bottom left', () => {
  // Just before the cut, once the pile is squared.
  const pile = riffle(0.8199)
    .map((p, chip) => ({ ...p, chip }))
    .sort((a, b) => a.y - b.y);
  pile.forEach((p, slot) => {
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo((slot + 0.5) * H, 9);
    expect(p.chip < STACK).toBe(slot % 2 === 0);
  });
  expect(stacks(1).left).toEqual([0, 10, 1, 11, 2, 12, 3, 13, 4, 14]);
});

test('each riffle ends where the next one starts', () => {
  for (const n of [1, 2, 5]) {
    const [end, start] = [riffle(n - 1e-6), riffle(n)];
    end.forEach((p, chip) => {
      expect(p.x).toBeCloseTo(start[chip].x, 6);
      expect(p.y).toBeCloseTo(start[chip].y, 6);
    });
  }
});

test('no chip ever passes through another or into the felt', () => {
  let worst = { depth: 0, at: 0 };
  for (let at = 0; at <= 2; at += 0.001) {
    const poses = riffle(at);
    poses.forEach((a, i) => {
      expect(lowest(a)).toBeGreaterThan(-1e-5);
      for (const b of poses.slice(i + 1)) {
        const depth = overlap(a, b);
        if (depth > worst.depth) worst = { depth, at };
      }
    });
  }
  // A hundredth of a millimetre, for the rounding in chips that only touch.
  expect(worst.depth, `chips overlap by ${(worst.depth * 1000).toFixed(3)} mm at ${worst.at.toFixed(3)}`).toBeLessThan(1e-5);
});
