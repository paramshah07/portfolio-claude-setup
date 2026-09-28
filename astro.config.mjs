import { defineConfig, fontProviders } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import profile from './src/content/profile.json' with { type: 'json' };

export default defineConfig({
  // The canonical URL, sitemap and social previews need site.url from content.md.
  site: profile.site.url,
  // One page, so a separate stylesheet only adds a render-blocking round trip.
  build: { inlineStylesheets: 'always' },
  integrations: [react(), sitemap()],
  vite: { plugins: [tailwindcss()] },
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'EB Garamond',
      cssVariable: '--font-garamond',
      weights: [400, 500],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['Georgia', 'serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'IBM Plex Mono',
      cssVariable: '--font-plex-mono',
      weights: [400, 500],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
  ],
});
