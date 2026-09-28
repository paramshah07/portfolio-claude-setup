import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useStore } from '@nanostores/react';
import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { activeSection, tier } from '../../../lib/state';
import { hud, renderStats, thisTableOpen } from '../../../lib/state/hud';
import { frameStats } from '../../hud/PerfHud';
import { Camera, FOV } from './Camera';
import { Lights } from './Lights';
import { Post } from './Post';
import { Room } from './Room';
import { nextTier, type Live } from './tiers';

const DPR: Record<Live, number> = { high: 2, medium: 1.5, low: 1 };

/**
 * The canvas and everything around the objects: camera, room, light, lens, quality tiers and
 * lifecycle. The objects are its children, and they get whether the first frame is on screen,
 * which is when the deal starts. Anything still loading its assets suspends, and the canvas fades
 * in once all of it has and the static shadows are baked.
 */
export function Rig({ children }: { children: (shown: boolean) => ReactNode }) {
  const [shown, setShown] = useState(false);
  const [baked, setBaked] = useState(false);
  const active = useActive();
  // The stage never mounts on the static tier, and leaving it unmounts the stage.
  const current = useStore(tier) as Live;
  // The tier the device got on load is as high as the monitor will climb back to.
  const [ceiling] = useState(current);
  const moves = useRef<number[]>([]);
  const [settled, setSettled] = useState(false);
  // Both panels show the stage's numbers.
  const stats = [useStore(hud), useStore(thisTableOpen)].some(Boolean);

  // AdaptiveDpr turns r3f's performance scale into the canvas DPR, so the tier sets that scale.
  // The canvas gets the same DPR too, since r3f puts its own dpr prop back whenever it re-renders.
  const [initial] = useState(() => dprFor(current));
  const dpr = dprFor(current);
  const scale = dpr / initial;

  return (
    <Canvas
      dpr={dpr}
      performance={{ current: scale, min: scale, max: scale }}
      shadows="percentage"
      frameloop={active ? 'always' : 'never'}
      camera={{ fov: FOV, near: 0.05, far: 50, position: [0, 0, 0] }}
      style={{ position: 'absolute', inset: 0, opacity: shown ? 1 : 0, transition: 'opacity 600ms ease' }}
      onCreated={({ gl }) => {
        // The post chain tone maps on the high and medium tiers and turns this off while it runs.
        gl.toneMapping = THREE.AgXToneMapping;
        // No error on screen: the plate underneath is the static tier.
        gl.domElement.addEventListener('webglcontextlost', () => tier.set('static'), { once: true });
      }}
    >
      <StaticOnError>
        <Suspense fallback={null}>
          <Camera />
          <Room />
          <Lights tier={current} onBaked={() => setBaked(true)} />
          {children(shown)}
          {current !== 'low' && <Post dof={current === 'high'} />}
          {baked && <FirstFrame onDone={() => setShown(true)} />}
        </Suspense>
      </StaticOnError>
      <AdaptiveDpr />
      {/* Watches only once the scene is up and rendering, so loading and pauses don't count. */}
      {shown && active && !settled && <Monitor ceiling={ceiling} moves={moves.current} onSettle={() => setSettled(true)} />}
      {stats && active && <Stats />}
    </Canvas>
  );
}

const dprFor = (t: Live) => Math.min(Math.max(1, devicePixelRatio), DPR[t]);

// Steps a tier down when frames run slow for a few seconds and back up when there's headroom. See
// nextTier for the rules. moves outlives the monitor, which remounts after every pause.
function Monitor({ ceiling, moves, onSettle }: { ceiling: Live; moves: number[]; onSettle: () => void }) {
  const move = (by: 1 | -1) => {
    const next = nextTier(tier.get() as Live, by, ceiling, moves);
    if (next.moved) {
      moves.push(by);
      tier.set(next.tier);
    }
    if (next.settled) onSettle();
  };
  return (
    <PerformanceMonitor
      // Down below 50 fps. Samples read a little over the refresh rate (about 64 at 60 Hz), so going
      // back up needs frames at the full refresh rate.
      bounds={(refresh) => [50, refresh > 100 ? 110 : 62]}
      onDecline={() => move(1)}
      onIncline={() => move(-1)}
    />
  );
}

// Renders only while the stage shows: the tab is visible and either the hero is on screen or the
// section in view lets the stage show through. Phase 1's sections sit on an opaque felt.
function useActive() {
  const [active, setActive] = useState(true);
  useEffect(() => {
    const deal = document.getElementById('the-deal');
    let hero = true;
    const update = () => setActive(!document.hidden && (hero || !covered(activeSection.get())));
    const io = new IntersectionObserver(([entry]) => {
      hero = entry.isIntersecting;
      update();
    });
    if (deal) io.observe(deal);
    const unsubscribe = activeSection.listen(update);
    document.addEventListener('visibilitychange', update);
    return () => {
      io.disconnect();
      unsubscribe();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return active;
}

// Whether the section or anything it sits in paints a solid background over the stage. Chrome
// writes a solid colour as rgb() and anything with transparency as rgba().
function covered(id: string) {
  for (let el = document.getElementById(id); el && el !== document.body; el = el.parentElement)
    if (getComputedStyle(el).backgroundColor.startsWith('rgb(')) return true;
  return false;
}

// Writes renderer.info and the frame timings to renderStats four times a second while a panel that
// shows them is open and the stage is rendering, and null otherwise. Each frame starts by reading
// what the last one drew across all its passes, then resets.
function Stats() {
  const gl = useThree((s) => s.gl);
  const times = useRef<{ at: number; ms: number }[]>([]);
  const published = useRef(0);

  useEffect(() => {
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
      renderStats.set(null);
    };
  }, [gl]);

  useFrame((_, dt) => {
    const now = performance.now();
    times.current.push({ at: now, ms: dt * 1000 });
    if (now - published.current >= 250) {
      published.current = now;
      times.current = times.current.filter((t) => t.at > now - 1000);
      const frames = frameStats(times.current.map((t) => t.ms))!;
      const { render, memory, programs } = gl.info;
      renderStats.set({
        fps: frames.fps,
        frame: { median: frames.median, p95: frames.p95 },
        dpr: gl.getPixelRatio(),
        calls: render.calls,
        triangles: render.triangles,
        geometries: memory.geometries,
        textures: memory.textures,
        programs: programs?.length ?? 0,
      });
    }
    gl.info.reset();
  }, -2);
  return null;
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
