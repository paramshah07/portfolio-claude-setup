import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ASPECT, FOV } from './Camera';
import { flicker } from './Lights';

// The room plate sits FAR units away and depth.png pulls its nearest pixels in to NEAR.
const FAR = 10;
const NEAR = 2;
const SEGMENTS = [256, 144] as const;
// Extra plane past the frame so parallax never shows an edge. The plate mirrors into it,
// because clamping would smear the render's bright last row into a stripe.
const MARGIN = 0.08;
// The room render is the hero render's framing at 1.056 times the size, a pixel in from the top
// left, found by registering the two. This maps the hero's frame onto it.
const REGISTER = { repeat: [0.99843, 1.001], offset: [0.00036, -0.00165] } as const;

// three's AgX as rows (tonemapping_pars_fragment), for the inverse below.
const rows = (...r: number[][]) => new THREE.Matrix3().set(...(r.flat() as Parameters<THREE.Matrix3['set']>));
const SRGB_TO_2020 = rows([0.6274, 0.3293, 0.0433], [0.0691, 0.9195, 0.0113], [0.0164, 0.088, 0.8956]);
const REC2020_TO_SRGB = rows([1.6605, -0.5876, -0.0728], [-0.1246, 1.1329, -0.0083], [-0.0182, -0.1006, 1.1187]);
const INSET = rows(
  [0.856627153315983, 0.0951212405381588, 0.0482516061458583],
  [0.137318972929847, 0.761241990602591, 0.101439036467562],
  [0.11189821299995, 0.0767994186031903, 0.811302368396859],
);
const OUTSET = rows(
  [1.1271005818144368, -0.11060664309660323, -0.016493938717834573],
  [-0.1413297634984383, 1.157823702216272, -0.016493938717834257],
  [-0.14132976349843826, -0.11060664309660294, 1.2519364065950405],
);
// Matrix3 keeps its elements column by column, like GLSL's mat3.
const glsl = (m: THREE.Matrix3) => `mat3(${m.elements.map((v) => v.toFixed(9)).join(', ')})`;

// The plate is already a finished, display-referred image, and AgX would tone map it a second
// time. So it goes in through AgX's inverse and comes back out of the tone mapper as itself,
// whether that's the post chain's ToneMapping or the renderer's on the low tier. Each step undoes
// one of AgX's in reverse order. The contrast curve rises steadily over [0, 1], so bisection
// inverts it; 12 halvings put every pixel of the plate within 0.2 of a level of where it started.
const AGX_INVERSE = /* glsl */ `
vec3 agxCurve(vec3 x) {
  vec3 x2 = x * x;
  vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 agxInverse(vec3 color) {
  color = pow(max(${glsl(REC2020_TO_SRGB.clone().invert())} * color, 0.0), vec3(1.0 / 2.2));
  color = ${glsl(OUTSET.clone().invert())} * color;
  vec3 lo = vec3(0.0), hi = vec3(1.0);
  for (int i = 0; i < 12; i++) {
    vec3 mid = 0.5 * (lo + hi);
    bvec3 below = lessThan(agxCurve(mid), color);
    lo = mix(lo, mid, below);
    hi = mix(mid, hi, below);
  }
  color = exp2(0.5 * (lo + hi) * 16.499999 - 12.47393);
  return ${glsl(INSET.clone().multiply(SRGB_TO_2020).invert())} * color;
}
`;

const PLATE = '/plates/room-16x9.jpg';
const DEPTH = '/plates/depth.png';
// Fetched side by side as soon as the scene loads, rather than one after the other as each suspends.
useLoader.preload(THREE.TextureLoader, PLATE);
useLoader.preload(THREE.ImageLoader, DEPTH);

// The room without the table on a plane that exactly fills the hero plate's frame at the rest pose,
// displaced along each vertex's ray to the camera. Moving along the ray keeps every pixel where it
// was at rest, so the depth only shows once the camera moves. Its lamps dim with the key's flicker.
export function Room() {
  const [map, depth] = [useLoader(THREE.TextureLoader, PLATE), useLoader(THREE.ImageLoader, DEPTH)];
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const gl = useThree((s) => s.gl);

  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = gl.capabilities.getMaxAnisotropy();
    map.wrapS = map.wrapT = THREE.MirroredRepeatWrapping;
    map.repeat.set(...REGISTER.repeat);
    map.offset.set(...REGISTER.offset);
    map.needsUpdate = true;
  }, [map, gl]);

  const geometry = useMemo(() => {
    const h = 2 * FAR * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const [sx, sy] = SEGMENTS;
    const g = new THREE.PlaneGeometry(h * ASPECT * (1 + 2 * MARGIN), h * (1 + 2 * MARGIN), sx, sy);

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
      // depth.png is inverse depth, so interpolate 1/z between the far wall and the near floor.
      const d = pixels[(row * (sx + 1) + col) * 4] / 255;
      const s = 1 / (1 + d * (FAR / NEAR - 1));
      pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s, -FAR * s);
    }
    g.computeBoundingSphere();
    return g;
  }, [depth]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => void material.current!.color.setScalar(flicker(clock.elapsedTime)));

  // Drawn after the table, so the depth test skips the AgX inverse wherever the table covers it.
  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshBasicMaterial
        ref={material}
        map={map}
        onBeforeCompile={(shader) => {
          shader.fragmentShader = shader.fragmentShader
            .replace('void main() {', `${AGX_INVERSE}\nvoid main() {`)
            .replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb = agxInverse(diffuseColor.rgb);');
        }}
      />
    </mesh>
  );
}
