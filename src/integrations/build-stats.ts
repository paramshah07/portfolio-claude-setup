import type { AstroIntegration } from 'astro';

/**
 * Phase 2: writes dist/build-stats.json from the astro:build:done hook, with the bundle sizes the
 * This Table panel shows. It does nothing yet.
 */
export default function buildStats(): AstroIntegration {
  return { name: 'build-stats', hooks: {} };
}
