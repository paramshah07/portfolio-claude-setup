// The motion pass. TheDeal imports this at idle, so GSAP never sits in the first-paint bundle.
// The page is complete before this runs: starting states are set here, and only for elements
// still below the fold, so a slow or failed load leaves everything visible.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SECTIONS, activeSection, handDealt, holeCards, peek, scrollProgress, street, tier } from '../../lib/state';

gsap.registerPlugin(ScrollTrigger);

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const belowFold = (el: Element | null): el is Element => !!el && el.getBoundingClientRect().top > innerHeight;
// clamp() fires a trigger at the bottom of the page when its start can't be reached.
const at = (percent: number) => `clamp(top ${percent}%)`;
const settle = { duration: 0.6, ease: 'power3.out' };

// State for the islands. Created top to bottom, so ScrollTrigger refreshes in page order.
for (const { id } of SECTIONS) {
  const section = document.getElementById(id);
  if (!section) continue;
  ScrollTrigger.create({
    trigger: section,
    start: 'top center',
    end: 'bottom center',
    onToggle: (self) => self.isActive && activeSection.set(id),
  });
}
ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => scrollProgress.set(self.progress) });

// The scroll cue grows once, then leaves on the first scroll.
const cue = document.querySelector('#the-deal .cue');
if (cue && scrollY > 0) gsap.set(cue, { autoAlpha: 0 });
else if (cue) {
  if (!reduce) gsap.from(cue, { scaleY: 0, transformOrigin: 'top', duration: 1.2, ease: 'power3.out' });
  const leave = () => gsap.to(cue, { autoAlpha: 0, duration: reduce ? 0.15 : 0.4, overwrite: true });
  addEventListener('scroll', leave, { once: true, passive: true });
}

// The hand waits for the visitor: the hero's button, or a click anywhere on its table that isn't on
// a control. Once the hole cards lie face down, a second button offers to show them: hovering or
// focusing it squeezes them up to read, as the pointer over the cards does, and it, or a click
// anywhere that isn't on a control, turns them face up. Only where there's a stage to deal on, so
// not on the static tier.
const hero = document.getElementById('the-deal');
const dealButton = hero?.querySelector<HTMLButtonElement>('[data-deal]');
const showButton = hero?.querySelector<HTMLButtonElement>('[data-show]');
if (hero && dealButton && showButton && !reduce && tier.get() !== 'static') {
  const appear = (button: HTMLButtonElement) => {
    button.hidden = false;
    gsap.fromTo(button, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 });
  };
  // A button that leaves while it has focus hands focus to the hero's first link, so it isn't lost.
  const leave = (button: HTMLButtonElement) => {
    if (document.activeElement === button) hero.querySelector('a')?.focus();
    gsap.to(button, { autoAlpha: 0, duration: 0.4, onComplete: () => void (button.hidden = true) });
  };
  dealButton.hidden = false;
  hero.classList.add('clickable');
  dealButton.addEventListener('click', () => handDealt.set(true));
  showButton.addEventListener('click', () => holeCards.set('up'));
  for (const [on, off] of [
    ['pointerenter', 'pointerleave'],
    ['focus', 'blur'],
  ] as const) {
    showButton.addEventListener(on, () => peek.set(true));
    showButton.addEventListener(off, () => peek.set(false));
  }
  document.addEventListener('click', (event) => {
    const target = event.target as Element;
    if (target.closest('a, button, input, select, textarea, label, dialog')) return;
    if (!handDealt.get()) hero.contains(target) && handDealt.set(true);
    else if (holeCards.get() === 'down') holeCards.set('up');
  });
  handDealt.listen((dealt) => {
    if (!dealt) return;
    hero.classList.remove('clickable');
    leave(dealButton);
  });
  holeCards.listen((now) => {
    hero.classList.toggle('clickable', now === 'down');
    if (now === 'down') appear(showButton);
    if (now === 'up') {
      peek.set(false);
      leave(showButton);
    }
  });
  // Once the stage gives way to the static tier, there's nothing to click.
  tier.listen((now) => {
    if (now !== 'static') return;
    hero.classList.remove('clickable');
    [dealButton, showButton].forEach(leave);
  });
}

const row = document.querySelector('#hand-history .row');
const board = document.querySelector('#the-board .board');

// The Board starts fully dealt if it's already in view when this runs, so nothing on screen
// vanishes. Otherwise its streets wait for the equity readout's button.
if (reduce || !belowFold(board)) street.set('river');

