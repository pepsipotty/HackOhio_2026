import { Euler, Object3D, Quaternion, Vector3 } from 'three'
import type { JointName } from '../data/joints'
import type { FootTarget } from '../data/motion'
import { SEAT_LIFT, footplateTarget } from '../data/row-station'

// Below this pelvis height the figure is seated and, unless told otherwise, the feet belong on the plates.
const SEATED_START = 0.7
const SEATED_FULL = 0.56
const DEG = Math.PI / 180

export type FeetTargets = { L: FootTarget; R: FootTarget }

/**
 * Two-bone leg IK. Each call reaches the ankles for their targets: explicit ones (walking, stepping over the
 * bench, lifting the feet onto the plates), or by default the footplates whenever the figure is seated.
 * Seated, the pelvis also hinges around the hip joints rather than its own origin.
 */
export function createSeatedSupport(root: Object3D, joints: Record<JointName, Object3D>, rest: Record<JointName, Quaternion>) {
  // Rest orientation of each foot relative to the root (standing, sole flat), captured with every joint at rest.
  const saved = Object.values(joints).map(joint => ({joint, rotation: joint.quaternion.clone(), position: joint.position.clone()}))
  for (const name of Object.keys(rest) as JointName[]) joints[name].quaternion.copy(rest[name])
  root.updateWorldMatrix(true, true)
  const rootInverse = root.getWorldQuaternion(new Quaternion()).invert()
  const restFoot = {
    L: rootInverse.clone().multiply(joints.ankle_L.getWorldQuaternion(new Quaternion())),
    R: rootInverse.clone().multiply(joints.ankle_R.getWorldQuaternion(new Quaternion())),
  }
  for (const {joint, rotation, position} of saved) { joint.quaternion.copy(rotation); joint.position.copy(position) }
  root.updateWorldMatrix(true, true)
  const plates = { L: footplateTarget('L'), R: footplateTarget('R') }

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
  const euler = new Euler()
  return (feet?: FeetTargets | null) => {
    if (joints.pelvis.position.distanceToSquared(lastPelvis) > 1e-12) basePelvis.copy(joints.pelvis.position)
    const hinge = joints.pelvis.quaternion.clone().multiply(rest.pelvis.clone().invert())
    const pivot = hipCenter.clone().sub(hipCenter.clone().applyQuaternion(hinge))
    joints.pelvis.position.copy(basePelvis)
    const seated = Math.min(1, Math.max(0, (SEATED_START - basePelvis.y) / (SEATED_START - SEATED_FULL)))
    if (basePelvis.y < SEATED_START) joints.pelvis.position.add(pivot)
    lastPelvis.copy(joints.pelvis.position)
    // Default: plates, in the seated frame the composite lifts the figure into.
    const targets = feet ?? (seated > 0 ? plates : null)
    if (!targets) return
    const floor = feet ? root.position.y : SEAT_LIFT // explicit targets are measured from the floor
    root.updateWorldMatrix(true, true)
    const rootRotation = root.getWorldQuaternion(new Quaternion())
    const forward = new Vector3(0, 0, 1).applyQuaternion(rootRotation)
    for (const side of ['L', 'R'] as const) {
      const [x, y, z, pitch, w] = targets[side]
      const weight = feet ? w : seated
      if (weight <= 0) continue
      const hip = joints[`hip_${side}`], knee = joints[`knee_${side}`], ankle = joints[`ankle_${side}`]
      const authored = [hip, knee, ankle].map(j => j.quaternion.clone())
      const h = hip.getWorldPosition(new Vector3()), k = knee.getWorldPosition(new Vector3()), a = ankle.getWorldPosition(new Vector3())
      const target = root.localToWorld(new Vector3(x, y - floor, z))
      const upper = h.distanceTo(k), lower = k.distanceTo(a)
      const direction = target.clone().sub(h)
      const distance = Math.min(upper + lower - 1e-6, Math.max(Math.abs(upper - lower) + 1e-6, direction.length()))
      direction.normalize()
      const reach = (upper * upper - lower * lower + distance * distance) / (2 * distance)
      const height = Math.sqrt(Math.max(0, upper * upper - reach * reach))
      // The posed knee picks the bend plane; a straight leg falls back to bending forward.
      const bend = k.clone().sub(h).addScaledVector(direction, -k.clone().sub(h).dot(direction))
      if (bend.lengthSq() < 1e-6) bend.copy(forward).addScaledVector(direction, -forward.dot(direction))
      bend.normalize()
      const desiredKnee = h.clone().addScaledVector(direction, reach).addScaledVector(bend, height)
      turnToward(hip, k.sub(h), desiredKnee.sub(h))
      const kneePosition = knee.getWorldPosition(new Vector3())
      turnToward(knee, ankle.getWorldPosition(new Vector3()).sub(kneePosition), target.sub(kneePosition))
      const tilt = new Quaternion().setFromEuler(euler.set(-pitch * DEG, 0, 0))
      const desired = rootRotation.clone().multiply(tilt).multiply(restFoot[side])
      ankle.quaternion.copy(ankle.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(desired))
      if (weight < 1) [hip, knee, ankle].forEach((j, i) => j.quaternion.slerpQuaternions(authored[i], j.quaternion.clone(), weight))
    }
  }
}
