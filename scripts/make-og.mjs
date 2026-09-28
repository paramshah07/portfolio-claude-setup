// Makes the 1200x630 social preview from the desktop hero render and the site name.
// Run from the repo root: node scripts/make-og.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import profile from '../src/content/profile.json' with { type: 'json' };

// Pango needs a TTF it can find, and the site's fonts only exist as build-time woff2.
// On macOS Pango defaults to CoreText, which only sees installed fonts, so switch it to
// fontconfig and give fontconfig a config whose only font is EB Garamond.
const fonts = join(tmpdir(), 'og-fonts');
await mkdir(fonts, { recursive: true });
const font = await fetch('https://cdn.jsdelivr.net/fontsource/fonts/eb-garamond@latest/latin-500-normal.ttf');
if (!font.ok) throw new Error(`Couldn't download EB Garamond (${font.status}).`);
await writeFile(join(fonts, 'eb-garamond-500.ttf'), Buffer.from(await font.arrayBuffer()));
await writeFile(
  join(fonts, 'fonts.conf'),
  `<?xml version="1.0"?>\n<fontconfig><dir>${fonts}</dir><cachedir>${fonts}/cache</cachedir></fontconfig>\n`,
);
process.env.FONTCONFIG_FILE = join(fonts, 'fonts.conf');
process.env.PANGOCAIRO_BACKEND = 'fc';

const name = await sharp({
  text: {
    text: `<span foreground="#F3EEE2">${profile.site.name}</span>`,
    font: 'EB Garamond Medium 120',
    dpi: 72,
    rgba: true,
  },
})
  .png()
  .toBuffer();

// Room at the left edge darkens so the name reads, as in the hero.
const scrim = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <linearGradient id="g"><stop offset="0" stop-color="#1B1009" stop-opacity="0.8"/><stop offset="0.6" stop-color="#1B1009" stop-opacity="0"/></linearGradient>
    <rect width="1200" height="630" fill="url(#g)"/>
  </svg>`,
);

const { height } = await sharp(name).metadata();
await sharp('reference/hero-16x9.jpg')
  .resize(1200, 630, { fit: 'cover' })
  .composite([{ input: scrim }, { input: name, left: 88, top: Math.round((630 - height) / 2) }])
  .jpeg({ quality: 85, mozjpeg: true })
  .toFile('public/og.jpg');

console.log('public/og.jpg: 1200x630');