// Opacity only, never visibility, so keyboard focus can still reach content before it reveals.
if (!reduce) {
  // Headings rise and fade in, then whatever each section marks with data-follow.
  for (const heading of document.querySelectorAll('main section h2')) {
    if (!belowFold(heading)) continue;
    gsap
      .timeline({ scrollTrigger: { trigger: heading, start: at(90), once: true } })
      .from(heading, { y: 24, opacity: 0, ...settle })
      .from(heading.closest('section')!.querySelectorAll('[data-follow]'), { y: 16, opacity: 0, stagger: 0.08, ...settle }, 0.15);
  }

  // The stats count up once. Only plain numbers count, so a date like "May 2027" just shows.
  const stats = document.querySelector('#the-player .stats');
  if (belowFold(stats)) {
    for (const value of stats.querySelectorAll<HTMLElement>('dt + dd')) {
      const [, digits, suffix] = value.textContent!.match(/^([\d,]+)(.*)$/) ?? [];
      if (!digits) continue;
      const count = { n: 0 };
      const write = () => (value.textContent = Math.round(count.n).toLocaleString('en-US', { useGrouping: digits.includes(',') }) + suffix);
      // Held at its final width, so the count never moves the label beside it.
      value.style.minWidth = `${value.offsetWidth}px`;
      write();
      gsap.to(count, { n: Number(digits.replaceAll(',', '')), duration: 1.2, ease: 'power3.out', onUpdate: write, scrollTrigger: { trigger: stats, start: at(85), once: true } });
    }
  }

  // Hand History deals in left to right.
  if (belowFold(row)) {
    gsap.from(row.children, { x: -40, y: -24, rotation: -3, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.1, scrollTrigger: { trigger: row, start: at(85), once: true } });
  }

  // The Board deals a street each time the readout's button asks: a burn card slides off, then the
  // street's cards. One paused timeline keeps the streets in order however fast the clicks come.
  if (belowFold(board)) {
    const deal = gsap.timeline({ paused: true });
    const streets = [...board.querySelectorAll('.street')];
    streets.forEach((street, i) => {
      deal
        .fromTo(street.querySelector('.burn'), { autoAlpha: 0, y: -16 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power3.out' })
        .to(street.querySelector('.burn'), { x: -64, rotation: -8, autoAlpha: 0, duration: 0.45, ease: 'power3.out' })
        .from(street.querySelectorAll('.card'), { y: -40, rotation: -2, opacity: 0, ...settle }, '-=0.2')
        .addLabel(`street-${i}`);
    });
    const landed = ['flop', 'turn', 'river'];
    street.subscribe((now) => {
      const time = deal.labels[`street-${landed.indexOf(now)}`];
      if (time > deal.time()) gsap.to(deal, { time, duration: time - deal.time(), ease: 'none', overwrite: true });
    });
  }
}

// Card flips. HandHistory toggles aria-expanded on click before this listener runs, and CSS
// shows the back from that. Here the back is held up while a card flips shut, so it can turn away.
const flip = reduce ? 'fade' : tier.get() === 'static' ? '2d' : '3d';
if (row && flip === '3d') row.classList.add('flip-3d');
for (const slot of row?.querySelectorAll('.slot') ?? []) {
  const face = slot.querySelector('button.face');
  const back = slot.querySelector('.back');
  if (!face || !back) continue;
  const isOpen = () => face.getAttribute('aria-expanded') === 'true';
  if (flip === '3d') gsap.set(slot, { rotationY: isOpen() ? 180 : 0 });
  let turn: gsap.core.Timeline | undefined;
  slot.addEventListener('click', () => {
    const open = isOpen();
    turn?.kill();
    if (flip === 'fade') {
      if (open) gsap.fromTo(back, { opacity: 0 }, { opacity: 1, duration: 0.15 });
    } else if (flip === '3d') {
      gsap.set(slot, { transformPerspective: 1200 });
      gsap.set(back, { visibility: 'visible' });
      turn = gsap
        .timeline()
        .to(slot, { rotationY: open ? 180 : 0, duration: 0.8, ease: 'expo.out' })
        .set(back, { clearProps: 'visibility' });
    } else {
      // Phones and the static tier turn the card edge-on and back, swapping sides in between.
      gsap.set(back, { visibility: open ? 'hidden' : 'visible' });
      turn = gsap
        .timeline()
        .to(slot, { scaleX: 0, duration: 0.15, ease: 'power2.in' })
        .set(back, { clearProps: 'visibility' })
        .to(slot, { scaleX: 1, duration: 0.35, ease: 'expo.out' });
    }
  });
}

// "Email copied" appears, then fades and clears, so copying again announces it again.
const copied = document.querySelector('#showdown [data-copied]');
if (copied) {
  let fade: gsap.core.Timeline | undefined;
  new MutationObserver(() => {
    if (!copied.textContent) return;
    fade?.kill();
    fade = gsap
      .timeline()
      .fromTo(copied, { opacity: 0 }, { opacity: 1, duration: 0.15 })
      .to(copied, { opacity: 0, duration: reduce ? 0.15 : 0.6, delay: 2, onComplete: () => void (copied.textContent = '') });
  }).observe(copied, { childList: true });
}
