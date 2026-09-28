import type { StageProps } from '../Stage';
import { Deck } from './Deck';
import { TABLE_AT } from './layout';

/** Everything on the table, placed in table space. See layout.ts. */
export function Objects({ hole, board, shown }: StageProps & { shown: boolean }) {
  return (
    <group position={TABLE_AT}>
      <Deck hole={hole} board={board} ready={shown} />
    </group>
  );
}
