import * as THREE from 'three';

// Metres. The rig's camera rests at the origin looking down -z with a 45 degree vertical field of
// view, and this puts the table where the painted one sits in reference/hero-16x9.jpg: the far
// rail runs across the frame a little under the middle and the near rail's cup holders sit in the
// bottom corners. That makes the rest pose a low seat, about 0.21 m above the felt and half a
// metre back from its near edge.
export const TABLE_AT = new THREE.Vector3(0, -0.209, -0.985);

// Everything in objects/ is placed in table space: the felt is y = 0, x runs along the long axis
// and +z points at the player's seat. The rig can aim at any spot with TABLE_AT + spot.
export const TABLE = {
  /** Half the length of the straight sides, so the table is 2 * (half + radius) long. */
  half: 0.6,
  /** The radius of the rounded ends, so the table is 2 * radius wide. */
  radius: 0.6,
  /** How far the padded rail reaches in over the felt. */
  rail: 0.12,
};

export const SPOTS = {
  /** Where the hole cards land, in front of the player and behind the betting line. */
  seat: new THREE.Vector3(0, 0, 0.33),
  /** The middle of the five board cards. */
  board: new THREE.Vector3(0, 0, -0.04),
  /** Where the deck sits, to the dealer's left of the board and a little toward the player. */
  deck: new THREE.Vector3(0.27, 0, 0.02),
  /** Where the burn cards go. */
  muck: new THREE.Vector3(0.39, 0, -0.14),
  /** The first of the team stacks, which run toward +x to the player's right. */
  stacks: new THREE.Vector3(0.17, 0, 0.32),
};

/**
 * The deal's camera, which the deck's timeline moves and the rig's camera follows, each shot from 0
 * at the section's pose to 1. Each shot sits over the ones before it in this list, so a shot under
 * one at 1 can be set without the camera moving, and letting go of the top one moves it straight
 * down to the next:
 * - open: the table framed for the start, eased into once the stage shows
 * - hand: the dealt hand face up, the shot the hero settles on
 * - peel: the player's own view of the face-down hole cards as their corners lift
 * - close: pushed in low over the rail for the spring
 */
export const dealShot = { open: 0, hand: 0, peel: 0, close: 0 };
