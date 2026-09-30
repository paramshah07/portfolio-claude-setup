import { Instance, Instances, Text } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { StageProps } from '../Stage';
import { CHIP, chipGeometry } from './chip';
import garamond from './eb-garamond-500.woff?url';
import { SPOTS } from './layout';

// Clay in the token colours, in the order The Table section colours its teams: cream with red
// spots, then panel, felt and card red with cream spots. scripts/make-chip-maps.mjs draws them.
const CLAYS = ['cream', 'panel', 'felt', 'red'];
const MAPS = [...CLAYS.map((clay) => `/textures/chip-${clay}.webp`), '/textures/chip-normal.webp', '/textures/chip-orm.webp'];
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
  const maps = useLoader(THREE.TextureLoader, MAPS);
  const { geometry, materials } = useMemo(() => {
    const [normalMap, orm] = maps.slice(CLAYS.length);
    return {
      geometry: chipGeometry(),
      // The shared map carries occlusion in red, roughness in green and metalness in blue, so both
      // scalars stay at 1. Reflections come back up from the scene's dim level for the clay's sheen.
      materials: maps.slice(0, CLAYS.length).map((map) => {
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = 8;
        return new THREE.MeshStandardMaterial({
          map,
          normalMap,
          aoMap: orm,
          roughnessMap: orm,
          metalnessMap: orm,
          roughness: 1,
          metalness: 1,
          envMapIntensity: 4,
        });
      }),
    };
  }, [maps]);
  useEffect(() => () => [geometry, ...materials].forEach((o) => o.dispose()), [geometry, materials]);

  const stacks = [
    ...teams.map((team, i) => ({ x: SPOTS.stacks.x + i * SPACING, z: SPOTS.stacks.z, clay: i % CLAYS.length, count: team.members })),
    ...DECOR,
  ];
  // Every chip, sorted by clay so each clay is one instanced draw. Stacks are a little ragged,
  // with each chip nudged and turned by a fixed amount so they don't shimmer between renders.
  const byClay = CLAYS.map((_, c) =>
    stacks.flatMap((stack, s) =>
      stack.clay !== c
        ? []
        : Array.from({ length: stack.count }, (_, k) => {
            const n = s * 31 + k;
            return {
              position: [stack.x + (noise(n) - 0.5) * 0.0012, (k + 0.5) * CHIP.height, stack.z + (noise(n + 7) - 0.5) * 0.0012] as const,
              spin: noise(n + 13) * Math.PI * 2,
              // Batches of clay never quite match: each chip a few percent lighter or darker.
              shade: new THREE.Color().setScalar(0.97 + noise(n + 21) * 0.06),
            };
          }),
    ),
  );

  return (
    <group>
      {byClay.map(
        (chips, c) =>
          chips.length > 0 && (
            <Instances key={c} geometry={geometry} material={materials[c]} limit={chips.length} castShadow receiveShadow frames={1}>
              {chips.map(({ position, spin, shade }, k) => (
                <Instance key={k} position={position} rotation-y={spin} color={shade} />
              ))}
            </Instances>
          ),
      )}
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
          position={[stack.x, stack.count * CHIP.height - CHIP.recess + 0.0001, stack.z]}
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
