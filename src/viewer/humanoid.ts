// Retarget the imported Mixamo skeleton to Rep One's metre-based joint controls.
// The source skeleton and skin weights are retained; only bone transforms move.
import { Object3D, Quaternion, Vector3 } from 'three'
import { JOINT_NAMES, JOINT_PARENT, type JointName } from '../data/joints'
import type { Rig } from './rig'
import { createSeatedSupport, type FeetTargets } from './seated-support'

export const HUMANOID_BONES: Record<JointName, string> = {
  pelvis: 'mixamorig1Hips', spine: 'mixamorig1Spine', chest: 'mixamorig1Spine2',
  neck: 'mixamorig1Neck', head: 'mixamorig1Head',
  shoulder_L: 'mixamorig1LeftArm', shoulder_R: 'mixamorig1RightArm',
  elbow_L: 'mixamorig1LeftForeArm', elbow_R: 'mixamorig1RightForeArm',
  wrist_L: 'mixamorig1LeftHand', wrist_R: 'mixamorig1RightHand',
  hip_L: 'mixamorig1LeftUpLeg', hip_R: 'mixamorig1RightUpLeg',
  knee_L: 'mixamorig1LeftLeg', knee_R: 'mixamorig1RightLeg',
  ankle_L: 'mixamorig1LeftFoot', ankle_R: 'mixamorig1RightFoot',
}

export function adaptHumanoid(asset: Object3D): Rig {
  const bones = {} as Record<JointName, Object3D>
  for (const name of JOINT_NAMES) {
    const bone = asset.getObjectByName(HUMANOID_BONES[name])
    if (!bone) throw new Error(`Humanoid is missing ${HUMANOID_BONES[name]}`)
    bones[name] = bone
  }
  asset.updateMatrixWorld(true)
  const hips = bones.pelvis.getWorldPosition(new Vector3())
  if (hips.y <= 0) throw new Error('Humanoid pelvis must be above the ground')
  asset.scale.multiplyScalar(1 / hips.y)
  asset.updateMatrixWorld(true)
  bones.pelvis.getWorldPosition(hips)
  asset.position.x -= hips.x
  asset.position.z -= hips.z
  asset.updateMatrixWorld(true)

  // Convert T-pose arms to the viewer's arms-at-sides zero pose in world space.
  for (const side of ['L', 'R'] as const) {
    const arm = bones[`shoulder_${side}`]
    const axis = new Vector3(0, 0, 1).applyQuaternion(arm.parent!.getWorldQuaternion(new Quaternion()).invert())
    arm.quaternion.premultiply(new Quaternion().setFromAxisAngle(axis, side === 'L' ? -Math.PI / 2 : Math.PI / 2))
    asset.updateMatrixWorld(true)
  }

  const root = new Object3D()
  root.name = 'muscle-humanoid'
  root.add(asset)
  const controls = new Object3D()
  controls.name = 'exercise-joint-controls'
  root.add(controls)
  const joints = {} as Record<JointName, Object3D>
  const rest = {} as Record<JointName, Quaternion>
  const correction = {} as Record<JointName, Quaternion>
  const flipped = new Set<JointName>(['shoulder_L', 'shoulder_R', 'hip_L', 'hip_R', 'knee_L', 'knee_R'])
  for (const name of JOINT_NAMES) {
    const joint = new Object3D()
    joint.name = name
    const parent = JOINT_PARENT[name] ? joints[JOINT_PARENT[name]!] : controls
    parent.add(joint)
    parent.updateWorldMatrix(true, false)
    joint.position.copy(parent.worldToLocal(bones[name].getWorldPosition(new Vector3())))
    if (flipped.has(name)) joint.rotation.y = Math.PI
    joint.updateWorldMatrix(true, false)
    joints[name] = joint
    rest[name] = joint.quaternion.clone()
    correction[name] = joint.getWorldQuaternion(new Quaternion()).invert().multiply(bones[name].getWorldQuaternion(new Quaternion()))
  }

  // Walk the source skeleton's actual hierarchy; it includes unmapped spacer bones.
  const byBone = new Map(JOINT_NAMES.map(name => [bones[name], name] as const))
  const ordered: Array<[Object3D, JointName]> = []
  asset.traverse(bone => { const name = byBone.get(bone); if (name) ordered.push([bone, name]) })
  const position = new Vector3(), rotation = new Quaternion(), parentRotation = new Quaternion()
  const supportFeet = createSeatedSupport(root, joints, rest)

  // Shoulder blades: the clavicle bones swing about a vertical axis through the sternum end, carrying the
  // arm roots back and in. The arms keep their authored direction; only where they hang from moves.
  const UP = new Vector3(0, 1, 0)
  const clavicles = (['L', 'R'] as const).map(side => {
    const bone = asset.getObjectByName(`mixamorig1${side === 'L' ? 'Left' : 'Right'}Shoulder`)
    const shoulder = joints[`shoulder_${side}`]
    return bone && {
      bone, shoulder, sign: side === 'L' ? 1 : -1, restLocal: bone.quaternion.clone(), restOffset: shoulder.position.clone(),
      pivot: joints.chest.worldToLocal(bone.getWorldPosition(new Vector3())),
    }
  }).filter(c => !!c)
  let retraction = 0, feet: FeetTargets | null = null
  const turn = new Quaternion(), chestRotation = new Quaternion(), axis = new Vector3()
  const update = () => {
    for (const c of clavicles) c.shoulder.position.copy(c.restOffset).sub(c.pivot).applyAxisAngle(UP, c.sign * retraction).add(c.pivot)
    supportFeet(feet)
    controls.updateWorldMatrix(true, true)
    joints.chest.getWorldQuaternion(chestRotation)
    axis.copy(UP).applyQuaternion(chestRotation)
    for (const [bone, name] of ordered) {
      if (name === 'shoulder_L' || name === 'shoulder_R') {
        const c = clavicles.find(k => k.shoulder === joints[name])
        if (c) {
          c.bone.parent!.updateWorldMatrix(true, false)
          c.bone.parent!.getWorldQuaternion(parentRotation)
          turn.setFromAxisAngle(axis, c.sign * retraction)
          rotation.copy(parentRotation).multiply(c.restLocal).premultiply(turn)
          c.bone.quaternion.copy(parentRotation.invert().multiply(rotation))
        }
      }
      bone.parent!.updateWorldMatrix(true, false)
      joints[name].getWorldPosition(position)
      bone.position.copy(bone.parent!.worldToLocal(position))
      joints[name].getWorldQuaternion(rotation).multiply(correction[name])
      bone.parent!.getWorldQuaternion(parentRotation).invert()
      bone.quaternion.copy(parentRotation.multiply(rotation))
      bone.updateWorldMatrix(false, false)
    }
    asset.updateWorldMatrix(true, true)
  }
  update()
  return {
    root, joints, rest, placeholder: false, update,
    setFeet(next) { feet = next },
    setScapula(degrees) { retraction = degrees * Math.PI / 180 },
  }
}
