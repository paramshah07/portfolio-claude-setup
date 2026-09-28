// Converts the clean renders in /reference into the hero plates.
// Run from the repo root: node scripts/make-plates.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const plates = [
  { src: 'reference/hero-16x9.jpg', out: 'public/plates/hero-desktop.avif', budget: 250_000 },
  { src: 'reference/hero-9x16.jpg', out: 'public/plates/hero-phone.avif', budget: 120_000 },
];

await mkdir('public/plates', { recursive: true });

for (const { src, out, budget } of plates) {
  // Quality 70 is plenty for a soft render. Step down only if a new render won't fit.
  // 10-bit keeps the dark falloff from banding and comes out smaller than 8-bit here.
  for (let quality = 70; ; quality -= 5) {
    if (quality < 40) throw new Error(`${src} doesn't fit in ${budget / 1000} KB even at quality 40.`);
    const avif = await sharp(src).avif({ quality, effort: 6, bitdepth: 10 }).toBuffer();
    if (avif.length > budget) continue;
    await writeFile(out, avif);
    console.log(`${out}: quality ${quality}, ${Math.round(avif.length / 1000)} KB of ${budget / 1000} KB`);
    break;
  }
}
