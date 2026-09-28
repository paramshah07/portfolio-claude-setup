import { useEffect } from 'react';
import { hud } from '../../lib/state/hud';

type Key = Pick<KeyboardEvent, 'key' | 'repeat' | 'metaKey' | 'ctrlKey' | 'altKey'>;

/** H toggles the HUD, but not while someone is typing or holding a modifier for a browser shortcut. */
export function isHudKey(event: Key, typing: boolean) {
  return event.key.toLowerCase() === 'h' && !typing && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey;
}

/**
 * Phase 2: the performance HUD, drawn from the renderStats and tier stores. It renders nothing
 * yet, but its triggers work: the H key, the palette item and the stats panel toggle, which
 * stays hidden until this renders something.
 */
export default function PerfHud() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = !!(event.target as Element).closest?.('input, textarea, select, [contenteditable]');
      if (isHudKey(event, typing)) hud.set(!hud.get());
    };
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element).closest('[data-hud-toggle]')) hud.set(!hud.get());
    };
    const unsubscribe = hud.subscribe((open) => document.querySelector('[data-hud-toggle]')?.setAttribute('aria-pressed', String(open)));
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      unsubscribe();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, []);
  return null;
}
