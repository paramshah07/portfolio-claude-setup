// State shared by the page and the islands. Safe to import during SSR.
import { atom } from 'nanostores';
import type { Street } from '../poker/api';

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
export { palette } from './palette';
/**
 * How far the board has dealt. The equity readout's button writes it a street at a time, and The
 * Board's cards, the stage's deck and the readout all follow it.
 */
export const street = atom<Street>('preflop');
/** Whether the visitor has asked for the hand: the hero's button or a click on its table. The stage deals once it's true. */
export const handDealt = atom(false);
/**
 * Where the hole cards are: still in the deck, face down at the player's seat, or face up. The stage
 * puts them down when they land, and the page turns them up when the visitor asks: a click anywhere
 * that isn't on a control, or the hero's button.
 */
export const holeCards = atom<'deck' | 'down' | 'up'>('deck');
/** Whether the hero's button for the face-down hole cards is hovered or focused. The stage squeezes them up while it is, as it does while the pointer is over them. */
export const peek = atom(false);

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
