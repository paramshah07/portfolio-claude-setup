// Estimates public/plates/depth.png from the hero render. Near is white, far is black.
// Dev only, and @huggingface/transformers isn't a project dependency, so install it first:
//   npm install --no-save @huggingface/transformers && node scripts/make-depth.mjs
import { pipeline, RawImage } from '@huggingface/transformers';
import sharp from 'sharp';

const src = process.argv[2] ?? 'reference/hero-16x9.jpg';
const out = 'public/plates/depth.png';

const estimate = await pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small');
const { depth } = await estimate(await RawImage.read(src));

// The scene samples one value per vertex of a 256 x 144 plane, so a small grayscale PNG is plenty.
// A light blur keeps sharp depth edges from tearing the mesh into long stretched triangles.
const { width, height } = await sharp(src).metadata();
await sharp(Buffer.from(depth.data), { raw: { width: depth.width, height: depth.height, channels: 1 } })
  .resize(Math.round((512 * width) / height), 512)
  .blur(2)
  .png({ compressionLevel: 9 })
  .toFile(out);
console.log(`${out}: ${depth.width} x ${depth.height} from the model`);
