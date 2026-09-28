import type { StageProps } from './Stage';
import { Objects } from './objects/Objects';
import { Rig } from './rig/Rig';

// The rig is the canvas, camera, room, light and lifecycle. The objects sit in it and start
// moving once its first frame is on screen.
export default function Scene(props: StageProps) {
  return <Rig>{(shown) => <Objects {...props} shown={shown} />}</Rig>;
}
