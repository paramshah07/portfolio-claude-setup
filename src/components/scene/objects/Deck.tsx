import { useLoader, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { street } from '../../../lib/state';
import type { StageProps } from '../Stage';
import atlasLayout from './atlas.json';
import { SPOTS } from './layout';

const CARD = { w: 0.063, h: 0.088 };
const DECK = 16;
// Card indices bottom to top once the riffle interleaves the two halves.
const RIFFLED = Array.from({ length: DECK / 2 }, (_, k) => [k, DECK / 2 + k]).flat();
// A card's thickness, a little generous so stacked cards never fight over depth.
const GAP = 0.0004;
const rest = (n: number) => 0.0006 + n * GAP;
// Rotations about x: lying on the felt, and standing up in the fan leaning away from the player.
const FLAT = -Math.PI / 2;
const STAND = -0.35;
const SPIN = 0.12; // how the squared deck sits on the felt
// Each card turns about a point near its bottom end, so the fan opens from there.
const PIVOT = CARD.h * 0.4;
// How high the fan's pivot rides over the felt, so the lowest corner of the widest card clears it.
const FAN = 0.03;
const STREETS = ['preflop', 'flop', 'turn', 'river'] as const;

/**
 * The deck on the felt. Once the first frame is up it riffles, fans and deals the hole cards to
 * the player's seat, then deals each street of the board onto the middle of the table as The
 * Board section writes the street store, burning a card before each one.
 */
export function Deck({ hole, board, ready }: Pick<StageProps, 'hole' | 'board'> & { ready: boolean }) {
  const atlas = useLoader(THREE.TextureLoader, '/cards/atlas.webp');
  const { gl } = useThree();
  const cards = useRef<THREE.Group[]>([]);
  const timeline = useRef<gsap.core.Timeline>(null);

  // The order the deck deals in from the top once the riffle is done: the hole cards, then a
  // burn card before each street. Burn cards stay face down, so they show the back both ways.
  const streets = STREETS.slice(1).map((s) => board.filter((b) => b.street === s).map((b) => b.card));
  const dealing = [...hole, ...streets.flatMap((cards) => [null, ...cards])];

  // One texture upload, one view per atlas cell and one material per face.
  const { back, faces } = useMemo(() => {
    atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.anisotropy = gl.capabilities.getMaxAnisotropy();
    const { cell, cols, cards: codes } = atlasLayout;
    const { width: W, height: H } = atlas.image as HTMLImageElement;
    const material = (i: number) => {
      const t = atlas.clone();
      t.repeat.set(cell.w / W, cell.h / H);
      t.offset.set(((i % cols) * (cell.w + cell.gutter)) / W, 1 - (Math.floor(i / cols) * (cell.h + cell.gutter) + cell.h) / H);
      return new THREE.MeshPhysicalMaterial({ map: t, alphaTest: 0.5, roughness: 0.45, clearcoat: 0.3 });
    };
    return { back: material(codes.length), faces: new Map(codes.map((code, i) => [code, material(i)])) };
  }, [atlas, gl]);
  const plane = useMemo(() => new THREE.PlaneGeometry(CARD.w, CARD.h), []);
  useEffect(
    () => () => [back, ...faces.values()].forEach((m) => (m.map?.dispose(), m.dispose())),
    [back, faces],
  );
  useEffect(() => () => plane.dispose(), [plane]);

  // Squared up face down on the felt, then the hole cards and each street as the store reaches
  // it, all on one timeline so a street that arrives early waits for the deal before it. The
  // content can't change after load, so this runs once.
  useLayoutEffect(() => {
    cards.current.forEach((card, i) => {
      card.position.set(SPOTS.deck.x, rest(i), SPOTS.deck.z);
      card.rotation.set(FLAT, 0, SPIN);
    });
    const tl = (timeline.current = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } }));
    const top = deal(tl, cards.current, hole.length);
    let dealt = 0;
    let next = hole.length;
    let placed = 0;
    const unsubscribe = street.subscribe((now) => {
      for (; dealt < STREETS.indexOf(now); dealt++) {
        const count = streets[dealt].length;
        dealStreet(tl, top[next], top.slice(next + 1, next + 1 + count), placed, dealt);
        next += 1 + count;
        placed += count;
      }
      if (reduced()) tl.progress(1);
    });
    return () => {
      unsubscribe();
      tl.kill();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    timeline.current?.play();
    if (reduced()) timeline.current?.progress(1);
  }, [ready]);

  return (
    <>
      {Array.from({ length: DECK }, (_, i) => {
        const code = dealing[DECK - 1 - RIFFLED.indexOf(i)];
        return (
          <group key={i} ref={(g) => void (g && (cards.current[i] = g))}>
            <group position-y={PIVOT}>
              <mesh geometry={plane} material={back} castShadow receiveShadow />
              <mesh geometry={plane} material={(code && faces.get(code)) || back} rotation-y={Math.PI} castShadow receiveShadow />
            </group>
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

// Turn a card face up about its long edge, lifting it just enough to clear the felt.
function flip(tl: gsap.core.Timeline, card: THREE.Group, y: number, at: number) {
  const lift = () => void (card.position.y = y + (CARD.w / 2 + 0.004) * Math.sin(card.rotation.y));
  tl.to(card.rotation, { y: Math.PI, duration: 0.7, ease: 'expo.out', onUpdate: lift }, at);
}

// Riffle, square up, stand the cards up in a fan, slide the top ones to the player's seat and
// turn them over, then square the rest back into a deck. Returns the deck from the top down.
function deal(tl: gsap.core.Timeline, cards: THREE.Group[], dealt: number) {
  const half = cards.length / 2;
  const { x, z } = SPOTS.deck;

  // Split the deck into two halves that slide apart and lift their inner edges.
  cards.forEach((card, i) => {
    const left = i < half;
    tl.to(card.position, { x: x + (left ? -0.05 : 0.05), y: rest(i % half) + 0.016, duration: 0.5, ease: 'power2.inOut' }, 0);
    tl.to(card.rotation, { y: left ? -0.3 : 0.3, z: left ? 0.3 : -0.06, duration: 0.5, ease: 'power2.inOut' }, 0);
  });

  // Interleave them bottom up, one from each side in turn.
  const order = RIFFLED.map((i) => cards[i]);
  order.forEach((card, n) => {
    tl.to(card.position, { x, y: rest(n), duration: 0.35 }, 0.6 + n * 0.035);
    tl.to(card.rotation, { y: 0, z: SPIN, duration: 0.35 }, 0.6 + n * 0.035);
  });

  // Stand them up and fan them from the bottom end, backs to the player, the top card nearest
  // and furthest right.
  tl.addLabel('fan', '+=0.15');
  order.forEach((card, n) => {
    tl.to(card.position, { y: FAN, z: z + n * GAP, duration: 0.8 }, 'fan');
    tl.to(card.rotation, { x: STAND, z: 0.7 - (n / (order.length - 1)) * 1.1, duration: 0.8 }, 'fan');
  });

  // Slide the top cards to the player's seat, side by side, and turn each one over as it lands.
  tl.addLabel('deal', 'fan+=0.9');
  const top = [...order].reverse();
  top.slice(0, dealt).forEach((card, n) => {
    const spin = n ? -0.05 : 0.07;
    const at = tl.labels.deal + n * 0.3;
    slide(tl, card, pivot(SPOTS.seat.x + (n - (dealt - 1) / 2) * 0.07, SPOTS.seat.z, spin, true), rest(n), spin, at);
    flip(tl, card, rest(n), at + 0.75);
  });

  // Lay the rest back down as a deck.
  order.slice(0, -dealt).forEach((card, n) => {
    tl.to(card.position, { y: rest(n), z, duration: 0.6, ease: 'power2.inOut' }, 'deal+=0.8');
    tl.to(card.rotation, { x: FLAT, z: SPIN, duration: 0.6, ease: 'power2.inOut' }, 'deal+=0.8');
  });
  return top;
}

// Burn the top card to the muck, then slide the street's cards onto the board, the first of them
// at board position placed, and turn them over. k counts the streets, so each burn card lands on
// the one before it.
function dealStreet(tl: gsap.core.Timeline, burn: THREE.Group, cards: THREE.Group[], placed: number, k: number) {
  const at = tl.duration();
  const { muck, board } = SPOTS;
  const spin = [0.4, -0.2, 0.15][k];
  slide(tl, burn, pivot(muck.x + k * 0.01, muck.z, spin, false), rest(k), spin, at);

  cards.forEach((card, n) => {
    const j = placed + n;
    const spin = [0.01, -0.02, 0.015, -0.01, 0.02][j];
    const start = at + 0.4 + n * 0.15;
    slide(tl, card, pivot(board.x + (j - 2) * 0.072, board.z, spin, true), rest(0), spin, start);
    flip(tl, card, rest(0), start + 0.75);
  });
}
