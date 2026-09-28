import type { StageProps } from '../Stage';
import { Deck } from './Deck';

/** Everything on the table. Phase 2 adds the table itself, the board cards and the chip stacks. */
export function Objects({ hole, shown }: StageProps & { shown: boolean }) {
  return <Deck hole={hole} ready={shown} />;
}
