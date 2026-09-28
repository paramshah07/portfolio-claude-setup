import { useLoader, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { FOV } from './Camera';

// The room plate sits FAR units away and depth.png pulls its nearest pixels in to NEAR.
const FAR = 10;
const NEAR = 2;
const SEGMENTS = [256, 144] as const;
// Extra plane past the frame so parallax never shows an edge. The plate mirrors into it,
// because clamping would smear the render's bright last row into a stripe.
const MARGIN = 0.08;

// The hero plate on a plane that exactly fills the frame, displaced along each vertex's ray to
// the camera. Moving along the ray keeps every pixel where it was at rest, so the depth only
// shows once the camera moves. The plate is the page's own <img>, already decoded, so the
// WebGL room is the same pixels.
export function Room() {
  const depth = useLoader(THREE.ImageLoader, '/plates/depth.png');
  const { size, gl } = useThree();
  const plate = document.getElementById('plate') as HTMLImageElement;
  const aspect = plate.naturalWidth / plate.naturalHeight;

  const texture = useMemo(() => {
    const t = new THREE.Texture(plate);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = gl.capabilities.getMaxAnisotropy();
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    t.needsUpdate = true;
    return t;
  }, [plate, gl]);

  const geometry = useMemo(() => {
    const h = 2 * FAR * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const [sx, sy] = SEGMENTS;
    const g = new THREE.PlaneGeometry(h * aspect * (1 + 2 * MARGIN), h * (1 + 2 * MARGIN), sx, sy);

    const canvas = document.createElement('canvas');
    [canvas.width, canvas.height] = [sx + 1, sy + 1];
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(depth, 0, 0, sx + 1, sy + 1);
    const pixels = ctx.getImageData(0, 0, sx + 1, sy + 1).data;

    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const mirror = (x: number) => (x < 0 ? -x : x > 1 ? 2 - x : x);
    for (let i = 0; i < pos.count; i++) {
      // Stretch the UVs so 0 to 1 covers the frame, and mirror the depth into the margin like the plate.
      const u = (uv.getX(i) - 0.5) * (1 + 2 * MARGIN) + 0.5;
      const v = (uv.getY(i) - 0.5) * (1 + 2 * MARGIN) + 0.5;
      uv.setXY(i, u, v);
      const col = Math.round(mirror(u) * sx);
      const row = Math.round((1 - mirror(v)) * sy);
      // depth.png is inverse depth, so interpolate 1/z between the far wall and the near rail.
      const d = pixels[(row * (sx + 1) + col) * 4] / 255;
      const s = 1 / (1 + d * (FAR / NEAR - 1));
      pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s, -FAR * s);
    }
    g.computeBoundingSphere();
    return g;
  }, [depth, aspect]);

  useEffect(() => () => (texture.dispose(), geometry.dispose()), [texture, geometry]);

  // object-fit: cover. Scaling x and y about the camera scales every projected point equally.
  const cover = Math.max(1, size.width / size.height / aspect);
  return (
    <mesh geometry={geometry} scale={[cover, cover, 1]}>
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
