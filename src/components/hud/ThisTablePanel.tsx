import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useStore } from '@nanostores/react';
import { thisTableOpen } from '../../lib/state/hud';
import type { BuildStats } from '../../integrations/build-stats';
import { Panel } from './Panel';
import { PerfStats } from './PerfHud';

/** Everything worded comes from content.md, and a section whose words are missing isn't shown. */
export type ThisTableProps = {
  /** "What you're looking at", two plain sentences. */
  intro?: string;
  /** The evaluator's approach in a sentence or two. */
  approach?: string;
  /** The repository link. */
  repository?: { label: string; href: string };
};

// What the tests check across all 2,598,960 five-card hands, from hud.md and tests/poker.
const CENSUS = [
  ['Straight flush', 40],
  ['Four of a kind', 624],
  ['Full house', 3744],
  ['Flush', 5108],
  ['Straight', 10200],
  ['Three of a kind', 54912],
  ['Two pair', 123552],
  ['Pair', 1098240],
  ['High card', 1302540],
] as const;

// build-stats.json names bundles after their files. These are the ones worth a plain name.
const BUNDLES: Record<string, string> = {
  client: 'React runtime',
  motion: 'Motion pass',
  Stage: 'Stage',
  CommandPalette: 'Command palette',
  EquityReadout: 'Equity readout',
  'equity.worker': 'Equity worker',
  PerfHud: 'Performance HUD',
  ThisTablePanel: 'This panel',
};

const number = new Intl.NumberFormat('en-US');
const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

// Fetched once, the first time the panel opens. A dev server has no build, so there's nothing to show.
let buildStats: Promise<BuildStats | null> | undefined;
const loadBuildStats = () =>
  (buildStats ??= fetch('/build-stats.json').then(
    (response) => (response.ok ? response.json() : null),
    () => null,
  ));

/**
 * "How this table works": a slide-over dialog from the footer link or the palette. A native modal
 * dialog makes the page inert, closes on Esc and returns focus to whatever opened it. Its
 * contents mount the first time it opens and the live numbers run only while it's open.
 */
