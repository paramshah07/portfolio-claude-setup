import { useEffect, useState, type ComponentType } from 'react';
import { tier } from '../../lib/state';

export type StageProps = {
  hole: readonly string[];
  board: readonly { street: string; card: string }[];
  teams: readonly { name: string; members: number }[];
};

// Hydrates at idle and renders nothing on the server. The scene loads only after the hero
// plate has decoded, so React and three.js arrive after first paint, and never on the
// static tier. A failed load leaves the plate in place and drops to the static tier.
export default function Stage(props: StageProps) {
  const [Scene, setScene] = useState<ComponentType<StageProps> | null>(null);

  useEffect(() => {
    if (tier.get() === 'static') return;
    const plate = document.getElementById('plate') as HTMLImageElement | null;
    plate
      ?.decode()
      .then(() => import('./Scene'))
      .then(
        (scene) => setScene(() => scene.default),
        () => tier.set('static'),
      );
  }, []);

  return Scene ? <Scene {...props} /> : null;
}
