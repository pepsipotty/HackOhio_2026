import { describe, expect, test } from 'vitest'
import { Euler, MeshBasicMaterial, Quaternion, Vector3 } from 'three'
import { FOCUS_PARTS, getMotion } from '../src/data/motion'
import { JOINT_NAMES, type JointName } from '../src/data/joints'
import { buildMannequin } from '../src/viewer/rig'

describe('seated cable row motion', () => {
  test('has the seven steps in order', async () => {
    const m = await getMotion('seated-cable-row')
    expect(m?.steps.map((s) => s.id)).toEqual([
      'setup', 'seat-and-feet', 'grip', 'spine-position', 'the-pull', 'the-squeeze', 'controlled-return',
    ])
  })

  test('every step is complete and uses known cameras and joints', async () => {
    const m = (await getMotion('seated-cable-row'))!
    for (const s of m.steps) {
      expect(m.cameras).toHaveProperty(s.camera)
      for (const j of Object.keys(s.pose.joints)) expect(JOINT_NAMES).toContain(j)
      expect(s.title).not.toBe('')
      expect(s.instruction).not.toBe('')
      expect(s.mistake).not.toBe('')
      expect(s.cues.length).toBeGreaterThan(0)
      // every step points at what it changes
      expect(s.focus?.parts.length, s.id).toBeGreaterThan(0)
      for (const p of s.focus!.parts) expect(FOCUS_PARTS).toContain(p)
      if (s.enter) {
        expect(s.focus!.start ?? 0, s.id).toBeGreaterThanOrEqual(0)
        expect(s.focus!.start ?? 0, s.id).toBeLessThan(s.enter.duration)
      } else expect(s.focus!.duration, s.id).toBeGreaterThan(0)
    }
  })

  test('rep keys ascend from 0 to 1', async () => {
    const ts = (await getMotion('seated-cable-row'))!.rep!.keys.map((k) => k.t)
    expect(ts[0]).toBe(0)
    expect(ts.at(-1)).toBe(1)
    for (let i = 1; i < ts.length; i++) expect(ts[i]).toBeGreaterThan(ts[i - 1])
  })

  test('unknown exercise has no motion', async () => {
    expect(await getMotion('plank')).toBeUndefined()
  })
})

describe('mannequin rig', () => {
  test('has every joint with the pelvis at 1 m', () => {
    const rig = buildMannequin(new MeshBasicMaterial())
    expect(Object.keys(rig.joints).sort()).toEqual([...JOINT_NAMES].sort())
    expect(Object.keys(rig.rest).sort()).toEqual([...JOINT_NAMES].sort())
    rig.root.updateMatrixWorld(true)
    expect(rig.joints.pelvis.getWorldPosition(new Vector3()).y).toBeCloseTo(1.0)
    expect(rig.placeholder).toBe(true)
  })

  test('positive X flexes on both sides', () => {
    // Applied the way the viewer does it: rest × euler.
    const rig = buildMannequin(new MeshBasicMaterial())
    const flex = (j: JointName, deg: number) =>
      rig.joints[j].quaternion.copy(rig.rest[j]).multiply(new Quaternion().setFromEuler(new Euler((deg * Math.PI) / 180, 0, 0)))
    const at = (j: JointName) => rig.joints[j].getWorldPosition(new Vector3())
    flex('spine', 30)
    for (const s of ['L', 'R'] as const) {
      flex(`shoulder_${s}`, 90)
      flex(`hip_${s}`, 90)
      flex(`knee_${s}`, 90)
    }
    rig.root.updateMatrixWorld(true)
    expect(at('neck').z).toBeGreaterThan(at('spine').z + 0.1) // spine leans forward
    for (const s of ['L', 'R'] as const) {
      expect(at(`knee_${s}`).z - at(`hip_${s}`).z).toBeGreaterThan(0.4) // thigh lifted forward
      expect(at(`ankle_${s}`).y).toBeLessThan(at(`knee_${s}`).y - 0.4) // knee bent: shin hangs down
      expect(at(`wrist_${s}`).z).toBeGreaterThan(at(`elbow_${s}`).z) // arm raised forward
    }
    // Elbow flexion from arms-at-sides brings the hand forward.
    const rig2 = buildMannequin(new MeshBasicMaterial())
    for (const s of ['L', 'R'] as const) {
      rig2.joints[`elbow_${s}`].quaternion.copy(rig2.rest[`elbow_${s}`]).multiply(new Quaternion().setFromEuler(new Euler(Math.PI / 2, 0, 0)))
    }
    rig2.root.updateMatrixWorld(true)
    for (const s of ['L', 'R'] as const) {
      const el = rig2.joints[`elbow_${s}`].getWorldPosition(new Vector3())
      expect(rig2.joints[`wrist_${s}`].getWorldPosition(new Vector3()).z - el.z).toBeGreaterThan(0.25)
    }
  })
})
