import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { SECTIONS, scrollProgress } from '../../../lib/state';
import { TABLE_AT, dealShot } from '../objects/layout';

export const FOV = 45;
/** The hero plate's frame (2602 x 1456), which the room plane fills at the rest pose. */
export const ASPECT = 2602 / 1456;
// Pointer parallax: the camera orbits the point it looks at by up to 2 degrees.
const TILT = THREE.MathUtils.degToRad(2);

type Pose = { at: [number, number, number]; look: [number, number, number] };

// One pose per section, in table space (the felt is y = 0 and +z points at the player's seat),
// matched to frames 01 to 06 of the concept video. The Deal is the rest pose the room plate was
// built for, at the world origin looking straight down -z, so the stage lines up with the HTML
// plate. The others look at a spot on the felt. The depth of field focuses where each one looks.
const POSES: Pose[] = [
  // The Deal: wide at seated eye level, the lamps and the room in view. It looks 0.8 m ahead,
  // which keeps the hole cards and the board in focus and the far rail soft.
  { at: [0, 0.209, 0.985], look: [0, 0.209, 0.185] },
  // The Player: a slow push toward the table, the room falling away above the far rail.
  { at: [0, 0.4, 0.8], look: [0, 0, -0.1] },
  // Hand History: tilted down toward the player's seat.
  { at: [0, 0.5, 0.62], look: [0, 0, 0.2] },
  // The Board: nearly overhead on the middle of the table.
  { at: [0, 0.9, 0.5], look: [0, 0, 0.08] },
  // The Table: a low angle across the chip stacks.
  { at: [0.25, 0.24, 0.62], look: [0.2, 0, 0.12] },
  // Showdown: pulled back to wide.
  { at: [0, 0.35, 1.2], look: [0, 0, -0.3] },
];

const flat = ({ at, look }: Pose) => {
  const [x, y, z] = new THREE.Vector3(...at).add(TABLE_AT).toArray();
  const [lx, ly, lz] = new THREE.Vector3(...look).add(TABLE_AT).toArray();
  return { x, y, z, lx, ly, lz };
};

// The deal's shots, in table space, bottom to top (see dealShot in layout.ts):
// - Open: higher and tilted down so the felt fills the lower half of the frame, the deck and chips
//   in view and the room soft above it.
// - Hand: the face-up hole cards in the lower middle, the board's place above them and the chips to
//   the right.
// - Peel: from the player's seat, looking down at the hole cards as their near corners lift.
// - Close: low over the near rail, looking a little left of the deck, so the spring and the spread
//   fill the right half of the frame clear of the hero's copy.
const shot = ({ at, look }: Pose) => ({ at: new THREE.Vector3(...at).add(TABLE_AT), look: new THREE.Vector3(...look).add(TABLE_AT) });
const SHOTS = [
  ['open', shot({ at: [0.04, 0.3, 0.86], look: [0.06, 0.03, -0.06] })],
  ['hand', shot({ at: [0.02, 0.3, 0.78], look: [0.03, 0, 0.16] })],
  ['peel', shot({ at: [-0.12, 0.15, 0.52], look: [-0.075, 0, 0.34] })],
  ['close', shot({ at: [-0.04, 0.13, 0.52], look: [0.02, 0.05, 0.05] })],
] as const;

/** Where the camera is looking, for the depth of field to focus on. */
export const focus = new THREE.Vector3();
const offset = new THREE.Vector3();
const right = new THREE.Vector3();

// Scroll progress at which each section sits in the middle of the viewport, and so at its pose.
function anchors() {
  const max = document.documentElement.scrollHeight - innerHeight;
  return SECTIONS.map(({ id }, i) => {
    const el = document.getElementById(id);
    if (!i || !el || max <= 0) return 0;
    const { top, height } = el.getBoundingClientRect();
    return gsap.utils.clamp(0, 1, (top + scrollY + height / 2 - innerHeight / 2) / max);
  });
}

/**
 * Scrubs the camera through the section poses with the scroll, easing power2.inOut between each
 * pair, and adds a little pointer parallax on top. The path is a paused timeline in scroll
 * progress units, rebuilt whenever the page's layout changes.
 */
export function Camera() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const pointer = useRef({ x: 0, y: 0 });

  // object-fit: cover, like the HTML plate. A viewport wider than the plate narrows the field of
  // view, so the room, the table and the cards all crop and zoom together.
  useLayoutEffect(() => {
    const cover = Math.max(1, size.width / size.height / ASPECT);
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV / 2)) / cover));
    cam.updateProjectionMatrix();
  }, [camera, size]);
  const state = useRef({ progress: scrollProgress.get(), yaw: 0, pitch: 0 });
  const path = useRef<{ tl: gsap.core.Timeline; pose: ReturnType<typeof flat> }>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / innerHeight) * 2 - 1;
    };
    const build = () => {
      path.current?.tl.kill();
      const at = anchors();
      const pose = flat(POSES[0]);
      const tl = gsap.timeline({ paused: true });
      POSES.slice(1).forEach((p, i) => tl.to(pose, { ...flat(p), duration: at[i + 1] - at[i], ease: 'power2.inOut' }, at[i]));
      path.current = { tl, pose };
    };
    build();
    const layout = new ResizeObserver(build);
    layout.observe(document.body);
    addEventListener('pointermove', move, { passive: true });
    return () => {
      layout.disconnect();
      path.current?.tl.kill();
      removeEventListener('pointermove', move);
    };
  }, []);

  useFrame(({ camera }, dt) => {
    if (!path.current) return;
    const s = state.current;
    const damp = THREE.MathUtils.damp;
    // A short lag on the scroll, so a wheel's steps glide instead of jump.
    s.progress = damp(s.progress, scrollProgress.get(), 4, dt);
    s.yaw = damp(s.yaw, pointer.current.x * TILT, 3, dt);
    s.pitch = damp(s.pitch, -pointer.current.y * TILT, 3, dt);

    const { tl, pose } = path.current;
    tl.seek(s.progress);
    // Toward the deal's shots as the deck calls for them, each over the last, handing back to the
    // scroll path over the first 15% of the page.
    const fade = THREE.MathUtils.clamp(1 - s.progress / 0.15, 0, 1);
    focus.set(pose.lx, pose.ly, pose.lz);
    offset.set(pose.x, pose.y, pose.z);
    for (const [name, { at, look }] of SHOTS) {
      focus.lerp(look, dealShot[name] * fade);
      offset.lerp(at, dealShot[name] * fade);
    }
    offset.sub(focus);
    offset.applyAxisAngle(THREE.Object3D.DEFAULT_UP, s.yaw);
    right.crossVectors(offset, THREE.Object3D.DEFAULT_UP).normalize();
    offset.applyAxisAngle(right, s.pitch);
    camera.position.copy(focus).add(offset);
    camera.lookAt(focus);
  });
  return null;
}
