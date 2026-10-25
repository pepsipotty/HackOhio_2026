import { describe, expect, test } from 'vitest'
import { getMotion } from '../src/data/motion'
import { JOINT_NAMES } from '../src/data/joints'
import { buildClip, mixPose } from '../src/lib/clip'
import type { Pose } from '../src/data/motion'

const close = (a: Pose, b: Pose) => {
  for (const j of JOINT_NAMES) (a.joints[j] ?? [0, 0, 0]).forEach((v, i) => expect(v, j).toBeCloseTo((b.joints[j] ?? [0, 0, 0])[i], 6))
  a.root!.position.forEach((v, i) => expect(v).toBeCloseTo(b.root!.position[i], 6))
}

describe('step transitions', () => {
  test('every step after the first moves in from the previous one, with keys inside its duration', async () => {
    const m = (await getMotion('seated-cable-row'))!
    for (const [i, s] of m.steps.entries()) {
      if (i === 0) { expect(s.enter).toBeUndefined(); continue }
      expect(s.enter, s.id).toBeDefined()
      for (const k of s.enter!.keys) {
        expect(k.at, s.id).toBeGreaterThan(0)
        expect(k.at, s.id).toBeLessThan(s.enter!.duration)
        for (const j of Object.keys(k.pose.joints ?? {})) expect(JOINT_NAMES).toContain(j)
      }
      if (s.enter!.camera) expect(s.enter!.camera.until).toBeLessThan(s.enter!.duration)
    }
  })

  test('a clip starts exactly at the previous pose and ends exactly at the step pose', async () => {
    const m = (await getMotion('seated-cable-row'))!
    for (const [i, s] of m.steps.entries()) {
      if (!s.enter) continue
      const clip = buildClip(m.steps[i - 1].pose, s.enter, s.pose)
      close(clip.sample(0), m.steps[i - 1].pose)
      close(clip.sample(clip.duration), s.pose)
      expect(clip.sample(clip.duration).scapula ?? 0).toBeCloseTo(s.pose.scapula ?? 0)
    }
  })

  test('holds stay still, nothing overshoots its keys, and velocity is continuous', () => {
    const a: Pose = { root: { position: [0, 1, 0] }, joints: { elbow_L: [0, 0, 0] } }
    const b: Pose = { root: { position: [0, 1, 0] }, joints: { elbow_L: [90, 0, 0] } }
    const clip = buildClip(a, { duration: 3000, keys: [{ at: 1000, pose: { joints: { elbow_L: [90, 0, 0] } } }, { at: 2000, pose: { joints: { elbow_L: [90, 0, 0] } } }] }, b)
    const x = (t: number) => clip.sample(t).joints.elbow_L![0]
    for (let t = 1000; t <= 3000; t += 50) expect(x(t)).toBeCloseTo(90, 9) // held from 1 s on
    for (let t = 0; t < 1000; t += 10) expect(x(t + 10)).toBeGreaterThanOrEqual(x(t)) // monotone, no overshoot
    expect(x(1) - x(0)).toBeLessThan(0.01) // eases out of rest
    const v = (t: number) => (x(t + 1) - x(t - 1)) / 2
    expect(Math.abs(v(500) - (x(501) - x(500)))).toBeLessThan(0.01)
  })

  test('the walk keeps a planted foot exactly still while the other swings', async () => {
    const m = (await getMotion('seated-cable-row'))!
    const i = m.steps.findIndex((s) => s.id === 'seat-and-feet')
    const clip = buildClip(m.steps[i - 1].pose, m.steps[i].enter!, m.steps[i].pose)
    // the left foot is planted while the right takes its first step (0.2 s – 0.74 s)
    const left = clip.sample(200).feet!.L
    for (let t = 200; t <= 740; t += 20) clip.sample(t).feet!.L.forEach((v, j) => expect(v).toBeCloseTo(left[j], 9))
    // the right foot swings clear of the floor in between
    expect(clip.sample(560).feet!.R[1]).toBeGreaterThan(0.15)
  })

  test('mixPose eases between two poses and keeps a default it has no value for', () => {
    const a: Pose = { root: { position: [0, 1, 0] }, joints: { spine: [10, 0, 0] } }
    const b: Pose = { root: { position: [0, .5, 0] }, joints: { spine: [30, 0, 0] }, handle: { carry: 1, left: 1, right: 1 } }
    const mid = mixPose(a, b, .5)
    expect(mid.joints.spine![0]).toBeCloseTo(20)
    expect(mid.root!.position[1]).toBeCloseTo(.75)
    expect(mid.handle).toEqual(b.handle)
  })
})
