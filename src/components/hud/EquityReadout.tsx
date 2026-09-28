export type EquityReadoutProps = {
  hole: readonly string[];
  board: readonly { street: string; card: string }[];
};

/**
 * Phase 2: sits beside The Board, follows the street store and shows computeEquity from
 * src/lib/poker/api.ts, run in src/workers/equity.worker.ts, for the cards dealt so far.
 * Renders nothing until the HUD is built.
 */
export default function EquityReadout(_: EquityReadoutProps) {
  return null;
}
