import { useEffect } from 'react';
import { thisTableOpen } from '../../lib/state/hud';

/**
 * Phase 2: the slide-over dialog about how the site is built. It renders nothing yet, but the
 * palette item and the footer link, which stays hidden until this renders something, already
 * open it through the thisTableOpen store.
 */
export default function ThisTablePanel() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element).closest('[data-this-table]')) thisTableOpen.set(true);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
