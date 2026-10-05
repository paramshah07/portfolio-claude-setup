import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { useStore } from '@nanostores/react';
import { handDealt, street } from '../../../lib/state';
import type { StageProps } from '../Stage';
import atlasLayout from './atlas.json';
import { CARD, atlasCell, cardGeometry } from './card';
import { SPOTS, dealShot } from './layout';

// A full deck. Only the cards content deals ever show a face; every other card has the back on
// both sides, since any text in the scene must also be on the page.
const DECK = 52;
// A card's thickness and a whisker, so stacked cards never fight over depth.
const GAP = CARD.t + 0.00002;
const rest = (n: number) => 0.0006 + n * GAP;
// Rotations about x: lying on the felt, and stood up on the near end leaning away from the player.
const FLAT = -Math.PI / 2;
const STAND = -0.35;
const SPIN = 0.12; // how the squared deck sits on the felt
// Each card turns about a point near its near end, so it stands up on that end.
const PIVOT = CARD.h * 0.4;
const STREETS = ['preflop', 'flop', 'turn', 'river'] as const;
// No card lies quite flat: once it's down on its own it bows a little, ends up off the felt. The bend
// curls toward the back, so a face-up card bows the other way.
const BOW = 0.06;
// The spring: this many cards leave the top of the deck, and land in a ribbon spread whose last
// slot is here, each card a step to the left of the one after it.
const SPRUNG = 26;
const SPREAD = { x: SPOTS.deck.x - 0.09, z: SPOTS.deck.z + 0.09, step: 0.0072 };
// Gravity in m/s², slowed so an arc a few centimetres high reads on camera: real gravity lands a
// card from the height of the deck in a tenth of a second.
const G = 2.2;

type Bend = { v: number };

/**
 * The deck on the felt. When the visitor asks for the hand, the camera pushes in and half the deck
 * springs off the top card by card, flexed, arcs over and lands face down in a ribbon spread, then
 * zips back onto the deck. The top two slide to the player's seat face down, the camera takes the
 * player's view as each near corner peels up to show its index, then they turn face up as the camera
 * settles on the hand. Each street of the board deals onto the middle of the table as the equity
 * readout's button writes the street store, burning a card before each one.
 */
export function Deck({ hole, board, ready }: Pick<StageProps, 'hole' | 'board'> & { ready: boolean }) {
  const atlas = useLoader(THREE.TextureLoader, '/cards/atlas.webp');
  const { gl } = useThree();
  const cards = useRef<THREE.Group[]>([]);
  const meshes = useRef<THREE.Mesh[]>([]);
  const bends = useRef<Bend[]>(Array.from({ length: DECK }, () => ({ v: 0 })));
  const peels = useRef<Bend[]>(Array.from({ length: DECK }, () => ({ v: 0 })));
  const timeline = useRef<gsap.core.Timeline>(null);

  // The order the deck deals in from the top: the hole cards, then a burn card before each street.
  // Burn cards stay face down, so they're backs both ways.
  const streets = STREETS.slice(1).map((s) => board.filter((b) => b.street === s).map((b) => b.card));
  const dealing = [...hole, ...streets.flatMap((cards) => [null, ...cards])];

  // One texture upload, one material, and a geometry per face mapped to its cell of the atlas.
  const { material, plain, faces } = useMemo(() => {
    atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.anisotropy = gl.capabilities.getMaxAnisotropy();
    const count = atlasLayout.cards.length + 1;
    const back = atlasCell(atlasLayout, count, count - 1);
    return {
      // Satin stock: a clearcoat mirrors the lamps across the whole back and costs a lobe on every
      // card pixel, so the sheen comes from the base layer and the room's reflections, which the
      // scene keeps dim for the felt.
      material: new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.42, envMapIntensity: 5 }),
      plain: cardGeometry(back, back),
      faces: new Map(atlasLayout.cards.map((code, i) => [code, cardGeometry(back, atlasCell(atlasLayout, count, i))])),
    };
  }, [atlas, gl]);
  useEffect(() => () => [material, plain, ...faces.values()].forEach((o) => o.dispose()), [material, plain, faces]);

  useFrame(() =>
    meshes.current.forEach((mesh, i) => {
      mesh.morphTargetInfluences![0] = bends.current[i].v;
      mesh.morphTargetInfluences![1] = peels.current[i].v;
    }),
  );

  // Squared up face down on the felt, then the spring, the hole cards and each street as the store
  // reaches it, all on one timeline so a street that arrives early waits for the deal before it.
  // The content can't change after load, so this runs once.
  useLayoutEffect(() => {
    cards.current.forEach((card, i) => {
      card.position.set(SPOTS.deck.x, rest(i), SPOTS.deck.z);
      card.rotation.set(FLAT, 0, SPIN);
    });
    const tl = (timeline.current = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } }));
    const top = deal(tl, cards.current, bends.current, peels.current, hole.length);
    const bendOf = (card: THREE.Group) => bends.current[cards.current.indexOf(card)];
    let dealt = 0;
    let next = hole.length;
    let placed = 0;
    const unsubscribe = street.subscribe((now) => {
      for (; dealt < STREETS.indexOf(now); dealt++) {
        const count = streets[dealt].length;
        dealStreet(tl, top[next], top.slice(next + 1, next + 1 + count), placed, dealt, bendOf);
        next += 1 + count;
        placed += count;
      }
      if (reduced()) tl.progress(1);
    });
    return () => {
      unsubscribe();
      tl.kill();
      Object.assign(dealShot, { open: 0, hand: 0, peel: 0, close: 0 });
    };
  }, []);

  // Once the first frame is up, the camera eases from the plate's framing to the table's.
  useEffect(() => {
    if (!ready) return;
    if (reduced()) return void (dealShot.open = 1);
    const tween = gsap.to(dealShot, { open: 1, duration: 2.2, ease: 'power2.inOut', delay: 0.6 });
    return () => void tween.kill();
  }, [ready]);

  // The hand deals when the visitor asks for it, once the first frame is up.
  const asked = useStore(handDealt);
  useEffect(() => {
    if (!ready || !asked) return;
    timeline.current?.play();
    if (reduced()) timeline.current?.progress(1);
  }, [ready, asked]);

  return (
    <>
      {Array.from({ length: DECK }, (_, i) => {
        const code = dealing[DECK - 1 - i];
        return (
          <group key={i} ref={(g) => void (g && (cards.current[i] = g))}>
            <mesh
              ref={(m) => {
                if (!m) return;
                meshes.current[i] = m;
                // r3f sets the geometry after the mesh is made, so its morph targets need counting.
                m.updateMorphTargets();
              }}
              position-y={PIVOT}
              geometry={(code && faces.get(code)) || plain}
              material={material}
              castShadow
              receiveShadow
            />
          </group>
        );
      })}
    </>
  );
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Where a card's pivot goes for its centre to land on (x, z) lying flat, given its spin and
// which side is up.
function pivot(x: number, z: number, spin: number, faceUp: boolean) {
  return { x: x + (faceUp ? -1 : 1) * PIVOT * Math.sin(spin), z: z + PIVOT * Math.cos(spin) };
}

