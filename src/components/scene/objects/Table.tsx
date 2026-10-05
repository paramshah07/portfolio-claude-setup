import { useLoader, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { TABLE } from './layout';

const { half: HALF, radius: RADIUS, rail: RAIL } = TABLE;
const FELT = RADIUS - RAIL; // the radius of the felt's rounded ends
// Snooker baize from TextureCan (fabrics_0075, CC0, https://www.texturecan.com/details/527/), one
// tile every 12 cm, smooth leather from Poly Haven (leather_white, CC0), one every 40 cm, and the
// brushed, scuffed streaks of a played-on felt from ambientCG (SurfaceImperfections003, CC0), one
// every 90 cm.
const NAP = 0.12;
const GRAIN = 0.4;
const WEAR = 0.9;
// scripts/make-table.py models the table in Blender. Its UVs are in metres.
const MODEL = '/models/table.glb';
useLoader.preload(GLTFLoader, MODEL, (loader) => loader.setMeshoptDecoder(MeshoptDecoder));

/**
 * The table: the felt, the padded leather rail in panels joined between the seats, a walnut apron,
 * brass cup holders set into holes through the rail, and the printed brass lines on the felt. The
 * model names its materials, and these are the textured ones that stand in for them.
 */
export function Table() {
  const { scene } = useLoader(GLTFLoader, MODEL, (loader) => loader.setMeshoptDecoder(MeshoptDecoder));
  const [nap, grain, wear] = useLoader(THREE.TextureLoader, ['/textures/felt-normal.webp', '/textures/leather-normal.webp', '/textures/felt-wear.webp']);
  const { gl } = useThree();

  const { materials, lines } = useMemo(() => {
    for (const [map, tile] of [
      [nap, NAP],
      [grain, GRAIN],
      [wear, WEAR],
    ] as const) {
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.repeat.setScalar(1 / tile);
      map.anisotropy = gl.capabilities.getMaxAnisotropy();
    }
    const materials: Record<string, THREE.Material> = {
      // Deeper than the felt token: the warm grade and AgX pull green toward olive, and this renders
      // as the emerald baize of reference/hero-16x9.jpg. The wear map runs from 0.84 to 1, so the
      // colour sits a little lighter to come out the same on average.
      felt: new THREE.MeshPhysicalMaterial({
        color: '#1F5642',
        map: wear,
        roughness: 0.9,
        sheen: 1,
        sheenColor: '#3B785E',
        sheenRoughness: 0.8,
        normalMap: nap,
        normalScale: new THREE.Vector2(0.7, 0.7),
      }),
      // Padded leather: a soft coat gives the gentle roll-off along the rail's crest.
      // The scene's reflections are kept dim so the room's bulbs don't light the felt, so the
      // leather and brass take theirs up again: brass is only its reflections.
      leather: new THREE.MeshPhysicalMaterial({
        color: '#3A3329',
        roughness: 0.55,
        normalMap: grain,
        clearcoat: 0.25,
        clearcoatRoughness: 0.45,
        envMapIntensity: 4,
      }),
      walnut: new THREE.MeshStandardMaterial({ color: '#3B2517', roughness: 0.45 }),
      brass: new THREE.MeshStandardMaterial({ color: '#AD9773', metalness: 1, roughness: 0.35, envMapIntensity: 10 }),
    };
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.material = materials[(o.material as THREE.Material).name] ?? o.material;
      // The felt only catches shadows; everything standing on it casts them too.
      o.castShadow = o.material !== materials.felt;
      o.receiveShadow = true;
    });
    return { materials, lines: printedLines() };
  }, [scene, nap, grain, wear, gl]);
  useEffect(() => () => [lines, ...Object.values(materials)].forEach((o) => o.dispose()), [lines, materials]);

  return (
    <group>
      <primitive object={scene} />
      {/* Printed on the felt: brass ink at low opacity, lit like the felt so it never glows. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.0002} receiveShadow>
        <planeGeometry args={[2 * (HALF + FELT), 2 * FELT]} />
        <meshStandardMaterial color="#AD9773" alphaMap={lines} transparent opacity={0.5} roughness={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
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
