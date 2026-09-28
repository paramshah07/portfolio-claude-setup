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

// Temporary: a neutral studio environment so brass and card stock have something to reflect.
// The light pass replaces it with the warm HDRI and the lamp Lightformers, and deletes this
// along with the Rig's stand-in lights.
function NeutralReflections() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    scene.environment = env;
    scene.environmentIntensity = 0.35;
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [gl, scene]);
  return null;
}
