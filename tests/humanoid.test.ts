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
    // every muscle the row highlights must exist on the model and have a readable name
    const { MUSCLE_NAMES } = await import('../src/data/muscles')
    const targets = (await getMotion('seated-cable-row'))!.muscles!
    for (const id of [...targets.primary, ...targets.secondary ?? []]) {
      expect(groups.has(id), id).toBe(true)
      expect(MUSCLE_NAMES[id], id).toBeTruthy()
    }
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

test('pelvis hinges through the row while both feet remain fixed on the footplates', async () => {
  const { samplePose } = await import('../src/lib/tween')
  const rig = await humanoid(), motion = (await getMotion('seated-cable-row'))!
  // Exercise the native gym orientation as well as the model's own coordinates.
  rig.root.position.set(-1.85, .09, 0)
  rig.root.rotation.y = Math.PI / 2
  const feet: { position: Vector3; rotation: Quaternion }[] = []
  const hips: number[] = [], chests: number[] = []
  for (let frame = 0; frame <= 40; frame++) {
    const pose = samplePose(motion.rep!.keys, frame / 40, true)
    for (const name of JOINT_NAMES) {
      const a = pose.joints[name] ?? [0, 0, 0]
      rig.joints[name].quaternion.copy(rig.rest[name]).multiply(new Quaternion().setFromEuler(new Euler(...a.map(v => v * Math.PI / 180) as [number, number, number])))
    }
    rig.joints.pelvis.position.set(...pose.root!.position)
    rig.update!()
    for (let repeat = 0; repeat < 3; repeat++) rig.update!()
    hips.push(pose.joints.pelvis![0])
    chests.push(rig.joints.chest.getWorldPosition(new Vector3()).x)
    for (const [index, side] of (['L', 'R'] as const).entries()) {
      const ankle = rig.root.getObjectByName(HUMANOID_BONES[`ankle_${side}`])!
      const position = ankle.getWorldPosition(new Vector3()), rotation = ankle.getWorldQuaternion(new Quaternion())
      if (!frame) feet.push({position, rotation})
      expect(position.distanceTo(feet[index].position)).toBeLessThan(.001)
      expect(rotation.angleTo(feet[index].rotation)).toBeLessThan(.001)
    }
  }
  expect(Math.max(...hips) - Math.min(...hips)).toBeGreaterThan(25)
  expect(Math.max(...chests) - Math.min(...chests)).toBeGreaterThan(.12)
})

test('soles rest on the lower footplates without passing through them in every seated pose', async () => {
  const { SkinnedMesh, Matrix4 } = await import('three')
  const { samplePose } = await import('../src/lib/tween')
  const rig = await humanoid(), motion = (await getMotion('seated-cable-row'))!
  // Same placement as cable-row-composite.ts once seated.
  rig.root.position.set(-1.85, .09, 0)
  rig.root.rotation.y = Math.PI / 2
  // Lower footplates from CableStackApparatus.js: centre (-1.03, .27, ±.18), 18 x 280 x 155 mm, tilted -0.42 rad about Z.
  const plates = [-.18, .18].map(z => new Matrix4().makeRotationZ(-.42).setPosition(-1.03, .27, z))
  const inverse = plates.map(m => m.clone().invert())
  const meshes: InstanceType<typeof SkinnedMesh>[] = []
  rig.root.traverse(o => { if (o instanceof SkinnedMesh) meshes.push(o) })
  const seated = motion.steps.filter(s => s.pose.root!.position[1] < .7).map(s => s.pose)
  for (let f = 0; f <= 4; f++) seated.push(samplePose(motion.rep!.keys, f / 4, true))
  const v = new Vector3()
  for (const pose of seated) {
    for (const name of JOINT_NAMES) {
      const a = pose.joints[name] ?? [0, 0, 0]
      rig.joints[name].quaternion.copy(rig.rest[name]).multiply(new Quaternion().setFromEuler(new Euler(...a.map(x => x * Math.PI / 180) as [number, number, number])))
    }
    rig.joints.pelvis.position.set(...pose.root!.position)
    rig.update!()
    rig.root.updateMatrixWorld(true)
    const deepest = [Infinity, Infinity], touching = [0, 0]
    for (const mesh of meshes) {
      const pos = mesh.geometry.attributes.position
      for (let i = 0; i < pos.count; i += 2) {
        mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld)
        if (v.y > .6 || v.x < -1.3) continue
        plates.forEach((_, k) => {
          const local = v.clone().applyMatrix4(inverse[k])
          if (Math.abs(local.y) > .14 || Math.abs(local.z) > .0775) return
          const gap = -local.x - .009 // distance out of the face toward the seat
          if (gap > .05) return
          deepest[k] = Math.min(deepest[k], gap)
          if (gap < .005) touching[k]++
        })
      }
    }
    for (const k of [0, 1]) {
      expect(deepest[k]).toBeGreaterThan(-.002)
      expect(touching[k]).toBeGreaterThan(200)
    }
  }
}, 60000)


test('step focus maps hands, feet and arms onto the real skeleton', async () => {
  const { SkinnedMesh } = await import('three')
  const { focusBoneFlags } = await import('../src/viewer/step-focus')
  const rig = await humanoid()
  let skin: InstanceType<typeof SkinnedMesh> | undefined
  rig.root.traverse(o => { if (o instanceof SkinnedMesh && !o.userData.muscle) skin = o })
  const names = skin!.skeleton.bones.map(b => b.name)
  const picked = (part: 'hands' | 'feet' | 'arms') => names.filter((_, i) => focusBoneFlags(names, [part])[i] === 1)
  const hands = picked('hands')
  expect(hands).toContain('mixamorig1LeftHand')
  expect(hands).toContain('mixamorig1RightHandIndex1')
  expect(hands.length).toBeGreaterThan(20) // wrists plus every finger joint
  // Toe_End leaf bones aren't skinning bones; foot and toe base carry all the foot weights
  expect(picked('feet').sort()).toEqual(['LeftFoot', 'LeftToeBase', 'RightFoot', 'RightToeBase'].map(n => 'mixamorig1' + n).sort())
  expect(picked('arms').sort()).toEqual(['LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm'].map(n => 'mixamorig1' + n).sort())
  // the whole skin has skinning attributes for the shader to read
  expect(skin!.geometry.attributes.skinIndex).toBeDefined()
})
