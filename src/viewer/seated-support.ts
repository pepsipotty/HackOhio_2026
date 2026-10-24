import { Euler, Object3D, Quaternion, Vector3 } from 'three'
import type { JointName } from '../data/joints'

/** Preserve footplate contact as the pelvis rotates over the seated hip joints. */
export function createSeatedSupport(root: Object3D, joints: Record<JointName, Object3D>, rest: Record<JointName, Quaternion>) {
  const saved = Object.values(joints).map(joint => ({joint, rotation: joint.quaternion.clone(), position: joint.position.clone()}))
  joints.pelvis.position.set(0, .52, 0)
  joints.pelvis.quaternion.copy(rest.pelvis)
  for (const side of ['L', 'R'] as const) {
    joints[`hip_${side}`].quaternion.copy(rest[`hip_${side}`]).multiply(new Quaternion().setFromEuler(new Euler(85 * Math.PI / 180, 0, 0)))
    joints[`knee_${side}`].quaternion.copy(rest[`knee_${side}`]).multiply(new Quaternion().setFromEuler(new Euler(25 * Math.PI / 180, 0, 0)))
  }
  root.updateWorldMatrix(true, true)
  const anchors = (['L', 'R'] as const).map(side => {
    const ankle = joints[`ankle_${side}`]
    return { side, position: root.worldToLocal(ankle.getWorldPosition(new Vector3())), rotation: root.getWorldQuaternion(new Quaternion()).invert().multiply(ankle.getWorldQuaternion(new Quaternion())) }
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
    if (basePelvis.y < .7) joints.pelvis.position.add(pivot)
    lastPelvis.copy(joints.pelvis.position)
    if (joints.pelvis.position.y > .7 || joints.pelvis.quaternion.angleTo(rest.pelvis) < 1e-5) return
    root.updateWorldMatrix(true, true)
    for (const {side, position, rotation} of anchors) {
      const hip = joints[`hip_${side}`], knee = joints[`knee_${side}`], ankle = joints[`ankle_${side}`]
      const h = hip.getWorldPosition(new Vector3()), k = knee.getWorldPosition(new Vector3()), a = ankle.getWorldPosition(new Vector3())
      const target = root.localToWorld(position.clone())
      const upper = h.distanceTo(k), lower = k.distanceTo(a)
      const direction = target.clone().sub(h)
      const distance = Math.min(upper + lower - 1e-6, Math.max(Math.abs(upper - lower) + 1e-6, direction.length()))
      direction.normalize()
      const along = (upper * upper - lower * lower + distance * distance) / (2 * distance)
      const height = Math.sqrt(Math.max(0, upper * upper - along * along))
      const bend = k.clone().sub(h).addScaledVector(direction, -k.clone().sub(h).dot(direction)).normalize()
      const desiredKnee = h.clone().addScaledVector(direction, along).addScaledVector(bend, height)
      turnToward(hip, k.sub(h), desiredKnee.sub(h))
      const kneePosition = knee.getWorldPosition(new Vector3())
      turnToward(knee, ankle.getWorldPosition(new Vector3()).sub(kneePosition), target.sub(kneePosition))
      const desired = root.getWorldQuaternion(new Quaternion()).multiply(rotation)
      ankle.quaternion.copy(ankle.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(desired))
    }
  }
}
