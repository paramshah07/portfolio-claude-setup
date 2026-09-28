import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { gsap } from 'gsap';
import { street } from '../../lib/state/hud';
import { PIPS, SUIT_OF } from '../../lib/deck';
import type { EquityResult, Street } from '../../lib/poker/api';
import type { EquityRequest, EquityResponse } from '../../workers/equity.worker';
import { Panel } from './Panel';

export type EquityReadoutProps = {
  hole: readonly string[];
  board: readonly { street: string; card: string }[];
};

const STREETS: Street[] = ['preflop', 'flop', 'turn', 'river'];
const NAMES: Record<Street, string> = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' };
const STATS = ['equity', 'win', 'tie', 'loss'] as const;
type Shares = Record<(typeof STATS)[number], number>;

const percent = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const count = new Intl.NumberFormat('en-US');
const pip = (card: string) => `${card[0] === 'T' ? '10' : card[0]}${PIPS[SUIT_OF[card[1] as keyof typeof SUIT_OF]]}`;

/** The board cards dealt by the end of a street, in the order they were dealt. */
export function dealt(board: EquityReadoutProps['board'], upTo: Street) {
  const last = STREETS.indexOf(upTo);
  return board.filter((b) => STREETS.indexOf(b.street as Street) <= last).map((b) => b.card);
}

/**
 * Param's hole cards against one random hand, for the cards The Board has dealt so far. The
 * worker does the counting, so a flop's million matchups never block the page. Numbers count
 * up to each new street's answer, and screen readers hear only that answer, once.
 */
export default function EquityReadout({ hole, board }: EquityReadoutProps) {
  const current = useStore(street);
  const [result, setResult] = useState<EquityResult | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const root = useRef<HTMLElement>(null);
  const worker = useRef<Worker>(null);
  const latest = useRef(0);
  const inView = useRef(false);
  const shown = useRef<Shares>({ equity: 0, win: 0, tie: 0, loss: 0 });
  // React renders these empty and never touches them again, so the count-up writes them directly.
  const cells = useRef<Partial<Record<keyof Shares, HTMLElement | null>>>({});
  const split = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const equity = new Worker(new URL('../../workers/equity.worker.ts', import.meta.url), { type: 'module' });
    // Only the newest request counts. The worker drops older jobs, but one may finish first.
    equity.onmessage = ({ data }: MessageEvent<EquityResponse>) => {
      if (data.id !== latest.current) return;
      if ('error' in data) console.error(data.error);
      else setResult(data.result);
    };
    worker.current = equity;
    // Announcing a street dealt out of sight, like preflop on load, would only be noise. It watches
    // the whole section, since on a phone the deal lands while the readout is still below it.
    const io = new IntersectionObserver(([entry]) => (inView.current = entry.isIntersecting));
    io.observe(root.current!.parentElement?.closest('section') ?? root.current!);
    return () => {
      equity.terminate();
      io.disconnect();
    };
  }, []);

  useEffect(() => {
    const request: EquityRequest = { id: ++latest.current, hole: [...hole], board: dealt(board, current) };
    worker.current!.postMessage(request);
  }, [current]);

  useEffect(() => {
    if (!result) return;
    const write = () => {
      const now = shown.current;
      for (const stat of STATS) cells.current[stat]!.textContent = percent.format(now[stat]);
      split.current!.style.gridTemplateColumns = `${now.win}fr ${now.tie}fr ${now.loss}fr`;
    };
    if (inView.current) setAnnouncement(`${NAMES[result.street]}: ${percent.format(result.equity)} equity. ${result.madeHand}. ${result.exact ? 'Exact' : 'Estimated'}.`);
    const target = { equity: result.equity, win: result.win, tie: result.tie, loss: result.loss };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      Object.assign(shown.current, target);
      return write();
    }
    const tween = gsap.to(shown.current, { ...target, duration: 0.8, ease: 'power3.out', onUpdate: write });
    return () => void tween.kill();
  }, [result]);

  const cell = (stat: keyof Shares) => (el: HTMLElement | null) => void (cells.current[stat] = el);

  return (
    <section ref={root} className="equity" aria-labelledby="equity-title">
      <Panel id="equity-title" heading="h3" title="Equity" end={result && NAMES[result.street]}>
        <p className="hud-note">{hole.map(pip).join(' ')} against one random hand</p>
        <dl className="hud-rows">
          <div className="lead">
            <dt>Equity</dt>
            <dd ref={cell('equity')} />
          </div>
        </dl>
        <div ref={split} className="split" aria-hidden="true">
          <span className="win" />
          <span className="tie" />
          <span className="loss" />
        </div>
        <dl className="hud-rows">
          <div>
            <dt className="win">Win</dt>
            <dd ref={cell('win')} />
          </div>
          <div>
            <dt className="tie">Tie</dt>
            <dd ref={cell('tie')} />
          </div>
          <div>
            <dt className="loss">Loss</dt>
            <dd ref={cell('loss')} />
          </div>
          <div>
            <dt>Made hand</dt>
            <dd>{result?.madeHand}</dd>
          </div>
        </dl>
        <p className="hud-note exact">{result && (result.exact ? `Exact over ${count.format(result.matchups)} matchups` : 'Estimated')}</p>
        <p className="sr-only" role="status">
          {announcement}
        </p>
      </Panel>
    </section>
  );
}
