// Where the west seated-row station's parts are, for posing the figure against them.
// Source: CableStackApparatus.js. The station's +X becomes the figure's forward (+Z) once the
// composite seats the humanoid at (-1.85, y, 0) facing the stack; figure x = -station z.
import type { FootTarget, Vec3 } from './motion'

const STATION_TO_FIGURE_Z = 1.85
/** When seated, the composite lifts the humanoid this far so the pelvis clears the bench pad. */
export const SEAT_LIFT = 0.09

/** Lower footplates: centre x -1.03, y .27, z ±.18; 18 mm thick, tilted -0.42 rad about Z. */
export const FOOTPLATE = { tilt: 0.42, centreZ: -1.03 + STATION_TO_FIGURE_Z, centreY: 0.27, halfThickness: 0.009 }
// Measured on human.glb at rest: the ankle bone sits 95 mm above the sole and 58 mm ahead of the heel.
export const ANKLE_HEIGHT = 0.095
const ANKLE_AHEAD_OF_HEEL = 0.058
const SOLE_GAP = 0.001 // hairline gap so the sole never z-fights the studded plate
const HEEL_ALONG_PLATE = -0.125 // heel near the plate's lower edge (plate half-length .14), toes stay on the plate
/** Ankle spacing on the plates: a little wider than the hips, so the knees track out over the feet. */
export const ANKLE_X = 0.2

/** The ankle target that puts a sole flat on its footplate, in the floor frame of FootTarget. */
export function footplateTarget(side: 'L' | 'R'): FootTarget {
  const normal = { z: -Math.cos(FOOTPLATE.tilt), y: Math.sin(FOOTPLATE.tilt) } // out of the plate, toward the seat
  const up = { z: Math.sin(FOOTPLATE.tilt), y: Math.cos(FOOTPLATE.tilt) } // along the plate, toward its top edge
  const out = FOOTPLATE.halfThickness + ANKLE_HEIGHT + SOLE_GAP
  const along = HEEL_ALONG_PLATE + ANKLE_AHEAD_OF_HEEL
  return [
    side === 'L' ? ANKLE_X : -ANKLE_X,
    FOOTPLATE.centreY + normal.y * out + up.y * along,
    FOOTPLATE.centreZ + normal.z * out + up.z * along,
    90 - FOOTPLATE.tilt * 180 / Math.PI, // toes tipped up until the sole lies on the plate
    1,
  ]
}

/**
 * The row handle at rest, in station coordinates: lying on the bar catch (top y .326) between the lower
 * footplates, frame plates down and the grips pointing back at the seat, as it sits when nobody is using it.
 */
export const HANDLE_REST: Vec3 = [-0.957, 0.396, 0]
