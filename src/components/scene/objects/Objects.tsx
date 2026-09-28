import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { StageProps } from '../Stage';
import { Chips } from './Chips';
import { Deck } from './Deck';
import { TABLE_AT } from './layout';
import { Table } from './Table';

/** Everything on the table, placed in table space. See layout.ts. */
export function Objects({ hole, board, teams, shown }: StageProps & { shown: boolean }) {
  return (
    <>
      <group position={TABLE_AT}>
        <Table />
        <Deck hole={hole} board={board} ready={shown} />
        <Chips teams={teams} />
      </group>
      <NeutralReflections />
    </>
  );
}

// Temporary: a dim, neutral studio environment so brass and card stock have something to reflect
// until the light pass. It steps aside for any environment the rig sets first, and the rig's
// own Environment replaces it whenever it lands, so the light pass can delete this at leisure.
function NeutralReflections() {
  const { gl, scene } = useThree();
  useEffect(() => {
    if (scene.environment) return;
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    // Dimmed in the room itself, so scene.environmentIntensity stays the rig's to set.
    room.traverse((o) => ((o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined)?.color?.multiplyScalar(0.35));
    const target = pmrem.fromScene(room, 0.04);
    room.dispose();
    pmrem.dispose();
    scene.environment = target.texture;
    return () => {
      if (scene.environment === target.texture) scene.environment = null;
      target.dispose();
    };
  }, [gl, scene]);
  return null;
}
