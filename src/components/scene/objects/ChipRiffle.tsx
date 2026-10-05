import { ContactShadows } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { REFLECTIONS, Reflections } from '../rig/Lights';
import { CLAYS, PARTS, noise, useChip } from './Chips';
import { STACK, riffle } from './riffle';

// One riffle for every 1.2 viewport heights of scroll.
const PER = 1.2;
const riffles = () => scrollY / (PER * innerHeight);
// The pile at its tallest, the top half lifted off it in the cut, is 71 mm. The camera looks at its
// middle from a little above, near enough that the widest moment, the stacks leaning out, still fits.
const MIDDLE = 0.034;
const CAMERA: [number, number, number] = [0, 0.066, 0.231];
const RED = CLAYS[3];
const BLACK = CLAYS[1];

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const turn = new THREE.Quaternion();
const euler = new THREE.Euler();
const one = new THREE.Vector3(1, 1, 1);
const colour = new THREE.Color();

/**
 * Ten red chips and ten black riffled in the top right corner as the page scrolls, a riffle for
 * about every screen. A canvas of its own over the page, so it sits above the sections the stage
 * goes behind. It draws only when the scroll moves, at a fixed resolution, and it's decoration:
 * hidden from assistive tech and from the pointer. It leaves quietly if its context is lost.
 */
export function ChipRiffle() {
  const [lost, setLost] = useState(false);
  const [shown, setShown] = useState(false);
  if (lost) return null;
  return createPortal(
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: '4.5rem',
        right: '1.5rem',
        width: '11rem',
        height: '9rem',
        zIndex: 'var(--z-nav)',
        pointerEvents: 'none',
        opacity: shown ? 1 : 0,
        transition: 'opacity 600ms ease',
      }}
    >
      <Canvas
        dpr={Math.min(Math.max(1, devicePixelRatio), 2)}
        frameloop="demand"
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: 22, near: 0.05, far: 1, position: CAMERA }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.AgXToneMapping;
          scene.environmentIntensity = REFLECTIONS;
          gl.domElement.addEventListener('webglcontextlost', () => setLost(true), { once: true });
        }}
      >
        <Suspense fallback={null}>
          <Reflections />
          {/* Down so the camera, which looks at the origin, looks at the middle of the pile. */}
          <group position-y={-MIDDLE}>
            <Riffle onFirstFrame={() => setShown(true)} />
            <ContactShadows scale={0.14} far={0.04} blur={1.6} opacity={0.6} resolution={256} color="#1B1009" />
          </group>
        </Suspense>
        {/* The lamp from above and in front, a warm rim from behind for the edges, and a little fill. */}
        <directionalLight position={[-0.3, 0.6, 0.45]} intensity={2.6} color="#FFF8F0" />
        <directionalLight position={[0.35, 0.25, -0.5]} intensity={1.4} color="#F2D3A2" />
        <hemisphereLight args={['#F2D3A2', '#1B1009', 0.5]} />
      </Canvas>
    </div>,
    document.body,
  );
}

function Riffle({ onFirstFrame }: { onFirstFrame: () => void }) {
  const { geometries, materials } = useChip();
  const meshes = useRef<THREE.InstancedMesh[]>([]);
  const invalidate = useThree((s) => s.invalidate);
  const at = useRef(riffles());
  const first = useRef(true);
  // Each chip turned a fixed amount about its own axis, so the spots never line up, and a few percent
  // lighter or darker than its clay, as batches are.
  const chips = useMemo(
    () => Array.from({ length: 2 * STACK }, (_, chip) => ({ clay: chip < STACK ? RED : BLACK, spin: noise(chip + 5) * Math.PI * 2, shade: 0.97 + noise(chip + 61) * 0.06 })),
    [],
  );

  useLayoutEffect(() => {
    meshes.current.forEach((mesh, p) => {
      const part = PARTS[p];
      if (part !== 'body' && part !== 'inserts') return;
      chips.forEach(({ clay, shade }, i) => mesh.setColorAt(i, colour.set(part === 'body' ? clay.body : clay.spot).multiplyScalar(shade)));
      mesh.instanceColor!.needsUpdate = true;
    });
  }, [chips]);

  useEffect(() => {
    const wake = () => invalidate();
    addEventListener('scroll', wake, { passive: true });
    addEventListener('resize', wake);
    return () => {
      removeEventListener('scroll', wake);
      removeEventListener('resize', wake);
    };
  }, [invalidate]);

  useFrame((_, dt) => {
    // A short lag on the scroll, so a wheel's steps glide instead of jump, then exactly on it.
    const target = riffles();
    at.current = Math.abs(target - at.current) < 1e-4 ? target : THREE.MathUtils.damp(at.current, target, 6, Math.min(dt, 1 / 30));
    if (at.current !== target) invalidate();
    riffle(at.current).forEach(({ x, y, tilt }, i) => {
      matrix.compose(position.set(x, y, 0), turn.setFromEuler(euler.set(0, chips[i].spin, tilt, 'ZYX')), one);
      for (const mesh of meshes.current) mesh.setMatrixAt(i, matrix);
    });
    for (const mesh of meshes.current) mesh.instanceMatrix.needsUpdate = true;
    if (first.current) {
      first.current = false;
      onFirstFrame();
    }
  });

  return PARTS.map((part, p) => (
    // Never culled: the bounds instanced meshes keep are from wherever the chips first stood.
    <instancedMesh
      key={part}
      ref={(mesh) => void (mesh && (meshes.current[p] = mesh))}
      args={[geometries[part], materials[part], 2 * STACK]}
      frustumCulled={false}
    />
  ));
}
