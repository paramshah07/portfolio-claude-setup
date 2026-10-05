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
// The nav keeps a slot for it beside the name, shown from this width up.
const WIDE = '(min-width: 64rem)';
// The pile at its tallest, the top half lifted off it in the cut, is 38 mm. A long lens looks at its
// middle from a little above, far enough back that the widest moment, the stacks leaning out, fits.
const MIDDLE = 0.019;
const CAMERA: [number, number, number] = [0, 0.037, 0.176];
// Red and cream, which both stand out against the nav's dark rail and the room behind it.
const RED = CLAYS[3];
const CREAM = CLAYS[0];

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const turn = new THREE.Quaternion();
const euler = new THREE.Euler();
const one = new THREE.Vector3(1, 1, 1);
const colour = new THREE.Color();

/**
 * Five red chips and five cream riffled beside the name in the nav as the page scrolls, a riffle
 * for about every screen. A small canvas of its own in a slot the nav keeps for it, so it rides
 * above the sections the stage goes behind. It draws only when the scroll moves, at a fixed
 * resolution, and it's decoration: the slot hides it from assistive tech and the pointer. It
 * leaves quietly if its context is lost, and while the nav is too narrow to show the slot.
 */
export function ChipRiffle() {
  const [lost, setLost] = useState(false);
  const [shown, setShown] = useState(false);
  const slot = useSlot();
  if (lost || !slot) return null;
  return createPortal(
    <div style={{ height: '100%', opacity: shown ? 1 : 0, transition: 'opacity 600ms ease' }}>
      <Canvas
        dpr={Math.min(Math.max(1, devicePixelRatio), 2)}
        frameloop="demand"
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: 16, near: 0.05, far: 1, position: CAMERA }}
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
          </group>
        </Suspense>
        {/* The lamp from above and in front, a warm rim from behind for the edges, and a little fill. */}
        <directionalLight position={[-0.3, 0.6, 0.45]} intensity={2.6} color="#FFF8F0" />
        <directionalLight position={[0.35, 0.25, -0.5]} intensity={1.4} color="#F2D3A2" />
        <hemisphereLight args={['#F2D3A2', '#1B1009', 0.5]} />
      </Canvas>
    </div>,
    slot,
  );
}

// The nav's slot for the riffle while the screen is wide enough for the nav to show it.
function useSlot() {
  const [slot, setSlot] = useState<Element | null>(null);
  useEffect(() => {
    const wide = matchMedia(WIDE);
    const update = () => setSlot(wide.matches ? document.querySelector('[data-riffle]') : null);
    update();
    wide.addEventListener('change', update);
    return () => wide.removeEventListener('change', update);
  }, []);
  return slot;
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
    () => Array.from({ length: 2 * STACK }, (_, chip) => ({ clay: chip < STACK ? RED : CREAM, spin: noise(chip + 5) * Math.PI * 2, shade: 0.97 + noise(chip + 61) * 0.06 })),
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
