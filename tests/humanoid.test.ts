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
  // a clear hip hinge, from sitting tall (just off vertical) to leaning slightly back at the squeeze
  expect(Math.max(...hips) - Math.min(...hips)).toBeGreaterThan(20)
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

test('seated well back: thighs rest along the pad, knees softly bent and over the feet, legs clear of the pad', async () => {
  const { SkinnedMesh } = await import('three')
  const { samplePose } = await import('../src/lib/tween')
  const rig = await humanoid(), motion = (await getMotion('seated-cable-row'))!
  rig.root.position.set(-1.85, .09, 0)
  rig.root.rotation.y = Math.PI / 2
  const meshes: InstanceType<typeof SkinnedMesh>[] = []
  rig.root.traverse(o => { if (o instanceof SkinnedMesh) meshes.push(o) })
  // Row bench pad from CableStackApparatus.js: centre (-1.80, .45, 0), 1.02 x .065 x .29 m.
  const PAD = { x0: -2.31, x1: -1.29, top: .4825, bottom: .4175, half: .145 }
  const poses = ['spine-position', 'the-squeeze'].map(id => motion.steps.find(s => s.id === id)!.pose)
  poses.push(samplePose(motion.rep!.keys, .75, true))
  const v = new Vector3()
  for (const pose of poses) {
    for (const name of JOINT_NAMES) {
      const a = pose.joints[name] ?? [0, 0, 0]
      rig.joints[name].quaternion.copy(rig.rest[name]).multiply(new Quaternion().setFromEuler(new Euler(...a.map(x => x * Math.PI / 180) as [number, number, number])))
    }
    rig.joints.pelvis.position.set(...pose.root!.position)
    rig.update!()
    rig.root.updateMatrixWorld(true)
    const at = (n: typeof JOINT_NAMES[number]) => rig.joints[n].getWorldPosition(new Vector3())
    const hip = at('hip_L'), knee = at('knee_L'), ankle = at('ankle_L')
    // Station +X is the figure's forward; station -Z is the figure's left.
    expect(hip.x - -1.85, 'pelvis well back from the old forward seat').toBeLessThan(0)
    const flex = knee.clone().sub(hip).angleTo(ankle.clone().sub(knee)) * 180 / Math.PI
    expect(flex).toBeGreaterThan(30)
    expect(flex).toBeLessThan(55)
    expect(-knee.z, 'knee tracks over the foot, not inside it').toBeGreaterThanOrEqual(-ankle.z - .005)
    // Lowest skin over the pad along the left thigh, in five bins from hip to knee.
    const bins = Array(5).fill(Infinity)
    let shins = 0
    for (const mesh of meshes) {
      const pos = mesh.geometry.attributes.position
      for (let i = 0; i < pos.count; i += 2) {
        mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld)
        if (v.x < PAD.x0 || v.x > PAD.x1 || Math.abs(v.z) > PAD.half) continue
        if (v.x > knee.x - .06 && v.y < PAD.top && v.y > PAD.bottom) shins++
        if (v.z < 0 && v.y < .7) {
          const b = Math.floor((v.x - hip.x) / (knee.x - hip.x) * 5)
          if (b >= 0 && b < 5) bins[b] = Math.min(bins[b], v.y - PAD.top)
        }
      }
    }
    expect(shins, 'knees and shins pass clear of the pad').toBe(0)
    // Resting on it: neither sunk in more than soft tissue would give, nor floating, over most of the thigh.
    for (const gap of bins.slice(0, 4)) {
      expect(gap).toBeGreaterThan(-.02)
      expect(gap).toBeLessThan(.015)
    }
  }
}, 60000)


// Bone capsules: closest distance between two segments.
function segmentDistance(p1: Vector3, q1: Vector3, p2: Vector3, q2: Vector3) {
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2)
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r), c = d1.dot(r), b = d1.dot(d2)
  const den = a * e - b * b
  let s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0
  let t = (b * s + f) / e
  if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)) } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)) }
  return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, t))
}

