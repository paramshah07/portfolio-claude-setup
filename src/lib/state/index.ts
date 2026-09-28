// State shared by the page and the islands. Safe to import during SSR.
import { atom } from 'nanostores';

export const SECTIONS = [
  { id: 'the-deal', name: 'The Deal' },
  { id: 'the-player', name: 'The Player' },
  { id: 'hand-history', name: 'Hand History' },
  { id: 'the-board', name: 'The Board' },
  { id: 'the-table', name: 'The Table' },
  { id: 'showdown', name: 'Showdown' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];
export type Tier = 'high' | 'medium' | 'low' | 'static';

/** Scroll through the whole page, 0 to 1. */
export const scrollProgress = atom(0);
export const activeSection = atom<SectionId>('the-deal');
/** Whether the performance HUD is open. */
export const hud = atom(false);
/** Whether the command palette is open. */
export const palette = atom(false);

export function pickTier(env: { width: number; reducedMotion: boolean; webgl2: boolean; memory?: number }): Tier {
  // deviceMemory only exists in Chromium (in GB, capped at 8). Missing means unknown, not low.
  const { width, reducedMotion, webgl2, memory } = env;
  if (width < 768 || reducedMotion || !webgl2 || (memory !== undefined && memory < 4)) return 'static';
  return memory === 4 ? 'medium' : 'high';
}

/** Decided once on load, then adjusted by the stage's performance monitor. */
export const tier = atom<Tier>(
  typeof window === 'undefined'
    ? 'static'
    : pickTier({
        width: innerWidth,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        webgl2: 'WebGL2RenderingContext' in window,
        memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      }),
);

// Off by default and remembered. Storage throws when the visitor blocks cookies.
export const sound = atom<'on' | 'off'>(readSound());
sound.listen((value) => {
  try {
    localStorage.setItem('sound', value);
  } catch {}
});

function readSound() {
  try {
    return localStorage.getItem('sound') === 'on' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}
