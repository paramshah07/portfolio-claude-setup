import { Instance, Instances, Text } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { StageProps } from '../Stage';
import { CHIP } from './chip';
import garamond from './eb-garamond-500.woff?url';
import { SPOTS } from './layout';

// scripts/make-chip.py models the chip in Blender: a clay body with the suits embossed round its
// band, the edge spots pressed through it, and a label with a foil ring set into each face.
const MODEL = '/models/chip.glb';
const meshopt = (loader: GLTFLoader) => loader.setMeshoptDecoder(MeshoptDecoder);
useLoader.preload(GLTFLoader, MODEL, meshopt);
const PARTS = ['body', 'inserts', 'label', 'ring'] as const;
// Clay in the token colours, in the order The Table section colours its teams: cream with card-red
// spots, then panel, felt and card red with cream spots. The cream body is a shade under the label.
const CLAYS = [
  { body: '#E9E1CF', spot: '#9B3A2E' },
  { body: '#363430', spot: '#F3EEE2' },
  { body: '#2E4C3A', spot: '#F3EEE2' },
  { body: '#9B3A2E', spot: '#F3EEE2' },
];
// Other players' stacks along the far rail, placed like the ones in the reference frames.
const DECOR = [
  { x: -0.66, z: -0.33, clay: 1, count: 7 },
  { x: -0.55, z: -0.36, clay: 3, count: 1 },
  { x: -0.44, z: -0.38, clay: 2, count: 2 },
  { x: 0.52, z: -0.37, clay: 1, count: 6 },
  { x: 0.645, z: -0.35, clay: 3, count: 3 },
  { x: 0.754, z: -0.31, clay: 3, count: 11 },
  { x: 0.86, z: -0.22, clay: 2, count: 7 },
];
const SPACING = 0.055; // between the team stacks

/**
 * Chip stacks: one per team in The Table section, a chip per member so the heights keep their
 * proportions, each labelled on its top chip, plus a few decorative stacks round the far rail.
 * The labels repeat the team names and counts The Table lists in the DOM.
 */
export function Chips({ teams }: Pick<StageProps, 'teams'>) {
  const { scene } = useLoader(GLTFLoader, MODEL, meshopt);
  const { geometries, materials } = useMemo(() => {
    // The clay and the spots take their colour from each chip, so one draw covers a part for every
    // chip on the table. Reflections come back up from the scene's dim level for the clay's sheen.
    const clay = new THREE.MeshStandardMaterial({ roughness: 0.65, envMapIntensity: 4 });
    return {
      geometries: Object.fromEntries(PARTS.map((part) => [part, (scene.getObjectByName(part) as THREE.Mesh).geometry])),
      materials: {
        body: clay,
        inserts: clay,
        label: new THREE.MeshStandardMaterial({ color: '#F3EEE2', roughness: 0.45, envMapIntensity: 4 }),
        ring: new THREE.MeshStandardMaterial({ color: '#AD9773', metalness: 1, roughness: 0.35, envMapIntensity: 10 }),
      },
    };
  }, [scene]);
  useEffect(() => () => new Set(Object.values(materials)).forEach((m) => m.dispose()), [materials]);

  const stacks = [
    ...teams.map((team, i) => ({ x: SPOTS.stacks.x + i * SPACING, z: SPOTS.stacks.z, clay: i % CLAYS.length, count: team.members })),
    ...DECOR,
  ];
  // Every chip, a little ragged in its stack, each nudged and turned by a fixed amount so nothing
  // shimmers between renders. Batches of clay never quite match, so each is a few percent lighter or
  // darker.
  const chips = stacks.flatMap((stack, s) =>
    Array.from({ length: stack.count }, (_, k) => {
      const n = s * 31 + k;
      const shade = 0.97 + noise(n + 21) * 0.06;
      return {
        position: [stack.x + (noise(n) - 0.5) * 0.0012, (k + 0.5) * CHIP.height, stack.z + (noise(n + 7) - 0.5) * 0.0012] as const,
        spin: noise(n + 13) * Math.PI * 2,
        color: {
          body: new THREE.Color(CLAYS[stack.clay].body).multiplyScalar(shade),
          inserts: new THREE.Color(CLAYS[stack.clay].spot).multiplyScalar(shade),
        } as Partial<Record<(typeof PARTS)[number], THREE.Color>>,
      };
    }),
  );

  return (
    <group>
      {PARTS.map((part) => (
        <Instances key={part} geometry={geometries[part]} material={materials[part]} limit={chips.length} castShadow receiveShadow frames={1}>
          {chips.map(({ position, spin, color }, k) => (
            <Instance key={k} position={position} rotation-y={spin} color={color[part]} />
          ))}
        </Instances>
      ))}
      {stacks.slice(0, teams.length).map((stack, i) => (
        <Text
          key={i}
          font={garamond}
          fontSize={0.0042}
          lineHeight={1.15}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
          color="#231E18"
          position={[stack.x, stack.count * CHIP.height - CHIP.label + 0.00005, stack.z]}
          rotation-x={-Math.PI / 2}
          receiveShadow
        >
          {`${teams[i].name}\n${teams[i].members}`}
        </Text>
      ))}
    </group>
  );
}

// A fixed pseudo-random number in [0, 1) for each integer.
const noise = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
