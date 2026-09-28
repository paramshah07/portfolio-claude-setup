// The panel stores. Only the islands load this file, so these stay out of the first-paint bundle.
import { atom } from 'nanostores';

// street lives in index.ts because The Board's deal writes it from the motion pass, which loads
// index.ts anyway. Importing it here also keeps nanostores in one chunk with the palette store,
// instead of a file of its own that the nav would load before first paint.
export { street } from './index';

/** Whether the performance HUD is open. The H key, the palette and the stats panel toggle it. */
export const hud = atom(false);

/** Whether the "This Table" panel is open. The footer link and the palette open it. */
export const thisTableOpen = atom(false);

/** What the stage drew, for the performance HUD. */
export interface RenderStats {
  fps: number;
  /** Frame times over the last second, in milliseconds. */
  frame: { median: number; p95: number };
  dpr: number;
  /** The five counters from renderer.info. */
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
}

/** The stage writes this only while the HUD is open. It stays null when nothing renders, as on the static tier. */
export const renderStats = atom<RenderStats | null>(null);
