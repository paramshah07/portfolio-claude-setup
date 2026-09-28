import { Instance, Instances, Text } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { StageProps } from '../Stage';
import garamond from './eb-garamond-500.woff?url';
import { SPOTS } from './layout';

const CHIP = { radius: 0.0195, height: 0.0033 };
// Clay in the token colours, in the order The Table section colours its teams.
const CLAYS = [
  { body: '#F3EEE2', spot: '#9B3A2E' }, // cream
  { body: '#363430', spot: '#F3EEE2' }, // panel
  { body: '#2E4C3A', spot: '#F3EEE2' }, // felt
  { body: '#9B3A2E', spot: '#F3EEE2' }, // card red
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
  const { geometry, materials } = useMemo(() => ({ geometry: chipGeometry(), materials: CLAYS.map(clay) }), []);
  useEffect(
    () => () => {
      geometry.dispose();
      materials.forEach((m) => (m.map?.dispose(), m.dispose()));
    },
    [geometry, materials],
  );

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
              {chips.map(({ position, spin }, k) => (
                <Instance key={k} position={position} rotation-y={spin} />
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
          position={[stack.x, stack.count * CHIP.height + 0.0002, stack.z]}
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

// A cylinder whose UVs put the edge in the bottom fifth of the texture and the faces in the rest,
// so one canvas texture covers the whole chip.
function chipGeometry() {
  const g = new THREE.CylinderGeometry(CHIP.radius, CHIP.radius, CHIP.height, 48);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const edge = 49 * 2; // the torso's vertices come first: (radial + 1) * (height + 1)
  for (let i = 0; i < uv.count; i++) uv.setY(i, i < edge ? uv.getY(i) * 0.2 : 0.2 + uv.getY(i) * 0.8);
  return g;
}

// The chip texture: the face in the top 256 x 256 and the edge, once round, in the 256 x 64 under
// it. Edge inserts and the matching wedges on the face line up, since the cylinder measures both
// by the same angle. The centre inlay is cream with a thin brass ring.
function clay({ body, spot }: (typeof CLAYS)[number]) {
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = [256, 320];
  const g = canvas.getContext('2d')!;
  g.fillStyle = body;
  g.fillRect(0, 0, 256, 320);

  const inserts = 8;
  const width = (Math.PI * 2) / inserts / 3;
  g.fillStyle = spot;
  for (let k = 0; k < inserts; k++) {
    const a = (k / inserts) * Math.PI * 2;
    const u = (a / (Math.PI * 2)) * 256;
    const w = (width / (Math.PI * 2)) * 256;
    for (const wrap of [0, 256]) g.fillRect(u - w / 2 + wrap, 256, w, 64);
    // On the face, the texture's v runs up and the canvas runs down, so the angle flips.
    g.beginPath();
    g.arc(128, 128, 128, -a - width / 2, -a + width / 2);
    g.arc(128, 128, 104, -a + width / 2, -a - width / 2, true);
    g.fill();
  }

  g.fillStyle = '#F3EEE2';
  g.beginPath();
  g.arc(128, 128, 80, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#AD9773';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(128, 128, 72, 0, Math.PI * 2);
  g.stroke();

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map, roughness: 0.8 });
}
