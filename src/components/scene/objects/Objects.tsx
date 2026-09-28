import type { StageProps } from '../Stage';
import { Deck } from './Deck';
import { TABLE_AT } from './layout';
import { Table } from './Table';

/** Everything on the table, placed in table space. See layout.ts. */
export function Objects({ hole, board, shown }: StageProps & { shown: boolean }) {
  return (
    <group position={TABLE_AT}>
      <Table />
      <Deck hole={hole} board={board} ready={shown} />
    </group>
  );
}
