import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { tier, type Tier } from '../../lib/state';
import { hud, renderStats, type RenderStats } from '../../lib/state/hud';
import { Panel } from './Panel';

type Key = Pick<KeyboardEvent, 'key' | 'repeat' | 'metaKey' | 'ctrlKey' | 'altKey'>;

/** H toggles the HUD, but not while someone is typing or holding a modifier for a browser shortcut. */
export function isHudKey(event: Key, typing: boolean) {
  return event.key.toLowerCase() === 'h' && !typing && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey;
}

/** Median and 95th percentile (nearest rank) of a second's frame times in ms, and the fps they add up to. */
export function frameStats(times: readonly number[]) {
  if (times.length === 0) return null;
  const sorted = times.toSorted((a, b) => a - b);
  const mid = sorted.length >> 1;
  return {
    median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    fps: (1000 * sorted.length) / sorted.reduce((sum, t) => sum + t, 0),
  };
}

type Snapshot = { frames: ReturnType<typeof frameStats>; stats: RenderStats | null; tier: Tier };

/**
 * Times the page's own frames with requestAnimationFrame while on, and every quarter second
 * reads that plus the stage's renderer counters. Off, it runs nothing at all.
 */
function useSnapshot(on: boolean) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  useEffect(() => {
    if (!on) return;
    let frames: { at: number; ms: number }[] = [];
    let last = 0;
    let raf = requestAnimationFrame(function frame(now) {
      // A hidden tab pauses frames, and that gap isn't a frame.
      if (last && now - last < 1000) frames.push({ at: now, ms: now - last });
      last = now;
      raf = requestAnimationFrame(frame);
    });
    const read = () => {
      const since = performance.now() - 1000;
      frames = frames.filter((f) => f.at > since);
      setSnapshot({ frames: frameStats(frames.map((f) => f.ms)), stats: renderStats.get(), tier: tier.get() });
    };
    read();
    const timer = setInterval(read, 250);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
    };
  }, [on]);
  return on ? snapshot : null;
}

const number = new Intl.NumberFormat('en-US');
const ms = (value: number) => `${value.toFixed(1)} ms`;
const TIERS: Record<Tier, string> = { high: 'High', medium: 'Medium', low: 'Low', static: 'Static' };
const COUNTERS = [
  ['Draw calls', 'calls'],
  ['Triangles', 'triangles'],
  ['Geometries', 'geometries'],
  ['Textures', 'textures'],
  ['Shader programs', 'programs'],
] as const;

/** The HUD's numbers. The This Table panel shows them too. The stage's counters read "–" while nothing renders, as on the static tier. */
export function PerfStats({ on }: { on: boolean }) {
  const snapshot = useSnapshot(on);
  const frames = snapshot?.frames;
  const stats = snapshot?.stats;
  const rows: [string, string][] = [
    ['Frame rate', frames ? `${Math.round(frames.fps)} fps` : '–'],
    ['Median frame', frames ? ms(frames.median) : '–'],
    ['95th percentile', frames ? ms(frames.p95) : '–'],
    ['DPR', number.format(stats?.dpr ?? devicePixelRatio)],
    ['Quality tier', snapshot ? TIERS[snapshot.tier] : '–'],
    ...COUNTERS.map(([label, key]): [string, string] => [label, stats ? number.format(stats[key]) : '–']),
  ];
  return (
    <dl className="hud-rows">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The performance HUD. The H key, the palette and the stats panel's toggle open and close it. */
export default function PerfHud() {
  const open = useStore(hud);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // A modal dialog covers the HUD, so H would only toggle it out of sight.
    const onKey = (event: KeyboardEvent) => {
      const typing = !!(event.target as Element).closest?.('input, textarea, select, [contenteditable]');
      if (isHudKey(event, typing) && !document.querySelector('dialog:modal')) hud.set(!hud.get());
    };
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element).closest('[data-hud-toggle]')) hud.set(!hud.get());
    };
    const toggle = document.querySelector('[data-hud-toggle]');
    // The stats panel's toggle waits for JavaScript, since the HUD can't open without it.
    toggle?.removeAttribute('hidden');
    const unsubscribe = hud.subscribe((on) => {
      toggle?.setAttribute('aria-pressed', String(on));
      // Closing with focus inside, from its button or with H, hands focus back to whatever opened
      // it. This runs before React removes the HUD, and it doesn't scroll the page back there.
      if (!on && document.activeElement?.closest('.perf-hud')) opener.current?.focus({ preventScroll: true });
    });
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      unsubscribe();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, []);

  useEffect(() => {
    if (open) opener.current = document.activeElement as HTMLElement | null;
  }, [open]);

  if (!open) return null;
  return (
    <section className="perf-hud" aria-labelledby="perf-hud-title">
      <Panel
        id="perf-hud-title"
        title="Performance"
        end={
          <button type="button" aria-label="Close performance HUD" onClick={() => hud.set(false)}>
            Close
          </button>
        }
      >
        <PerfStats on />
      </Panel>
    </section>
  );
}