// Lay a card down, slide it across the felt and let it settle.
function slide(tl: gsap.core.Timeline, card: THREE.Group, to: { x: number; z: number }, y: number, spin: number, at: number) {
  tl.to(card.position, { ...to, y, duration: 0.8 }, at);
  tl.to(card.rotation, { x: FLAT, z: spin, duration: 0.8 }, at);
}

// Turn a card face up about its long edge, lifting it just enough to clear the felt, and let it
// settle into its bow.
function flip(tl: gsap.core.Timeline, card: THREE.Group, bend: Bend, y: number, at: number) {
  const lift = () => void (card.position.y = y + (CARD.w / 2 + 0.004) * Math.sin(card.rotation.y));
  tl.to(card.rotation, { y: Math.PI, duration: 0.7, ease: 'expo.out', onUpdate: lift }, at);
  tl.to(bend, { v: -BOW, duration: 0.5 }, at + 0.4);
}

// Fly a card from height y to `to` under gravity, rising `lift` first: level speed across and a
// parabola up and down. Returns when it lands.
function hop(tl: gsap.core.Timeline, card: THREE.Group, to: { x: number; y: number; z: number }, y: number, lift: number, at: number) {
  const up = Math.sqrt((2 * lift) / G);
  const down = Math.sqrt((2 * (y + lift - to.y)) / G);
  tl.to(card.position, { x: to.x, z: to.z, duration: up + down, ease: 'none' }, at);
  tl.to(card.position, { y: y + lift, duration: up, ease: 'power1.out' }, at);
  tl.to(card.position, { y: to.y, duration: down, ease: 'power1.in' }, at + up);
  return at + up + down;
}