test('reaching for the handle, the arms pass between the parted knees and over the end of the pad, not through them', async () => {
  const { Object3D, SkinnedMesh } = await import('three')
  const { buildClip } = await import('../src/lib/clip')
  const { createRowGrip, orientRowHandle } = await import('../src/viewer/row-grip')
  const { HANDLE_REST } = await import('../src/data/row-station')
  const rig = await humanoid(), motion = (await getMotion('seated-cable-row'))!
  rig.root.position.set(-1.85, .09, 0)
  rig.root.rotation.y = Math.PI / 2
  const grip = createRowGrip(rig)
  const i = motion.steps.findIndex(s => s.id === 'grip')
  const clip = buildClip(motion.steps[i - 1].pose, motion.steps[i].enter!, motion.steps[i].pose)
  // The handle as cable-row-composite.ts places it: on the bar until carried, then where the hands hold it.
  const exit = new Vector3(-.88, .56, 0), rest = new Vector3(...HANDLE_REST), handle = new Object3D()
  const smooth = (u: number) => u * u * (3 - 2 * u), clamp01 = (u: number) => Math.min(1, Math.max(0, u))
  const seatZ = motion.steps[i].pose.root!.position[2]
  // Skin that follows the forearms and hands, checked against the bench pad.
  const arms: { mesh: InstanceType<typeof SkinnedMesh>; vertices: number[] }[] = []
  rig.root.traverse(o => {
    if (!(o instanceof SkinnedMesh)) return
    const index = o.geometry.attributes.skinIndex, weight = o.geometry.attributes.skinWeight, vertices: number[] = []
    for (let k = 0; k < index.count; k++) {
      let best = 0, bone = 0
      for (let c = 0; c < 4; c++) if (weight.getComponent(k, c) > best) { best = weight.getComponent(k, c); bone = index.getComponent(k, c) }
      if (/Hand|ForeArm/.test(o.skeleton.bones[bone]?.name ?? '')) vertices.push(k)
    }
    arms.push({ mesh: o, vertices })
  })
  const v = new Vector3()
  for (let time = 0; time <= clip.duration; time += 100) {
    const pose = clip.sample(time)
    expect(pose.root!.position[2], 'stays on the seat').toBeCloseTo(seatZ, 6)
    grip.restore()
    for (const name of JOINT_NAMES) {
      const a = pose.joints[name] ?? [0, 0, 0]
      rig.joints[name].quaternion.copy(rig.rest[name]).multiply(new Quaternion().setFromEuler(new Euler(...a.map(x => x * Math.PI / 180) as [number, number, number])))
    }
    rig.joints.pelvis.position.set(...pose.root!.position)
    rig.update!()
    const at = (n: typeof JOINT_NAMES[number]) => rig.joints[n].getWorldPosition(new Vector3())
    const hold = pose.handle!
    const hands = at('wrist_L').add(at('wrist_R')).multiplyScalar(.5)
    hands.addScaledVector(hands.clone().sub(exit).normalize(), -.19).y += .04
    const lift = smooth(clamp01(hold.carry))
    handle.position.copy(rest).lerp(hands, lift)
    orientRowHandle(handle, new Vector3(-1, 0, 0))
    const resting = handle.quaternion.clone()
    orientRowHandle(handle, handle.position.clone().sub(exit))
    handle.quaternion.slerpQuaternions(resting, handle.quaternion.clone(), lift)
    handle.updateWorldMatrix(true, true)
    if (hold.left > 0 || hold.right > 0) grip.solve(handle, 1, [clamp01(hold.left), clamp01(hold.right)])
    const legs = (['L', 'R'] as const).flatMap(s => [[at(`hip_${s}`), at(`knee_${s}`), .07], [at(`knee_${s}`), at(`ankle_${s}`), .05]] as const)
    for (const s of ['L', 'R'] as const) {
      const shoulder = at(`shoulder_${s}`), elbow = at(`elbow_${s}`), wrist = at(`wrist_${s}`)
      const fingers = wrist.clone().addScaledVector(wrist.clone().sub(elbow).normalize(), .09)
      for (const [a, b, r] of [[shoulder, elbow, .045], [elbow, wrist, .037], [wrist, fingers, .03]] as const)
        for (const [c, d, r2] of legs) expect(segmentDistance(a, b, c, d) - r - r2, `${time} ms, ${s} arm`).toBeGreaterThan(-.015)
    }
    rig.root.updateMatrixWorld(true)
    let deepest = 0
    for (const { mesh, vertices } of arms) for (const k of vertices) {
      mesh.getVertexPosition(k, v).applyMatrix4(mesh.matrixWorld)
      // Row bench pad: station x -2.31..-1.29, y .4175..4825, z ±.145.
      if (v.x < -2.31 || v.x > -1.29 || Math.abs(v.z) > .145 || v.y > .4825 || v.y < .4175) continue
      deepest = Math.max(deepest, Math.min(.4825 - v.y, .145 - Math.abs(v.z), -1.29 - v.x))
    }
    expect(deepest, `${time} ms, hands into the pad`).toBeLessThan(.005)
  }
}, 60000)

test('stepping over the bench, the legs clear the pad', async () => {
  const { SkinnedMesh } = await import('three')
  const { buildClip } = await import('../src/lib/clip')
  const rig = await humanoid(), motion = (await getMotion('seated-cable-row'))!
  rig.root.position.set(-1.85, 0, 0)
  rig.root.rotation.y = Math.PI / 2
  const meshes: InstanceType<typeof SkinnedMesh>[] = []
  rig.root.traverse(o => { if (o instanceof SkinnedMesh) meshes.push(o) })
  const i = motion.steps.findIndex(s => s.id === 'seat-and-feet')
  const clip = buildClip(motion.steps[i - 1].pose, motion.steps[i].enter!, motion.steps[i].pose)
  const v = new Vector3()
  // From swinging the right leg up until both feet are down astride the bench, before he sits.
  for (let time = 2700; time <= 4700; time += 50) {
    const pose = clip.sample(time)
    for (const name of JOINT_NAMES) {
      const a = pose.joints[name] ?? [0, 0, 0]
      rig.joints[name].quaternion.copy(rig.rest[name]).multiply(new Quaternion().setFromEuler(new Euler(...a.map(x => x * Math.PI / 180) as [number, number, number])))
    }
    rig.joints.pelvis.position.set(...pose.root!.position)
    rig.root.position.y = .09 * Math.min(1, Math.max(0, (1 - pose.root!.position[1]) / .3)) // as the composite lifts it
    rig.setFeet?.(pose.feet ?? null)
    rig.update!()
    rig.root.updateMatrixWorld(true)
    let deepest = 0
    for (const mesh of meshes) {
      const pos = mesh.geometry.attributes.position
      for (let k = 0; k < pos.count; k += 2) {
        mesh.getVertexPosition(k, v).applyMatrix4(mesh.matrixWorld)
        // Row bench pad: station x -2.31..-1.29, y .4175..4825, z ±.145.
        if (v.x < -2.31 || v.x > -1.29 || Math.abs(v.z) > .145 || v.y > .4825 || v.y < .4175) continue
        deepest = Math.max(deepest, Math.min(.4825 - v.y, .145 - Math.abs(v.z)))
      }
    }
    expect(deepest, `${time} ms`).toBeLessThan(.005)
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
