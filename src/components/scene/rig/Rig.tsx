import { Canvas, useFrame } from '@react-three/fiber';
import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { tier } from '../../../lib/state';
import { Camera, FOV } from './Camera';
import { Room } from './Room';

/**
 * The canvas and everything around the objects: camera, room, light and lifecycle. The objects
 * are its children, and they get whether the first frame is on screen, which is when the deal
 * starts. Anything still loading its assets suspends, and the canvas fades in once all of it has.
 */
export function Rig({ children }: { children: (shown: boolean) => ReactNode }) {
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState(true);

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
      <StaticOnError>
        <Suspense fallback={null}>
          <Camera />
          <Room />
          {/* Stand-ins until the phase 2 light pass. Kept dim enough that card stock stays under cream. */}
          <ambientLight intensity={0.55} color="#F2D3A2" />
          <directionalLight position={[0.3, 2, 0.4]} intensity={0.5} />
          {children(shown)}
          <FirstFrame onDone={() => setShown(true)} />
        </Suspense>
      </StaticOnError>
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

// A failed load drops to the static tier, which unmounts the canvas and leaves the plate.
class StaticOnError extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    tier.set('static');
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
