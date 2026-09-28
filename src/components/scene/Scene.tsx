import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { scrollProgress, tier } from '../../lib/state';
import type { StageProps } from './Stage';

const FOV = 45;
// The room plate sits FAR units away and depth.png pulls its nearest pixels in to NEAR.
const FAR = 10;
const NEAR = 2;
const SEGMENTS = [256, 144] as const;
// Extra plane past the frame so parallax never shows an edge. The plate mirrors into it,
// because clamping would smear the render's bright last row into a stripe.
const MARGIN = 0.08;
// The camera orbits a point just behind the deck by at most 2 degrees. A pivot near the cards
// keeps them steady while the room pans, with a little parallax between the rail and the wall.
const PIVOT = 1;
const TILT = THREE.MathUtils.degToRad(2);
// How far the camera moves in across the whole page. The hero is the first sixth or so,
// where this reads as a few centimetres toward the deck.
const DOLLY = 0.35;

// Must match scripts/make-card-faces.mjs: the hole cards in content order, then the back.
const CELL = { w: 512, h: 716, gutter: 16 };
const CARD = { w: 0.063, h: 0.088 };
const DECK = 16;
// Card indices bottom to top once the riffle interleaves the two halves.
const RIFFLED = Array.from({ length: DECK / 2 }, (_, k) => [k, DECK / 2 + k]).flat();

type Assets = { atlas: THREE.Texture; depth: HTMLImageElement };

// The plate is the page's own <img>, already decoded, so the WebGL room is the same pixels.
export default function Scene({ hole }: StageProps) {
  const [assets, setAssets] = useState<Assets | null>(null);
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState(true);

  useEffect(() => {
    Promise.all([
      new THREE.TextureLoader().loadAsync('/cards/atlas.webp'),
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = '/plates/depth.png';
      }),
    ]).then(([atlas, depth]) => setAssets({ atlas, depth }), () => tier.set('static'));
  }, []);

  // Render only while the hero is on screen and the tab is visible.
  useEffect(() => {
    const deal = document.getElementById('the-deal');
    let onScreen = true;
    const update = () => setActive(onScreen && !document.hidden);
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    });
    if (deal) io.observe(deal);
    document.addEventListener('visibilitychange', update);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  if (!assets) return null;
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      frameloop={active ? 'always' : 'never'}
      camera={{ fov: FOV, near: 0.05, far: 50, position: [0, 0, 0] }}
      style={{ position: 'absolute', inset: 0, opacity: shown ? 1 : 0, transition: 'opacity 600ms ease' }}
      onCreated={({ gl }) => {
        // No error on screen: the plate underneath is the static tier.
        gl.domElement.addEventListener('webglcontextlost', () => tier.set('static'), { once: true });
      }}
    >
      <Rig />
      <Room depth={assets.depth} />
      {/* Stand-ins until the phase 2 light pass. Kept dim enough that card stock stays under cream. */}
      <ambientLight intensity={0.55} color="#F2D3A2" />
      <directionalLight position={[0.3, 2, 0.4]} intensity={0.5} />
      <Deck atlas={assets.atlas} hole={hole} ready={shown} />
      <FirstFrame onDone={() => setShown(true)} />
    </Canvas>
  );
}

// Fires once a frame has actually reached the screen, which starts the crossfade.
function FirstFrame({ onDone }: { onDone: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    if (++frames.current === 2) onDone();
  });
  return null;
}

// Pointer parallax and the scroll dolly. At rest the camera sits at the origin looking down -z,
// which is where the room plane lines up pixel for pixel with the HTML plate.
function Rig() {
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

// The hero plate on a plane that exactly fills the frame, displaced along each vertex's ray to
// the camera. Moving along the ray keeps every pixel where it was at rest, so the depth only
// shows once the camera moves.
function Room({ depth }: { depth: HTMLImageElement }) {
  const { size, gl } = useThree();
  const plate = document.getElementById('plate') as HTMLImageElement;
  const aspect = plate.naturalWidth / plate.naturalHeight;

  const texture = useMemo(() => {
    const t = new THREE.Texture(plate);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = gl.capabilities.getMaxAnisotropy();
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    t.needsUpdate = true;
    return t;
  }, [plate, gl]);

  const geometry = useMemo(() => {
    const h = 2 * FAR * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const [sx, sy] = SEGMENTS;
    const g = new THREE.PlaneGeometry(h * aspect * (1 + 2 * MARGIN), h * (1 + 2 * MARGIN), sx, sy);

    const canvas = document.createElement('canvas');
    [canvas.width, canvas.height] = [sx + 1, sy + 1];
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(depth, 0, 0, sx + 1, sy + 1);
    const pixels = ctx.getImageData(0, 0, sx + 1, sy + 1).data;

    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const mirror = (x: number) => (x < 0 ? -x : x > 1 ? 2 - x : x);
    for (let i = 0; i < pos.count; i++) {
      // Stretch the UVs so 0 to 1 covers the frame, and mirror the depth into the margin like the plate.
      const u = (uv.getX(i) - 0.5) * (1 + 2 * MARGIN) + 0.5;
      const v = (uv.getY(i) - 0.5) * (1 + 2 * MARGIN) + 0.5;
      uv.setXY(i, u, v);
      const col = Math.round(mirror(u) * sx);
      const row = Math.round((1 - mirror(v)) * sy);
      // depth.png is inverse depth, so interpolate 1/z between the far wall and the near rail.
      const d = pixels[(row * (sx + 1) + col) * 4] / 255;
      const s = 1 / (1 + d * (FAR / NEAR - 1));
      pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s, -FAR * s);
    }
    g.computeBoundingSphere();
    return g;
  }, [depth, aspect]);

  useEffect(() => () => (texture.dispose(), geometry.dispose()), [texture, geometry]);

  // object-fit: cover. Scaling x and y about the camera scales every projected point equally.
  const cover = Math.max(1, size.width / size.height / aspect);
  return (
    <mesh geometry={geometry} scale={[cover, cover, 1]}>
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

// Where the deck floats and where the two hole cards land, in camera space at rest.
const DECK_AT = new THREE.Vector3(0.1, -0.02, -0.75);
const LAND = [
  { position: [0.07, -0.105, -0.62], rotation: [-0.4, Math.PI, 0.08] },
  { position: [0.145, -0.1, -0.62], rotation: [-0.4, Math.PI, -0.05] },
] as const;
const GAP = 0.0004;

function Deck({ atlas, hole, ready }: { atlas: THREE.Texture; hole: readonly string[]; ready: boolean }) {
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
