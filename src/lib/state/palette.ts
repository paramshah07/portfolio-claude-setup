// The one store the nav needs before idle, kept apart so its first-paint script doesn't carry
// the rest of the state along with it.
import { atom } from 'nanostores';

/** Whether the command palette is open. */
export const palette = atom(false);
