import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { Euler, Quaternion, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { adaptHumanoid, HUMANOID_BONES } from '../src/viewer/humanoid'
import { JOINT_NAMES } from '../src/data/joints'
import { getMotion } from '../src/data/motion'

async function humanoid() {
  const bytes = readFileSync('public/models/human.glb')
  const loader = new GLTFLoader().register(() => ({name: 'test-texture-stub', loadTexture: async () => new Texture()}))
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '')
  return adaptHumanoid(gltf.scene)
}

describe('imported muscle humanoid', () => {
  test('retains the actual skin, all muscle groups, and a pelvis at one metre', async () => {
    const rig = await humanoid()
    expect(rig.placeholder).toBe(false)
    expect(rig.joints.pelvis.getWorldPosition(new Vector3()).y).toBeCloseTo(1)
    const groups = new Set<string>()
    rig.root.traverse(o => { if (o.userData.muscle) groups.add(o.userData.muscle) })
    expect(groups.size).toBe(23)
    expect(groups.has('rhomboid-major')).toBe(true)
    expect(groups.has('latissimus')).toBe(true)
  })

  test('drives source bones from the exercise controls through every seated-row pose', async () => {
    const rig = await humanoid(), motion = (await getMotion('seated-cable-row'))!
    for (const step of motion.steps) {
      for (const name of JOINT_NAMES) {
        const a = step.pose.joints[name] ?? [0, 0, 0]
        rig.joints[name].quaternion.copy(rig.rest[name]).multiply(new Quaternion().setFromEuler(new Euler(...a.map(v => v * Math.PI / 180) as [number, number, number], 'XYZ')))
      }
      rig.joints.pelvis.position.set(...step.pose.root!.position)
      rig.update!()
      for (const name of JOINT_NAMES) {
        const source = rig.root.getObjectByName(HUMANOID_BONES[name])!.getWorldPosition(new Vector3())
        const driver = rig.joints[name].getWorldPosition(new Vector3())
        expect(source.distanceTo(driver), `${step.id}: ${name}`).toBeLessThan(0.00001)
      }
      const left = rig.joints.wrist_L.getWorldPosition(new Vector3())
      const right = rig.joints.wrist_R.getWorldPosition(new Vector3())
      expect(left.y).toBeCloseTo(right.y, 1)
      expect(left.z).toBeCloseTo(right.z, 1)
      if (step.id === 'spine-position') {
        expect(left.z).toBeGreaterThan(.35)
        expect(rig.joints.ankle_L.getWorldPosition(new Vector3()).y).toBeGreaterThan(0)
      }
    }
  })
})

// Actual imported skeleton: palm contact remains attached after retargeting and repeated solves.
test('row grip aligns both palms to the real attachment and restores authored poses', async () => {
  const { createRowGrip, orientRowHandle } = await import('../src/viewer/row-grip')
  const { Object3D } = await import('three')
  const rig = await humanoid()
  const grip = createRowGrip(rig)
  const motion = (await getMotion('seated-cable-row'))!
  const pose = motion.steps[3].pose
  for (const name of JOINT_NAMES) {
    const angles = pose.joints[name] ?? [0, 0, 0]
    rig.joints[name].quaternion.copy(rig.rest[name]).multiply(new Quaternion().setFromEuler(new Euler(...angles.map(v => v * Math.PI / 180) as [number, number, number])))
  }
  rig.joints.pelvis.position.set(...pose.root!.position)
  rig.update!()
  const handle = new Object3D()
  handle.position.set(0, 1, .4)
  orientRowHandle(handle, new Vector3(0, .4, -.9))
  const before = rig.joints.shoulder_L.quaternion.clone()
  for (let cycle = 0; cycle < 3; cycle++) {
    grip.solve(handle)
    for (const side of ['L', 'R'] as const) {
      const hand = rig.root.getObjectByName(HUMANOID_BONES[`wrist_${side}`])!
      const rotation = hand.getWorldQuaternion(new Quaternion())
      const palm = hand.getWorldPosition(new Vector3())
        .add(new Vector3(0, .085, .018).applyQuaternion(rotation))
      const target = handle.localToWorld(new Vector3(side === 'L' ? .082 : -.082, -.11, .04))
      expect(palm.distanceTo(target)).toBeLessThan(.012)
    }
    grip.restore()
    expect(rig.joints.shoulder_L.quaternion.angleTo(before)).toBeLessThan(1e-6)
  }
})
