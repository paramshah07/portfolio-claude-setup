import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { Bloom, DepthOfField, EffectComposer, LUT, ToneMapping } from '@react-three/postprocessing';
import { useLayoutEffect, useRef, type ComponentRef } from 'react';
import * as THREE from 'three';
import { LUTImageLoader } from 'three/examples/jsm/loaders/LUTImageLoader.js';
import { focus } from './Camera';

const LUT_URL = '/luts/warm.png';
useLoader.preload(LUTImageLoader, LUT_URL);

/**
 * The lens: depth of field on the table (high tier only), bloom that only the lamps and brass
 * highlights clear, AgX tone mapping and the warm grade from public/luts/warm.png. The vignette
 * and grain stay in the CSS overlay every tier shares. The low tier skips all of this, and the
 * renderer tone maps with AgX instead.
 */
export function Post({ dof }: { dof: boolean }) {
  // A 32 x 32 x 32 strip made by scripts/make-lut.mjs, graded on display sRGB, which is what the
  // effect hands it. It stays in NoColorSpace, as loaded.
  const { texture3D } = useLoader(LUTImageLoader, LUT_URL);
  const lens = useRef<ComponentRef<typeof DepthOfField>>(null);
  const gl = useThree((s) => s.gl);
  const dpr = useThree((s) => s.viewport.dpr);
  // The composer hands AgX back to the renderer in a passive effect, which can leave a frame on the
  // low tier drawn with no tone mapping at all. This hands it back in the same commit.
  useLayoutEffect(() => () => void (gl.toneMapping = THREE.AgXToneMapping), [gl]);
  // Focus follows the spot on the felt the camera is looking at.
  useFrame(() => void lens.current?.target?.copy(focus));

  return (
    // With depth of field at a DPR of 2, both multisampling and a half resolution bokeh cost frames
    // at 120 Hz in the traces, and the DPR smooths edges by itself. The room is soft anyway, so the
    // bokeh runs at a quarter. Everywhere else it multisamples.
    <EffectComposer multisampling={dof && dpr >= 2 ? 0 : 4}>
      {dof ? <DepthOfField ref={lens} target={focus} worldFocusRange={0.6} bokehScale={3} resolutionScale={0.25} /> : <></>}
      {/* A tight glow: a wide one spreads the plate's lamps into a warm veil over the felt. */}
      <Bloom mipmapBlur luminanceThreshold={2} luminanceSmoothing={0.5} intensity={0.12} radius={0.5} levels={5} />
      {/* postprocessing's default mode is AgX. */}
      <ToneMapping />
      <LUT lut={texture3D} />
    </EffectComposer>
  );
}
