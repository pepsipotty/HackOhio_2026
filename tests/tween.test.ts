import { describe, expect, test } from 'vitest'
import { EASE, Tween, samplePose } from '../src/lib/tween'
import type { Pose } from '../src/data/motion'

describe('EASE', () => {
  test('endpoints', () => {
    for (const f of Object.values(EASE)) {
      expect(f(0)).toBe(0)
      expect(f(1)).toBe(1)
    }
    expect(EASE.easeInOut(0.5)).toBeCloseTo(0.5)
  })
})

describe('Tween', () => {
  test('interpolates', () => {
    const t = new Tween([0], [10], 1000, 'linear', 0)
    expect(t.value(500)).toEqual([5])
    expect(t.value(2000)).toEqual([10])
    expect(t.done(1000)).toBe(true)
    expect(t.done(999)).toBe(false)
  })

  test('duration 0 returns target', () => {
    expect(new Tween([0], [10], 0, 'linear', 0).value(0)).toEqual([10])
  })

  test('retarget mid-way does not snap', () => {
    const t = new Tween([0], [10], 1000, 'linear', 0)
    t.retarget([0], 500, 1000, 'linear')
    expect(t.value(500)).toEqual([5])
    expect(t.value(1000)).toEqual([2.5])
    expect(t.value(1500)).toEqual([0])
  })
})

describe('samplePose', () => {
  const keys: { t: number; pose: Pose }[] = [
    { t: 0, pose: { root: { position: [0, 0, 0] }, joints: { spine: [0, 0, 0], elbow_L: [10, 0, 0] } } },
    { t: 0.5, pose: { root: { position: [2, 4, 6] }, joints: { spine: [20, 0, 0] } } },
    { t: 1, pose: { root: { position: [0, 0, 0] }, joints: { spine: [40, 0, 0] } } },
  ]

  test('clamps to endpoints', () => {
    expect(samplePose(keys, -1)).toEqual(keys[0].pose)
    expect(samplePose(keys, 2)).toEqual(keys[2].pose)
  })

  test('midpoint of first two keys; missing joint is zero', () => {
    const p = samplePose(keys, 0.25)
    expect(p.joints.spine).toEqual([10, 0, 0])
    expect(p.joints.elbow_L).toEqual([5, 0, 0])
    expect(p.root?.position).toEqual([1, 2, 3])
  })

  test('root.position taken from whichever key has it', () => {
    const keys = [{ t: 0, pose: { joints: {} } }, { t: 1, pose: { root: { position: [2, 4, 6] as [number, number, number] }, joints: {} } }]
    expect(samplePose(keys, 0.5).root?.position).toEqual([2, 4, 6])
  })
})
