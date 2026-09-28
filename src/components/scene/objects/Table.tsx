import { useLoader, useThree } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { SEATS, TABLE } from './layout';

const { half: HALF, radius: RADIUS, rail: RAIL } = TABLE;
const FELT = RADIUS - RAIL; // the radius of the felt's rounded ends
const SLAB = 0.035; // the walnut edge under the rail
const PAD = { width: RAIL + 0.01, height: 0.04, round: 3 }; // the rail overhangs the walnut by a centimetre
const CUP = { radius: 0.034, depth: 0.05 };
// Felt nap from ambientCG Fabric034 (CC0, https://ambientcg.com/a/Fabric034), one tile every 15 cm.
const NAP = 0.15;

/** The oval table: walnut slab, felt top, printed brass lines, padded rail and cup holders. */
export function Table() {
  const nap = useLoader(THREE.TextureLoader, '/textures/felt-normal.webp');
  const { gl } = useThree();

  const { slab, rail, cup, lines } = useMemo(() => {
    nap.wrapS = nap.wrapT = THREE.RepeatWrapping;
    nap.repeat.setScalar(1 / NAP);
    nap.anisotropy = gl.capabilities.getMaxAnisotropy();

    // The slab's top cap is the felt and its sides are the walnut edge. Cap UVs are in metres.
    const slab = new THREE.ExtrudeGeometry(stadium(RADIUS), { depth: SLAB, bevelEnabled: false, curveSegments: 48 });
    slab.rotateX(-Math.PI / 2).translate(0, -SLAB, 0);

    const cup = new THREE.LatheGeometry(
      [
        [CUP.radius + 0.006, -0.008],
        [CUP.radius + 0.006, -0.001],
        [CUP.radius + 0.005, 0],
        [CUP.radius + 0.001, 0],
        [CUP.radius, -0.002],
        [CUP.radius, -CUP.depth],
        [0, -CUP.depth],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      32,
    );
    return { slab, rail: railGeometry(), cup, lines: printedLines() };
  }, [nap, gl]);
  useEffect(() => () => [slab, rail, cup, lines].forEach((o) => o.dispose()), [slab, rail, cup, lines]);

  // Cup holders sit between the seats on the crest of the rail, so the player's seat has one on
  // each side, like the two in the bottom corners of the painted table.
  const crest = FELT + PAD.width / 2;
  const cups = Array.from({ length: SEATS }, (_, k) => along(((k + 0.5) / SEATS) * perimeter(crest), crest));
  const lip = PAD.height + 0.002;

  return (
    <group>
      <mesh geometry={slab} receiveShadow>
        {/* ExtrudeGeometry puts the caps in group 0 and the sides in group 1. */}
        <meshPhysicalMaterial
          attach="material-0"
          color="#2E4C3A"
          roughness={0.9}
          sheen={1}
          sheenColor="#4A6B55"
          sheenRoughness={0.8}
          normalMap={nap}
          normalScale={[0.6, 0.6]}
        />
        <meshStandardMaterial attach="material-1" color="#3B2517" roughness={0.45} />
      </mesh>

      {/* Printed on the felt: brass ink at low opacity, lit like the felt so it never glows. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.0002} receiveShadow>
        <planeGeometry args={[2 * (HALF + FELT), 2 * FELT]} />
        <meshStandardMaterial color="#AD9773" alphaMap={lines} transparent opacity={0.5} roughness={0.9} depthWrite={false} />
      </mesh>

      <mesh geometry={rail} castShadow receiveShadow>
        <meshStandardMaterial color="#3A3329" roughness={0.5} />
      </mesh>

      {/* Each cup draws first, then a disc over its mouth writes depth only, so the rail that
          runs through the cup fails the depth test there and the cup reads as a hole. */}
      <Instances geometry={cup} limit={SEATS} renderOrder={-2} castShadow receiveShadow frames={1}>
        <meshStandardMaterial color="#AD9773" metalness={1} roughness={0.35} side={THREE.DoubleSide} />
        {cups.map(([x, z], k) => (
          <Instance key={k} position={[x, lip, z]} />
        ))}
      </Instances>
      <Instances limit={SEATS} renderOrder={-1} frames={1}>
        <circleGeometry args={[CUP.radius + 0.001, 32]} />
        <meshBasicMaterial colorWrite={false} />
        {cups.map(([x, z], k) => (
          <Instance key={k} position={[x, lip - 0.001, z]} rotation-x={-Math.PI / 2} />
        ))}
      </Instances>
    </group>
  );
}

// A stadium: two half circles of this radius joined by straight sides HALF either side of centre.
function stadium(radius: number) {
  return new THREE.Shape()
    .moveTo(-HALF, -radius)
    .lineTo(HALF, -radius)
    .absarc(HALF, 0, radius, -Math.PI / 2, Math.PI / 2, false)
    .lineTo(-HALF, radius)
    .absarc(-HALF, 0, radius, Math.PI / 2, (3 * Math.PI) / 2, false);
}

const perimeter = (radius: number) => 4 * HALF + 2 * Math.PI * radius;

// The point a distance s round a stadium in the table plane, starting in front of the player and
// heading toward +x.
function along(s: number, radius: number): [x: number, z: number] {
  const arc = Math.PI * radius;
  s %= perimeter(radius);
  if (s < HALF) return [s, radius];
  if ((s -= HALF) < arc) return [HALF + radius * Math.sin(s / radius), radius * Math.cos(s / radius)];
  if ((s -= arc) < 2 * HALF) return [HALF - s, -radius];
  if ((s -= 2 * HALF) < arc) return [-HALF - radius * Math.sin(s / radius), -radius * Math.cos(s / radius)];
  return [s - arc - HALF, radius];
}

// The padded rail: a rounded profile swept round the felt's edge. The profile is half a
// superellipse, puffed up enough that the cup holders sit nearly flat on top of it.
function railGeometry() {
  // Points round the felt's edge with their outward normals, both ends as half circles.
  const edge: [x: number, z: number, nx: number, nz: number][] = [];
  for (const side of [1, -1])
    for (let i = 0; i <= 48; i++) {
      const t = -Math.PI / 2 + (i / 48) * Math.PI;
      const [nx, nz] = [side * Math.cos(t), side * Math.sin(t)];
      edge.push([side * HALF + FELT * nx, FELT * nz, nx, nz]);
    }
  const profile = Array.from({ length: 17 }, (_, j) => {
    const t = Math.PI * (1 - j / 16);
    const e = 2 / PAD.round;
    return [(PAD.width / 2) * (1 + Math.sign(Math.cos(t)) * Math.abs(Math.cos(t)) ** e), PAD.height * Math.sin(t) ** e];
  });

  const position: number[] = [];
  for (const [x, z, nx, nz] of edge) for (const [u, y] of profile) position.push(x + nx * u, y, z + nz * u);
  const index: number[] = [];
  const P = profile.length;
  for (let i = 0; i < edge.length; i++) {
    const next = (i + 1) % edge.length;
    for (let j = 0; j < P - 1; j++) {
      const [a, b, c, d] = [i * P + j, next * P + j, next * P + j + 1, i * P + j + 1];
      index.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// The betting line and the dealer's spot, drawn once as an alpha map over the felt's bounds.
function printedLines() {
  const scale = 512 / (2 * FELT); // pixels per metre
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = [Math.round(2 * (HALF + FELT) * scale), 512];
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = '#fff';
  g.lineWidth = 0.005 * scale;
  // Table space to canvas: +z is down the canvas, toward the player.
  const at = (x: number, z: number): [number, number] => [(x + HALF + FELT) * scale, (z + FELT) * scale];

  const r = FELT - 0.22;
  g.beginPath();
  g.arc(...at(HALF, 0), r * scale, -Math.PI / 2, Math.PI / 2);
  g.arc(...at(-HALF, 0), r * scale, Math.PI / 2, (3 * Math.PI) / 2);
  g.closePath();
  g.stroke();

  g.beginPath();
  g.arc(...at(0, -FELT), 0.1 * scale, 0, Math.PI);
  g.stroke();

  const t = new THREE.CanvasTexture(canvas);
  t.anisotropy = 8;
  return t;
}
