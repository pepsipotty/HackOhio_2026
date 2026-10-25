import { Euler, Object3D, Quaternion, Vector3 } from 'three'
import type { JointName } from '../data/joints'

// The west-row lower footplates (CableStackApparatus: centre x -1.03, y .27, ±.18 apart, 18 mm thick, tilted -0.42 rad
// about Z) in the humanoid root's frame. The composite seats the humanoid at world (-1.85, .09, 0) facing +X, so
// local z = worldX + 1.85 and local y = worldY - .09. Only the forward/up (z, y) plane matters; the plates are wider than a foot.
const PLATE_TILT = 0.42
const PLATE_CENTRE = { z: -1.03 + 1.85, y: 0.27 - 0.09 }
const PLATE_HALF_THICKNESS = 0.009
const PLATE_NORMAL = { z: -Math.cos(PLATE_TILT), y: Math.sin(PLATE_TILT) } // out of the plate, toward the seat
const PLATE_UP = { z: Math.sin(PLATE_TILT), y: Math.cos(PLATE_TILT) } // along the plate, toward its top edge
// Measured on human.glb at rest: the ankle bone sits 95 mm above the sole and 58 mm ahead of the heel.
const ANKLE_ABOVE_SOLE = 0.095 + 0.001 // hairline gap so the sole never z-fights the studded plate
const ANKLE_AHEAD_OF_HEEL = 0.058
const HEEL_ALONG_PLATE = -0.125 // heel near the plate's lower edge (plate half-length .14), toes stay on the plate
// Below this pelvis height the figure is seated and the feet belong on the plates; blend in over the sit-down.
const SEATED_START = 0.7
const SEATED_FULL = 0.56

/** Keep the soles flat on the row footplates for every seated pose, including the hip hinge. */
export function createSeatedSupport(root: Object3D, joints: Record<JointName, Object3D>, rest: Record<JointName, Quaternion>) {
  // Rest orientation of each foot relative to the root (standing, sole flat), captured before any pose is applied.
  const saved = Object.values(joints).map(joint => ({joint, rotation: joint.quaternion.clone(), position: joint.position.clone()}))
  for (const name of Object.keys(rest) as JointName[]) joints[name].quaternion.copy(rest[name])
  root.updateWorldMatrix(true, true)
  const rootInverse = root.getWorldQuaternion(new Quaternion()).invert()
  // Pitch the flat foot toes-up until the sole lies in the plate plane.
  const pitch = new Quaternion().setFromEuler(new Euler(-(Math.PI / 2 - PLATE_TILT), 0, 0))
  const along = HEEL_ALONG_PLATE + ANKLE_AHEAD_OF_HEEL
  const anchors = (['L', 'R'] as const).map(side => {
    const ankle = joints[`ankle_${side}`]
    const lateral = root.worldToLocal(ankle.getWorldPosition(new Vector3())).x
    const position = new Vector3(
      lateral,
      PLATE_CENTRE.y + PLATE_NORMAL.y * (PLATE_HALF_THICKNESS + ANKLE_ABOVE_SOLE) + PLATE_UP.y * along,
      PLATE_CENTRE.z + PLATE_NORMAL.z * (PLATE_HALF_THICKNESS + ANKLE_ABOVE_SOLE) + PLATE_UP.z * along,
    )
    const rotation = pitch.clone().multiply(rootInverse.clone().multiply(ankle.getWorldQuaternion(new Quaternion())))
    return { side, position, rotation }
  })
  for (const {joint, rotation, position} of saved) { joint.quaternion.copy(rotation); joint.position.copy(position) }
  root.updateWorldMatrix(true, true)

  // Rotate around the midpoint of the femoral heads, not the higher pelvis bone origin.
  const hipCenter = joints.hip_L.position.clone().add(joints.hip_R.position).multiplyScalar(.5)
  const basePelvis = joints.pelvis.position.clone()
  const lastPelvis = new Vector3(Infinity, Infinity, Infinity)
  const turnToward = (joint: Object3D, from: Vector3, to: Vector3) => {
    const parent = joint.parent!.getWorldQuaternion(new Quaternion())
    const delta = parent.clone().invert().multiply(new Quaternion().setFromUnitVectors(from.normalize(), to.normalize())).multiply(parent)
    joint.quaternion.premultiply(delta)
    joint.updateWorldMatrix(true, true)
  }
  return () => {
    if (joints.pelvis.position.distanceToSquared(lastPelvis) > 1e-12) basePelvis.copy(joints.pelvis.position)
    const hinge = joints.pelvis.quaternion.clone().multiply(rest.pelvis.clone().invert())
    const pivot = hipCenter.clone().sub(hipCenter.clone().applyQuaternion(hinge))
    joints.pelvis.position.copy(basePelvis)
    if (basePelvis.y < SEATED_START) joints.pelvis.position.add(pivot)
    lastPelvis.copy(joints.pelvis.position)
    const weight = Math.min(1, Math.max(0, (SEATED_START - joints.pelvis.position.y) / (SEATED_START - SEATED_FULL)))
    if (weight === 0) return
    root.updateWorldMatrix(true, true)
    const rootRotation = root.getWorldQuaternion(new Quaternion())
    for (const {side, position, rotation} of anchors) {
      const hip = joints[`hip_${side}`], knee = joints[`knee_${side}`], ankle = joints[`ankle_${side}`]
      const authored = [hip, knee, ankle].map(j => j.quaternion.clone())
      const h = hip.getWorldPosition(new Vector3()), k = knee.getWorldPosition(new Vector3()), a = ankle.getWorldPosition(new Vector3())
      const target = root.localToWorld(position.clone())
      const upper = h.distanceTo(k), lower = k.distanceTo(a)
      const direction = target.clone().sub(h)
      const distance = Math.min(upper + lower - 1e-6, Math.max(Math.abs(upper - lower) + 1e-6, direction.length()))
      direction.normalize()
      const reach = (upper * upper - lower * lower + distance * distance) / (2 * distance)
      const height = Math.sqrt(Math.max(0, upper * upper - reach * reach))
      const bend = k.clone().sub(h).addScaledVector(direction, -k.clone().sub(h).dot(direction)).normalize()
      const desiredKnee = h.clone().addScaledVector(direction, reach).addScaledVector(bend, height)
      turnToward(hip, k.sub(h), desiredKnee.sub(h))
      const kneePosition = knee.getWorldPosition(new Vector3())
      turnToward(knee, ankle.getWorldPosition(new Vector3()).sub(kneePosition), target.sub(kneePosition))
      const desired = rootRotation.clone().multiply(rotation)
      ankle.quaternion.copy(ankle.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(desired))
      if (weight < 1) [hip, knee, ankle].forEach((j, i) => j.quaternion.slerpQuaternions(authored[i], j.quaternion.clone(), weight))
    }
  }
}
