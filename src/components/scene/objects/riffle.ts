import { CHIP } from './chip';

/** Chips in each of the two stacks. */
export const STACK = 10;
const { radius: R, height: H } = CHIP;
const GAP = 0.006; // between the stacks at rest
const LEAN = 0.21; // how far the lifted stacks lean, about 12 degrees
// Where each side's chips land, this far toward their own side, so the pile falls as a zipper of two
// columns overlapping by 40% and each stack rides on its own column until the pile is squared.
const ZIP = 0.6 * R;
const CUT_LIFT = 0.005; // how high the top half lifts as it's cut
// How much of the fall each chip takes, and how far into its own drop the next chip starts. A chip
// tips down off the lifted edge first, then slides in onto the pile, and the next lands on it.
const DROP = 0.06;
const STEP = (1 - DROP) / (2 * STACK - 1);
const TIP = 0.45; // how much of its drop a chip takes to tip flat
const SLIDE = 0.35; // and where in its drop it starts to slide in
// Where each part of a riffle starts, as a fraction of it: a pause, then the press, the lift, the
// fall, squaring the pile and the cut.
const PRESS = 0.08;
const LIFT = 0.2;
const FALL = 0.34;
const SQUARE = 0.72;
const CUT = 0.82;

/** A chip's centre in the plane the stacks stand in, x across and y up, and its lean about z. */
export type Pose = { x: number; y: number; tilt: number };

const clamp = (t: number) => Math.min(1, Math.max(0, t));
const part = (t: number, from: number, to: number) => clamp((t - from) / (to - from));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// GSAP's power2.inOut and power1.in, and a smoothstep.
const inOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - 4 * (1 - t) ** 3);
const fall = (t: number) => t * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
// (x, y) turned by a about z.
const turn = (x: number, y: number, a: number) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/**
 * The two stacks at the start of riffle n, bottom to top, as chip numbers. The first starts with
 * chips 0 to 9 on the left and the rest on the right, and each one leaves the pile alternating
 * from the left, its bottom half on the left and its top half on the right.
 */
export function stacks(n: number) {
  let left = Array.from({ length: STACK }, (_, i) => i);
  let right = left.map((i) => i + STACK);
  for (let k = 0; k < n; k++) {
    const pile = left.flatMap((chip, i) => [chip, right[i]]);
    [left, right] = [pile.slice(0, STACK), pile.slice(STACK)];
  }
  return { left, right };
}

/**
 * Every chip's pose, by chip number, at a point in a run of riffles: 2.5 is halfway through the
 * third. Two stacks stand side by side. The outer fingers press them together and the middle finger
 * lifts their inner edges, so each leans out on its outer edge. As it lets go, the bottom chip of
 * each stack in turn, the left first, tips down flat on its outer edge and slides in under the other
 * stack's lifted edge, so the chips fall into a zipper of two overlapping columns that the stacks
 * ride up on as it grows. Then the pile is pushed square and its top half cut off beside it, which
 * leaves two stacks where they started, ready for the next. It's all a function of the point, so scrolling back runs it
 * backwards and nothing depends on the frame rate.
 */
export function riffle(at: number): Pose[] {
  const n = Math.floor(Math.max(0, at));
  const u = Math.max(0, at) - n;
  const { left, right } = stacks(n);
  const poses: Pose[] = [];
  const rest = R + GAP / 2;

  if (u >= CUT) {
    // The top half lifts clear, carries over and sets down where the right stack started, as the
    // bottom half slides back to the left.
    const t = part(u, CUT, 1);
    left.flatMap((chip, i) => [chip, right[i]]).forEach((chip, slot) => {
      const y = (slot + 0.5) * H;
      poses[chip] =
        slot < STACK
          ? { x: -rest * inOut(part(t, 0.1, 0.6)), y, tilt: 0 }
          : { x: rest * inOut(part(t, 0, 0.55)), y: y + CUT_LIFT * inOut(part(t, 0, 0.3)) - (STACK * H + CUT_LIFT) * inOut(part(t, 0.45, 1)), tilt: 0 };
    });
    return poses;
  }

  // Each stack's middle closes from rest to a radius out, so they touch, then they lean.
  const half = rest - (GAP / 2) * inOut(part(u, PRESS, LIFT));
  const lean = LEAN * inOut(part(u, LIFT, FALL));
  const drops = part(u, FALL, SQUARE);
  // Each chip's drop, in the order they land: the bottom left, the bottom right, the next left...
  const dropped = Array.from({ length: 2 * STACK }, (_, j) => part(drops, j * STEP, j * STEP + DROP));
  const tipped = dropped.map((s) => fall(part(s, 0, TIP)));
  const slid = dropped.map((s) => smooth(part(s, SLIDE, 1)));
  // A chip lifts the other stack as it slides in under it: the pile's height and how much of each
  // stack has left for it, in chips.
  const pile = slid.reduce((sum, b) => sum + b, 0);
  const gone = [0, 1].map((side) => slid.reduce((sum, b, j) => sum + (j % 2 === side ? b : 0), 0));
  const squared = inOut(part(u, SQUARE, CUT));

  for (let i = 0; i < STACK; i++) {
    for (const side of [0, 1]) {
      const sign = side ? 1 : -1;
      const j = 2 * i + side;
      const [a, b] = [tipped[j], slid[j]];
      // Its stack leans about the outer bottom edge, which rides on the pile, and the chip stands on
      // whatever is still under it there, not counting its own slide.
      const lift = -sign * lean;
      const [ex, ey] = turn(0, (i - gone[side] + b) * H, lift);
      // It tips flat about its outer bottom corner, which then slides in along the top of the pile.
      const ox = lerp(sign * (half + R) + ex, sign * (R + ZIP * (1 - squared)), b);
      const oy = lerp((pile - b) * H + ey, j * H, b);
      const tilt = lift * (1 - a);
      const [cx, cy] = turn(-sign * R, H / 2, tilt);
      poses[side ? right[i] : left[i]] = { x: ox + cx, y: oy + cy, tilt };
    }
  }
  return poses;
}
