import type { APIRoute } from 'astro';

// Allows everything. The sitemap line appears once site.url is set in content.md.
export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n${site ? `\nSitemap: ${new URL('sitemap-index.xml', site)}\n` : ''}`);