export default function ThisTablePanel({ intro, approach, repository }: ThisTableProps) {
  const open = useStore(thisTableOpen);
  const dialog = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(false);
  const [sizes, setSizes] = useState<BuildStats | null>(null);

  useEffect(() => {
    // The footer link waits for JavaScript, since the panel can't open without it.
    document.querySelector('[data-this-table]')?.removeAttribute('hidden');
    // Safari doesn't focus a button on click, so the link takes focus first for the dialog to return it to.
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element).closest<HTMLElement>('[data-this-table]');
      if (!link) return;
      link.focus();
      thisTableOpen.set(true);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (!open) return dialog.current!.close();
    setOpened(true);
    dialog.current!.showModal();
    loadBuildStats().then(setSizes);
  }, [open]);

  // The dialog lets Tab leave for the browser's toolbar, so Tab wraps inside it instead.
  const trap = (event: ReactKeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const stops = dialog.current!.querySelectorAll<HTMLElement>('a[href], button, [tabindex="0"]');
    const edge = event.shiftKey ? stops[0] : stops[stops.length - 1];
    if (document.activeElement !== edge) return;
    event.preventDefault();
    (event.shiftKey ? stops[stops.length - 1] : stops[0]).focus();
  };

  const evaluatorSource = repository?.href.startsWith('https://github.com/') ? `${repository.href.replace(/\/$/, '')}/tree/HEAD/src/lib/poker` : repository?.href;

  return (
    <dialog
      ref={dialog}
      className="this-table"
      aria-labelledby="this-table-title"
      onClose={() => thisTableOpen.set(false)}
      onKeyDown={trap}
      onClick={(event) => event.target === event.currentTarget && dialog.current!.close()}
    >
      <Panel
        id="this-table-title"
        title="How this table works"
        end={
          <button type="button" onClick={() => dialog.current!.close()}>
            Close
          </button>
        }
      >
        {opened && (
          <div className="body">
            {intro && (
              <>
                <h3>What you're looking at</h3>
                <p>{intro}</p>
              </>
            )}

            <h3>Architecture</h3>
            <Diagram />

            <h3>Performance</h3>
            <PerfStats on={open} />
            {sizes && (
              <table>
                <caption>Bundle sizes, gzipped</caption>
                <tbody>
                  <tr>
                    <th scope="row">Page HTML</th>
                    <td>{kb(sizes.html.gzip)}</td>
                  </tr>
                  <tr>
                    <th scope="row">First-paint JS</th>
                    <td>{kb(sizes.firstPaintJs.gzip)}</td>
                  </tr>
                  {sizes.bundles.map((bundle) => (
                    <tr key={bundle.name}>
                      <th scope="row">{BUNDLES[bundle.name] ?? bundle.name}</th>
                      <td>{kb(bundle.gzip)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">All JS</th>
                    <td>{kb(sizes.totalJs.gzip)}</td>
                  </tr>
                </tfoot>
              </table>
            )}

            <h3>The evaluator</h3>
            {approach && <p>{approach}</p>}
            <table>
              <caption>Test counts</caption>
              <tbody>
                {CENSUS.map(([hand, count]) => (
                  <tr key={hand}>
                    <th scope="row">{hand}</th>
                    <td>{number.format(count)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Five-card hands</th>
                  <td>{number.format(2598960)}</td>
                </tr>
                <tr>
                  <th scope="row">Distinct ranks</th>
                  <td>{number.format(7462)}</td>
                </tr>
              </tfoot>
            </table>
            {evaluatorSource && (
              <p>
                <a href={evaluatorSource} target="_blank" rel="noopener">
                  src/lib/poker
                </a>
              </p>
            )}

            {repository && (
              <>
                <h3>Source</h3>
                <p>
                  <a href={repository.href} target="_blank" rel="noopener">
                    {repository.label}
                  </a>
                </p>
              </>
            )}
          </div>
        )}
      </Panel>
    </dialog>
  );
}

/** The static HTML, the islands it hydrates, the stores they share and the equity worker. */
function Diagram() {
  const box = (x: number, y: number, width: number, title: string, sub: string, middle = true) => (
    <g>
      <rect className="box" x={x + 0.5} y={y + 0.5} width={width - 1} height={43} rx={7} />
      <text x={middle ? x + width / 2 : x + 12} y={y + 19} textAnchor={middle ? 'middle' : 'start'}>
        {title}
      </text>
      <text className="sub" x={middle ? x + width / 2 : x + 12} y={y + 34} textAnchor={middle ? 'middle' : 'start'}>
        {sub}
      </text>
    </g>
  );
  return (
    <figure>
      <svg
        viewBox="0 0 320 238"
        role="img"
        aria-label="The static Astro HTML hydrates three islands at idle: the stage, the command palette and the HUD panels. They share state through nanostores, and the equity readout posts its math to a web worker."
      >
        <defs>
          <marker id="this-table-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 8 4 0 8z" />
          </marker>
        </defs>
        {box(0, 0, 320, 'Static HTML', 'Astro, painted first', false)}
        <line className="edge" x1="160" y1="44" x2="160" y2="80" />
        <text className="sub" x="168" y="66">
          hydrates at idle
        </text>
        <rect className="group" x="0.5" y="82.5" width="319" height="78" rx="10" />
        <text className="sub" x="12" y="97">
          Islands
        </text>
        {box(8, 106, 96, 'Stage', 'three.js')}
        {box(112, 106, 96, 'Palette', 'cmdk')}
        {box(216, 106, 96, 'HUD panels', 'React')}
        <line className="edge both" x1="56" y1="150" x2="56" y2="192" />
        <line className="edge both" x1="160" y1="150" x2="160" y2="192" />
        <line className="edge both" x1="236" y1="150" x2="196" y2="192" />
        <line className="edge" x1="280" y1="150" x2="280" y2="192" />
        {box(0, 194, 208, 'Shared stores', 'nanostores')}
        {box(216, 194, 104, 'Equity worker', 'postMessage')}
      </svg>
    </figure>
  );
}
