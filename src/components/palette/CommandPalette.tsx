import type { CollectionEntry } from 'astro:content';

// The palette workspace builds this with cmdk. It opens when the palette store turns true.
export default function CommandPalette(_props: { site: CollectionEntry<'profile'>['data']['site'] }) {
  return null;
}