// The spring, then the hole cards: the top SPRUNG cards leave the deck one after another. Each
// stands up on its near end flexed, springs over in an arc, straightening and falling flat as it
// comes down, and lands face down in the spread, each on top of the one before and a step nearer
// the deck, then slides a few millimetres. The spread zips back onto the deck nearest card first,
// which puts every card back where it was. Then the top cards slide to the player's seat face down,
// the player peels up each near corner to see them, and they turn face up. Returns the deck from
// the top down.
function deal(tl: gsap.core.Timeline, cards: THREE.Group[], bends: Bend[], peels: Bend[], dealt: number) {
  const { x, z } = SPOTS.deck;
  const top = [...cards].reverse();
  // The camera pushes in on the deck first, and the spring starts as it arrives.
  tl.to(dealShot, { close: 1, duration: 1.1, ease: 'power2.inOut' }, 0);

  top.slice(0, SPRUNG).forEach((card, d) => {
    const bend = bends[cards.length - 1 - d];
    const y = rest(cards.length - 1 - d) + 0.012;
    const at = 0.8 + d * 0.048;
    // Turned a little toward the camera, so the flex shows in the card's outline.
    tl.to(card.position, { x: x - 0.012, y, duration: 0.24, ease: 'power2.out' }, at);
    tl.to(card.rotation, { x: STAND, y: 0.45, z: SPIN + 0.3, duration: 0.24, ease: 'power2.out' }, at);
    tl.to(bend, { v: 0.9, duration: 0.24, ease: 'power2.out' }, at);

    // Overlapping cards rest on the ones under them, so they tilt a little and sit a little higher.
    const under = Math.min(d, 8);
    const slot = pivot(SPREAD.x - (SPRUNG - 1 - d) * SPREAD.step, SPREAD.z, 0, false);
    const lands = hop(tl, card, { ...slot, y: rest(0) + (under * GAP) / 2 + d * 0.00001 }, y, 0.07 + (d % 3) * 0.01, at + 0.24);
    const flight = lands - at - 0.24;
    tl.to(card.rotation, { x: FLAT, y: (-under * GAP) / CARD.w, z: 0.02 * Math.sin(d * 7.3), duration: flight, ease: 'power2.in' }, at + 0.24);
    // It holds the flex over the top of the arc and straightens as it comes down.
    tl.to(bend, { v: 0, duration: flight, ease: 'sine.in' }, at + 0.24);
    tl.to(card.position, { x: slot.x - 0.003, duration: 0.2 }, lands);
  });

  tl.addLabel('gather', '+=0.35');
  top.slice(0, SPRUNG).forEach((card, d) => {
    const at = tl.labels.gather + (SPRUNG - 1 - d) * 0.016;
    tl.to(card.position, { x, y: rest(cards.length - 1 - d), z, duration: 0.42, ease: 'power2.inOut' }, at);
    tl.to(card.rotation, { x: FLAT, y: 0, z: SPIN, duration: 0.42, ease: 'power2.inOut' }, at);
  });

  // The hole cards slide to the seat face down while the camera comes round to the player's own
  // view. The peel shot sits under the close one, so letting go of close moves straight to it.
  const hand = top.slice(0, dealt);
  const spins = hand.map((_, n) => (n ? -0.05 : 0.07));
  const seat = (n: number) => SPOTS.seat.x + (n - (dealt - 1) / 2) * 0.07;
  tl.addLabel('deal', '+=0.3');
  tl.set(dealShot, { peel: 1 }, 'deal');
  tl.to(dealShot, { close: 0, duration: 1.5, ease: 'power2.inOut' }, 'deal');
  hand.forEach((card, n) => slide(tl, card, pivot(seat(n), SPOTS.seat.z, spins[n], false), rest(n), spins[n], tl.labels.deal + n * 0.3));

  // The player lifts each near corner to see what they hold, the left card first, then lays both down.
  tl.addLabel('peel', 'deal+=1.5');
  hand.forEach((card, n) => {
    const peel = peels[cards.indexOf(card)];
    tl.to(peel, { v: 1, duration: 0.55, ease: 'power2.out' }, tl.labels.peel + n * 0.45);
    tl.to(peel, { v: 0, duration: 0.4, ease: 'power2.in' }, tl.labels.peel + 1.7 + n * 0.15);
  });

  // Then they turn face up where they lie and the camera settles on the hand. A card turns about its
  // long edge, so its pivot shifts a few millimetres across as it goes over.
  tl.addLabel('show', 'peel+=2.4');
  tl.set(dealShot, { hand: 1 }, 'show');
  tl.to(dealShot, { peel: 0, duration: 1.4, ease: 'power2.inOut' }, 'show');
  hand.forEach((card, n) => {
    const at = tl.labels.show + 0.2 + n * 0.25;
    tl.to(card.position, { x: pivot(seat(n), SPOTS.seat.z, spins[n], true).x, duration: 0.7, ease: 'expo.out' }, at);
    flip(tl, card, bends[cards.indexOf(card)], rest(n), at);
  });
  return top;
}

// Burn the top card to the muck, then slide the street's cards onto the board, the first of them
// at board position placed, and turn them over. k counts the streets, so each burn card lands on
// the one before it.
function dealStreet(tl: gsap.core.Timeline, burn: THREE.Group, cards: THREE.Group[], placed: number, k: number, bendOf: (card: THREE.Group) => Bend) {
  const at = tl.duration();
  const { muck, board } = SPOTS;
  const spin = [0.4, -0.2, 0.15][k];
  slide(tl, burn, pivot(muck.x + k * 0.01, muck.z, spin, false), rest(k), spin, at);
  // The first burn card lies alone, face down, so it bows toward its back. The rest land on it.
  if (k === 0) tl.to(bendOf(burn), { v: BOW, duration: 0.5 }, at + 0.6);

  cards.forEach((card, n) => {
    const j = placed + n;
    const spin = [0.01, -0.02, 0.015, -0.01, 0.02][j];
    const start = at + 0.4 + n * 0.15;
    slide(tl, card, pivot(board.x + (j - 2) * 0.072, board.z, spin, true), rest(0), spin, start);
    flip(tl, card, bendOf(card), rest(0), start + 0.75);
  });
}
