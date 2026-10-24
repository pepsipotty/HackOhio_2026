import { Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import type { Rig } from './rig'
import { HUMANOID_BONES } from './humanoid'

/** Keep the two row grips lateral instead of letting the attachment roll with the cable. */
export function orientRowHandle(handle: Object3D, direction: Vector3) {
  const y = direction.clone().normalize().negate()
  const z = new Vector3(0, 0, -1).cross(y).normalize()
  const x = y.clone().cross(z).normalize()
  handle.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(x, y, z))
  handle.updateWorldMatrix(true, true)
}

export function createRowGrip(rig: Rig) {
  const sides = ['L', 'R'] as const
  const corrections = sides.map(side => {
    const wrist = rig.joints[`wrist_${side}`]
    const bone = rig.root.getObjectByName(HUMANOID_BONES[`wrist_${side}`])
    return bone ? wrist.getWorldQuaternion(new Quaternion()).invert().multiply(bone.getWorldQuaternion(new Quaternion())) : new Quaternion()
  })
  const fingers: {bone: Object3D; rest: Quaternion; angle: number}[] = []
  rig.root.traverse(bone => {
    const match = bone.name.match(/Hand(Thumb|Index|Middle|Ring|Pinky)([123])$/)
    if (match) fingers.push({bone, rest: bone.quaternion.clone(), angle: (match[1] === 'Thumb' ? [.38, .6, .55] : [.95, 1.35, .8])[Number(match[2]) - 1]})
  })
  const saved = new Map<Object3D, Quaternion>()
  const restore = () => { for (const [joint, rotation] of saved) joint.quaternion.copy(rotation); saved.clear() }
  const curl = (amount: number) => {
    for (const {bone, rest, angle} of fingers) bone.quaternion.copy(rest).multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), angle * amount))
  }
  const solve = (handle: Object3D, amount = 1) => {
    if (amount <= 0) { curl(0); return }
    rig.root.updateWorldMatrix(true, true)
    handle.updateWorldMatrix(true, true)
    sides.forEach((side, index) => {
      const wrist = rig.joints[`wrist_${side}`]
      // Attachment grip cylinder centers, in the actual row-handle mesh's local frame.
      const grip = handle.localToWorld(new Vector3(side === 'L' ? .082 : -.082, -.11, .04))
      const forward = new Vector3(0, 1, 0).applyQuaternion(handle.getWorldQuaternion(new Quaternion()))
      const palm = new Vector3(side === 'L' ? -1 : 1, 0, 0).applyQuaternion(handle.getWorldQuaternion(new Quaternion()))
      const handX = forward.clone().cross(palm).normalize()
      const handWorld = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(handX, forward, palm))
      const target = grip.addScaledVector(forward, -.085).addScaledVector(palm, -.018)
      const names = [`shoulder_${side}`, `elbow_${side}`, `wrist_${side}`] as const
      for (const name of names) saved.set(rig.joints[name], rig.joints[name].quaternion.clone())
      for (let iteration = 0; iteration < 40; iteration++) {
        if (wrist.getWorldPosition(new Vector3()).distanceToSquared(target) < .000001) break
        for (const name of [`elbow_${side}`, `shoulder_${side}`] as const) {
          const joint = rig.joints[name], origin = joint.getWorldPosition(new Vector3())
          const a = wrist.getWorldPosition(new Vector3()).sub(origin).normalize()
          const b = target.clone().sub(origin).normalize()
          const parent = joint.parent!.getWorldQuaternion(new Quaternion())
          const turn = parent.clone().invert().multiply(new Quaternion().setFromUnitVectors(a, b)).multiply(parent)
          joint.quaternion.premultiply(turn)
          joint.updateWorldMatrix(true, true)
        }
      }
      const desired = handWorld.multiply(corrections[index].clone().invert())
      wrist.quaternion.copy(wrist.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(desired))
      if (amount < 1) for (const name of names) {
        const joint = rig.joints[name]
        joint.quaternion.slerpQuaternions(saved.get(joint)!, joint.quaternion.clone(), amount)
      }
    })
    rig.update?.()
    curl(amount)
    rig.root.updateWorldMatrix(true, true)
  }
  return { solve, restore, curl }
}
