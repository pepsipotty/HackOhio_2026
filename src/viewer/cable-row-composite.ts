import { Group, Vector3 } from 'three'
import type { Rig } from './rig'
import { createRowGrip, orientRowHandle } from './row-grip'
import { styleHumanoid } from './humanoid-materials'
import { CableStackApparatus } from './gym/CableStackApparatus.js'

/** Native gym coordinates: west row faces +X, bench top is 0.4825 m. */
export function createCableRowComposite(rig: Rig, apparatus = new CableStackApparatus()) {
  styleHumanoid(rig.root)
  const grip = createRowGrip(rig)
  const root = new Group()
  root.name = 'GymCableStackWithHumanoid'
  rig.root.position.set(-1.85, .09, 0)
  rig.root.rotation.y = Math.PI / 2
  root.add(apparatus.root, rig.root)
  const left = new Vector3(), right = new Vector3(), direction = new Vector3()
  const station = apparatus.stations.westSeatedRow
  const restingHandle = new Vector3().copy(station.physics.p)
  const sync = () => {
    rig.root.position.y = .09 * Math.max(0, Math.min(1, (1 - rig.joints.pelvis.position.y) / .48))
    rig.update?.()
    root.updateWorldMatrix(true, true)
    rig.joints.wrist_L.getWorldPosition(left)
    rig.joints.wrist_R.getWorldPosition(right)
    apparatus.root.worldToLocal(left.add(right).multiplyScalar(.5))
    const contact = Math.max(0, Math.min(1, (left.y - .65) / .2)) * Math.max(0, Math.min(1, (.85 - rig.joints.pelvis.position.y) / .25))
    const engaged = contact > 0
    if (!engaged) left.copy(restingHandle)
    // The attachment origin is its cable eye, slightly ahead of the palms.
    direction.subVectors(left, station.exitWorldPoint).normalize()
    if (engaged) { left.addScaledVector(direction, -.19); left.y += .04 }

    if (engaged) left.lerpVectors(restingHandle, left.clone(), contact * contact * (3 - 2 * contact))
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
    if (engaged) grip.solve(station.handleGroup, contact)
    else grip.curl(0)
  }
  return { root, apparatus, sync, restorePose: grip.restore }
}
