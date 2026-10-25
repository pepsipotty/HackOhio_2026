import { Group, Quaternion, Vector3 } from 'three'
import type { Rig } from './rig'
import type { HandleState } from '../data/motion'
import { HANDLE_REST, SEAT_LIFT } from '../data/row-station'
import { createRowGrip, orientRowHandle } from './row-grip'
import { styleHumanoid } from './humanoid-materials'
import { CableStackApparatus } from './gym/CableStackApparatus.js'

const smooth = (u: number) => u * u * (3 - 2 * u)
const clamp01 = (u: number) => Math.min(1, Math.max(0, u))

/** Native gym coordinates: west row faces +X, bench top is 0.4825 m. */
export function createCableRowComposite(rig: Rig, apparatus = new CableStackApparatus()) {
  styleHumanoid(rig.root)
  const grip = createRowGrip(rig)
  const root = new Group()
  root.name = 'GymCableStackWithHumanoid'
  rig.root.position.set(-1.85, SEAT_LIFT, 0)
  rig.root.rotation.y = Math.PI / 2
  root.add(apparatus.root, rig.root)
  const left = new Vector3(), right = new Vector3(), direction = new Vector3()
  const station = apparatus.stations.westSeatedRow
  // Resting on the footplate bar, grips toward the seat: the cable-aligned orientation for a level cable.
  const restingHandle = new Vector3(...HANDLE_REST)
  orientRowHandle(station.handleGroup, new Vector3(-1, 0, 0))
  const restingRotation = station.handleGroup.quaternion.clone()
  const held = new Quaternion()
  let state: HandleState | null = null
  const sync = () => {
    rig.root.position.y = SEAT_LIFT * clamp01((1 - rig.joints.pelvis.position.y) / .3)
    rig.update?.()
    root.updateWorldMatrix(true, true)
    rig.joints.wrist_L.getWorldPosition(left)
    rig.joints.wrist_R.getWorldPosition(right)
    apparatus.root.worldToLocal(left.add(right).multiplyScalar(.5))
    // Without an explicit state, the hands take the handle once seated and raised toward it.
    const contact = clamp01((left.y - .65) / .2) * clamp01((.85 - rig.joints.pelvis.position.y) / .25)
    const { carry, left: holdL, right: holdR } = state ?? { carry: contact, left: contact, right: contact }
    // Where the hands would hold it: the attachment origin is its cable eye, slightly ahead of the palms.
    direction.subVectors(left, station.exitWorldPoint).normalize()
    left.addScaledVector(direction, -.19)
    left.y += .04
    const lift = smooth(clamp01(carry))
    left.lerpVectors(restingHandle, left.clone(), lift)
    direction.subVectors(left, station.exitWorldPoint).normalize()
    const distance = left.distanceTo(station.exitWorldPoint)
    const previous = station.stackLift
    Object.assign(station.physics.p, { x: left.x, y: left.y, z: left.z })
    station.physics.slack = 0
    station.cablePull = Math.max(0, distance - station.physics.lead)
    station.stackLift = Math.min(station.config.maxStackTravel, station.cablePull * station.config.ratio)
    station.physics.lift = station.stackLift
    apparatus.updateStationVisuals('westSeatedRow', (station.stackLift - previous) / station.config.ratio)
    orientRowHandle(station.handleGroup, direction)
    held.copy(station.handleGroup.quaternion)
    station.handleGroup.quaternion.slerpQuaternions(restingRotation, held, lift)
    station.handleGroup.updateWorldMatrix(true, true)
    if (holdL > 0 || holdR > 0) grip.solve(station.handleGroup, 1, [clamp01(holdL), clamp01(holdR)])
    else grip.curl(0)
  }
  return {
    root, apparatus, sync, restorePose: grip.restore,
    /** Drive the handle and the hands' hold on it; null returns to holding it whenever seated and reaching. */
    setHandle(next: HandleState | null) { state = next },
  }
}
