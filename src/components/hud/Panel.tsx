import type { ReactNode } from 'react';
import './panel.css';

type PanelProps = {
  /** The title's id, for the aria-labelledby of whatever wraps the panel. */
  id: string;
  title: string;
  heading?: 'h2' | 'h3';
  /** The right end of the title bar: a close button or a short status. */
  end?: ReactNode;
  children: ReactNode;
};

/**
 * The frame all three HUD panels share, matching the stats panel in The Player: a brass hairline
 * around panel #363430 and a title bar with three brass dots, in IBM Plex Mono.
 */
export function Panel({ id, title, heading: Heading = 'h2', end, children }: PanelProps) {
  return (
    <div className="hud-panel">
      <div className="hud-bar">
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <Heading id={id}>{title}</Heading>
        {end && <span className="hud-end">{end}</span>}
      </div>
      {children}
    </div>
  );
}
