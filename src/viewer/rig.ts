// Swappable 3D rig: a GLB whose bones match JOINT_NAMES (or BONE_MAP), else a primitive mannequin.
//
// Joint angle convention: poses are Euler degrees in XYZ order, relative to the rest pose
// (standing, arms at sides, facing +Z, Y up, metres, pelvis at y = 1.0), applied as
// joint.quaternion = rest × euler. Positive X flexes: the spine and chest lean forward, the hip
// lifts the thigh forward, the knee bends, the shoulder raises the arm forward, the elbow bends.
// The mannequin's shoulder/hip pivots are turned 180° about Y (and the knee turned back) so this
// holds on both the left and right side. A pose's root.position is the pelvis joint's position;
// rig.root itself stays at the origin.
import {
  CapsuleGeometry, BoxGeometry, SphereGeometry, Mesh, Object3D, Quaternion,
  type BufferGeometry, type Material,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { JOINT_NAMES, JOINT_PARENT, type JointName } from '../data/joints'
import { adaptHumanoid, HUMANOID_BONES } from './humanoid'
import type { FootTarget } from '../data/motion'

export { JOINT_NAMES, type JointName } from '../data/joints'

export interface Rig {
  root: Object3D
  joints: Record<JointName, Object3D>
  rest: Record<JointName, Quaternion>
  placeholder: boolean
  update?(): void
  /** Plant the ankles (null: footplates when seated). Applied on the next update. */
  setFeet?(feet: { L: FootTarget; R: FootTarget } | null): void
  /** Shoulder-blade retraction, degrees. Applied on the next update. */
  setScapula?(degrees: number): void
}

// Fill when a GLB's bone names differ from JOINT_NAMES, e.g. { pelvis: 'mixamorigHips' }.
export const BONE_MAP: Partial<Record<JointName, string>> = {}

type V3 = [number, number, number]

// Offset from the parent joint, in the parent's local frame. Left is +X (the figure faces +Z).
const OFFSET: Record<JointName, V3> = {
  pelvis: [0, 1.0, 0],
  spine: [0, 0.05, 0],
  chest: [0, 0.2, 0],
  neck: [0, 0.23, 0],
  head: [0, 0.08, 0],
  shoulder_L: [0.19, 0.2, 0], shoulder_R: [-0.19, 0.2, 0],
  elbow_L: [0, -0.3, 0], elbow_R: [0, -0.3, 0],
  wrist_L: [0, -0.27, 0], wrist_R: [0, -0.27, 0],
  hip_L: [0.09, -0.06, 0], hip_R: [-0.09, -0.06, 0],
  knee_L: [0, -0.42, 0], knee_R: [0, -0.42, 0],
  ankle_L: [0, -0.42, 0], ankle_R: [0, -0.42, 0],
}

// Turned 180° about Y so +X rotation swings a hanging limb toward +Z; the knee turns back so it bends the other way.
const FLIPPED = new Set<JointName>(['shoulder_L', 'shoulder_R', 'hip_L', 'hip_R', 'knee_L', 'knee_R'])

// Segment hanging from each joint toward its child: [length, radius, scaleX, scaleZ]. Up for the torso, down for limbs.
const SEGMENT: Partial<Record<JointName, [number, number, number, number]>> = {
  spine: [0.2, 0.11, 1.3, 0.85],
  chest: [0.23, 0.13, 1.35, 0.8],
  neck: [0.08, 0.045, 1, 1],
  shoulder_L: [0.3, 0.048, 1, 1], shoulder_R: [0.3, 0.048, 1, 1],
  elbow_L: [0.27, 0.04, 1, 1], elbow_R: [0.27, 0.04, 1, 1],
  hip_L: [0.42, 0.072, 1, 1], hip_R: [0.42, 0.072, 1, 1],
  knee_L: [0.42, 0.052, 1, 1], knee_R: [0.42, 0.052, 1, 1],
}
const UP = new Set<JointName>(['spine', 'chest', 'neck'])

export function buildMannequin(material: Material): Rig {
  const root = new Object3D()
  root.name = 'mannequin'
  const joints = {} as Record<JointName, Object3D>
  const rest = {} as Record<JointName, Quaternion>
  const add = (parent: Object3D, geo: BufferGeometry, pos: V3, scale: V3 = [1, 1, 1]) => {
    const m = new Mesh(geo, material)
    m.position.set(...pos)
    m.scale.set(...scale)
    m.castShadow = true
    parent.add(m)
  }
  const ball = new SphereGeometry(1, 20, 14)

  // JOINT_NAMES lists every parent before its children.
  for (const j of JOINT_NAMES) {
    const pivot = new Object3D()
    pivot.name = j
    pivot.position.set(...OFFSET[j])
    if (FLIPPED.has(j)) pivot.rotation.y = Math.PI
    const parent = JOINT_PARENT[j]
    ;(parent ? joints[parent] : root).add(pivot)
    joints[j] = pivot
    rest[j] = pivot.quaternion.clone()

    const seg = SEGMENT[j]
    if (seg) {
      const [len, r, sx, sz] = seg
      // Capsule ends overlap the joint balls so bends stay closed.
      add(pivot, new CapsuleGeometry(r, Math.max(len - r, 0.01), 6, 16), [0, UP.has(j) ? len / 2 : -len / 2, 0], [sx, 1, sz])
    }
    const jr = seg && !UP.has(j) ? seg[1] * 1.08 : 0.055
    if (j !== 'head') add(pivot, ball, [0, 0, 0], [jr, jr, jr])
  }

  // Pelvis block, head, hands and feet.
  add(joints.pelvis, ball, [0, -0.01, 0], [0.16, 0.11, 0.11])
  add(joints.head, ball, [0, 0.1, 0.01], [0.095, 0.115, 0.105])
  for (const s of ['L', 'R'] as const) {
    add(joints[`wrist_${s}`], new BoxGeometry(0.03, 0.1, 0.08), [0, -0.055, 0])
    add(joints[`ankle_${s}`], new BoxGeometry(0.09, 0.06, 0.24), [0, -0.05, 0.06])
  }
  return { root, joints, rest, placeholder: true }
}

export async function loadRig(url: string, material: Material): Promise<Rig> {
  let found = false
  try {
    // HEAD first so a missing model never reaches GLTFLoader (Vite's SPA fallback answers 200 with HTML).
    const head = await fetch(url, { method: 'HEAD' })
    if (!head.ok || head.headers.get('content-type')?.includes('text/html')) throw new Error(`no model at ${url}`)
    found = true
    const gltf = await new GLTFLoader().loadAsync(url)
    if (gltf.scene.getObjectByName(HUMANOID_BONES.pelvis)) return adaptHumanoid(gltf.scene)
    const joints = {} as Record<JointName, Object3D>
    const rest = {} as Record<JointName, Quaternion>
    for (const j of JOINT_NAMES) {
      const bone = gltf.scene.getObjectByName(BONE_MAP[j] ?? j)
      if (!bone) throw new Error(`model is missing joint ${j}`)
      joints[j] = bone
      rest[j] = bone.quaternion.clone()
    }
    return { root: gltf.scene, joints, rest, placeholder: false }
  } catch (err) {
    // A missing file is the normal case and stays silent; a model that exists but fails is worth knowing about.
    if (found) console.warn(`Rep One: could not use ${url}, falling back to the mannequin.`, err)
    return buildMannequin(material)
  }
}
