import { AccumulativeShadows, ContactShadows, Environment, Lightformer, RandomizedLight, useEnvironment } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { memo, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Tier } from '../../../lib/state';
import { TABLE_AT } from '../objects/layout';

const LAMP = '#F2D3A2';
// The light the pendants throw on the felt. The lamp token is the glow of the shades, and baize lit
// with it turns olive, so the key is nearly white. The warmth comes from the room, brass and grade.
const KEY_COLOR = '#FFF8F0';
// The key hangs over the middle of the table a little toward the dealer, where the pendants are,
// and pools on the felt from the board to the player's seat before falling off toward the rail.
const KEY = new THREE.Vector3(0.1, 1.3, -0.25);
const POOL = new THREE.Vector3(0, 0, 0.1);
const KEY_CANDELA = 3.5;
// Reflections only: low enough that the room's bulbs don't light the table themselves.
const REFLECTIONS = 0.06;
// The felt the baked and contact shadows fall on: the straight middle of the stadium and as much of
// the rounded ends as fits under the rail, so neither catcher pokes out past the table.
const FELT = { width: 1.95, depth: 0.9 };
// Three pendants above the table, as directions from it, for brass, card stock and chip edges to catch.
const PENDANTS: [number, number, number][] = [
  [-0.5, 2, -1.4],
  [0, 2.3, -1.2],
  [0.5, 2, -1.4],
];

const HDRI = '/hdri/warm_restaurant_night_512.hdr';
useEnvironment.preload({ files: HDRI });

/** Under 3% either way, from two slow sines that never settle into a visible beat. */
export const flicker = (t: number) => 1 + 0.012 * Math.sin(t * 0.9) + 0.008 * Math.sin(t * 2.3 + 1.7);

/**
 * The warm key spot, the room's reflections with the pendants in them, shadows baked once for
 * what stays put and contact shadows for the cards and chips that move. The key casts real-time
 * shadows on the high and medium tiers only. onBaked fires once the static shadows are in.
 */
export function Lights({ tier, onBaked }: { tier: Exclude<Tier, 'static'>; onBaked: () => void }) {
  const key = useRef<THREE.SpotLight>(null);
  const { scene } = useThree();
  const [target] = useState(() => new THREE.Object3D());
  // Both kinds of shadow wait a frame, until drei's Instances have counted the chips and cups. A
  // render before that caches empty bounding spheres for them, and they'd be culled for good.
  const [bake, setBake] = useState(false);
  useLayoutEffect(() => void (bake && onBaked()), [bake]);

  useFrame(({ clock }) => {
    if (!bake) setBake(true);
    const f = flicker(clock.elapsedTime);
    key.current!.intensity = KEY_CANDELA * f;
    scene.environmentIntensity = REFLECTIONS * f;
  });

  // Before anything renders: the key's shadow renders once a frame, where left to itself it would
  // render again for every extra pass of the scene, like the contact shadows'. And postprocessing
  // leaves autoClear off between its frames, which would smear the contact shadows into trails.
  useFrame(({ gl }) => {
    key.current!.shadow.needsUpdate = true;
    gl.autoClear = true;
  }, -1);

  const size = tier === 'high' ? 2048 : 1024;
  return (
    <>
      <Reflections />
      <group position={TABLE_AT}>
        <primitive object={target} position={POOL} />
        <spotLight
          ref={key}
          position={KEY}
          target={target}
          color={KEY_COLOR}
          angle={0.62}
          penumbra={1}
          decay={2}
          castShadow={tier !== 'low'}
          shadow-autoUpdate={false}
          shadow-mapSize={[size, size]}
          // In texels, so the high tier's finer map needs twice the radius for the same penumbra.
          shadow-radius={tier === 'high' ? 6 : 2}
          shadow-bias={-0.0004}
          shadow-normalBias={0.004}
          shadow-camera-near={0.5}
          shadow-camera-far={3}
        />
        {bake && tier !== 'low' && (
          <ContactShadows position-y={0.0004} scale={1} width={FELT.width} height={FELT.depth} far={0.08} blur={1.5} opacity={0.55} color="#1B1009" />
        )}
      </group>
      {bake && <Baked />}
    </>
  );
}

// Memoised, because drei's Environment bakes again on every render.
const Reflections = memo(function Reflections() {
  return (
    <Environment files={HDRI} resolution={256}>
      {PENDANTS.map((position, i) => (
        <Lightformer key={i} form="circle" color={LAMP} intensity={6} position={position} scale={0.4} />
      ))}
    </Environment>
  );
});

// Memoised too: AccumulativeShadows bakes again on every render, and the cards would be mid-deal.
// Its types say scale is a number, but it goes straight onto the catcher mesh, so x and y work.
const CATCHER = [FELT.width, FELT.depth, 1] as unknown as number;
const Baked = memo(function Baked() {
  return (
    <AccumulativeShadows position={[TABLE_AT.x, TABLE_AT.y + 0.0003, TABLE_AT.z]} scale={CATCHER} frames={60} opacity={0.85} color="#1B1009">
      <RandomizedLight position={KEY.toArray()} radius={0.5} ambient={0.35} amount={8} size={1.4} mapSize={512} near={0.3} far={4} bias={0.0005} />
      <AimAt target={TABLE_AT} />
    </AccumulativeShadows>
  );
});

// RandomizedLight's lights aim at the world origin, which is the camera here rather than the table.
// This runs after they mount and before the bake, and points them at the table instead.
function AimAt({ target }: { target: THREE.Vector3 }) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    for (const sibling of ref.current!.parent!.children)
      for (const light of sibling.children)
        if (light instanceof THREE.DirectionalLight) {
          light.target.position.copy(target);
          light.target.updateMatrixWorld();
        }
  }, [target]);
  return <group ref={ref} />;
}
