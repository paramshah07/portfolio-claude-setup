import { useLoader, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';

// Must match scripts/make-card-faces.mjs: the hole cards in content order, then the back.
const CELL = { w: 512, h: 716, gutter: 16 };
const CARD = { w: 0.063, h: 0.088 };
const DECK = 16;
// Card indices bottom to top once the riffle interleaves the two halves.
const RIFFLED = Array.from({ length: DECK / 2 }, (_, k) => [k, DECK / 2 + k]).flat();

// Where the deck floats and where the two hole cards land, in camera space at rest.
const DECK_AT = new THREE.Vector3(0.1, -0.02, -0.75);
const LAND = [
  { position: [0.07, -0.105, -0.62], rotation: [-0.4, Math.PI, 0.08] },
  { position: [0.145, -0.1, -0.62], rotation: [-0.4, Math.PI, -0.05] },
] as const;
const GAP = 0.0004;

export function Deck({ hole, ready }: { hole: readonly string[]; ready: boolean }) {
  const atlas = useLoader(THREE.TextureLoader, '/cards/atlas.webp');
  const { gl } = useThree();
  const cards = useRef<THREE.Group[]>([]);

  // One texture upload, one view per atlas cell. Mipmaps and anisotropy keep the engraving still.
  const cells = useMemo(() => {
    atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.anisotropy = gl.capabilities.getMaxAnisotropy();
    const width = CELL.w * (hole.length + 1) + CELL.gutter * hole.length;
    return Array.from({ length: hole.length + 1 }, (_, i) => {
      const t = atlas.clone();
      t.repeat.set(CELL.w / width, 1);
      t.offset.set((i * (CELL.w + CELL.gutter)) / width, 0);
      return t;
    });
  }, [atlas, gl, hole.length]);
  const back = cells[hole.length];
  const plane = useMemo(() => new THREE.PlaneGeometry(CARD.w, CARD.h), []);

  // The top cards after the riffle are the hole cards, dealt in content order.
  const faces = Array.from({ length: DECK }, (_, i) => {
    const h = DECK - 1 - RIFFLED.indexOf(i);
    return h < hole.length ? cells[h] : back;
  });

  useLayoutEffect(() => {
    cards.current.forEach((card, i) => {
      card.position.copy(DECK_AT).setZ(DECK_AT.z + i * GAP);
      card.rotation.set(-0.35, 0, 0.12);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const tl = deal(cards.current, hole.length);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) tl.progress(1);
    return () => void tl.kill();
  }, [ready, hole.length]);

  return (
    <>
      {faces.map((face, i) => (
        <group key={i} ref={(g) => void (g && (cards.current[i] = g))}>
          {/* The pivot sits at the bottom of the card, so the fan opens from one corner. */}
          <group position={[0, CARD.h * 0.4, 0]}>
            <mesh geometry={plane}>
              <meshPhysicalMaterial map={back} alphaTest={0.5} roughness={0.45} clearcoat={0.3} />
            </mesh>
            <mesh geometry={plane} rotation={[0, Math.PI, 0]}>
              <meshPhysicalMaterial map={face} alphaTest={0.5} roughness={0.45} clearcoat={0.3} />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}

// Riffle, square up, fan, deal the top cards face up toward the camera, close the fan.
function deal(cards: THREE.Group[], dealt: number) {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  const half = cards.length / 2;
  const { x, z } = DECK_AT;

  // Split the deck into two halves that lift apart and cant toward each other.
  cards.forEach((card, i) => {
    const left = i < half;
    tl.to(card.position, { x: x + (left ? -0.05 : 0.05), y: DECK_AT.y + 0.01, z: z + (i % half) * GAP, duration: 0.5, ease: 'power2.inOut' }, 0);
    tl.to(card.rotation, { z: left ? 0.3 : -0.06, duration: 0.5, ease: 'power2.inOut' }, 0);
  });

  // Interleave them bottom up, one from each side in turn.
  const order = RIFFLED.map((i) => cards[i]);
  order.forEach((card, n) => {
    tl.to(card.position, { x, y: DECK_AT.y, z: z + n * GAP, duration: 0.35 }, 0.6 + n * 0.035);
    tl.to(card.rotation, { z: 0.12, duration: 0.35 }, 0.6 + n * 0.035);
  });

  // Fan from the bottom corner, the top card furthest right.
  tl.addLabel('fan', '+=0.15');
  order.forEach((card, n) => tl.to(card.rotation, { z: 0.7 - (n / (order.length - 1)) * 1.1, duration: 0.8 }, 'fan'));

  // Deal the top cards toward the camera. The flip lands them face up.
  tl.addLabel('deal', 'fan+=0.9');
  order
    .slice(-dealt)
    .reverse()
    .forEach((card, n) => {
      const { position, rotation } = LAND[n];
      const at = `deal+=${n * 0.3}`;
      tl.to(card.position, { x: position[0], y: position[1], z: position[2], duration: 1 }, at);
      tl.to(card.rotation, { x: rotation[0], z: rotation[2], duration: 1 }, at);
      tl.to(card.rotation, { y: rotation[1], duration: 0.9, ease: 'expo.out' }, `${at}+=0.1`);
    });

  // Square the rest back into a deck.
  order.slice(0, -dealt).forEach((card) => tl.to(card.rotation, { z: 0.12, duration: 0.6, ease: 'power2.inOut' }, 'deal+=0.8'));
  return tl;
}
