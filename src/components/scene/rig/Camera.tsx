import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { scrollProgress } from '../../../lib/state';

export const FOV = 45;
// The camera orbits a point just behind the deck by at most 2 degrees. A pivot near the cards
// keeps them steady while the room pans, with a little parallax between the rail and the wall.
const PIVOT = 1;
const TILT = THREE.MathUtils.degToRad(2);
// How far the camera moves in across the whole page. The hero is the first sixth or so,
// where this reads as a few centimetres toward the deck.
const DOLLY = 0.35;

// Pointer parallax and the scroll dolly. At rest the camera sits at the origin looking down -z,
// which is where the room plane lines up pixel for pixel with the HTML plate.
export function Camera() {
  const pointer = useRef({ x: 0, y: 0 });
  const pose = useRef({ yaw: 0, pitch: 0, dolly: 0 });

  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / innerHeight) * 2 - 1;
    };
    addEventListener('pointermove', move, { passive: true });
    return () => removeEventListener('pointermove', move);
  }, []);

  useFrame(({ camera }, dt) => {
    const p = pose.current;
    const damp = THREE.MathUtils.damp;
    p.yaw = damp(p.yaw, pointer.current.x * TILT, 3, dt);
    p.pitch = damp(p.pitch, -pointer.current.y * TILT, 3, dt);
    p.dolly = damp(p.dolly, scrollProgress.get() * DOLLY, 4, dt);
    const r = PIVOT - p.dolly;
    camera.position.set(
      Math.sin(p.yaw) * Math.cos(p.pitch) * r,
      Math.sin(p.pitch) * r,
      -PIVOT + Math.cos(p.yaw) * Math.cos(p.pitch) * r,
    );
    camera.lookAt(0, 0, -PIVOT);
  });
  return null;
}
