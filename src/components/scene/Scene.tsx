import type { StageProps } from './Stage';
import { ChipRiffle } from './objects/ChipRiffle';
import { Objects } from './objects/Objects';
import { Rig } from './rig/Rig';

// The rig is the canvas, camera, room, light and lifecycle. The objects sit in it and start
// moving once its first frame is on screen. The chip riffle in the corner has a canvas of its own.
export default function Scene(props: StageProps) {
  return (
    <>
      <Rig>{(shown) => <Objects {...props} shown={shown} />}</Rig>
      <ChipRiffle />
    </>
  );
}
