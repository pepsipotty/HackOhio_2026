import { expect, test } from 'vitest'
import { ROW_REFERENCE as ref, referenceRowAmount } from '../src/data/row-reference'
import motion from '../src/data/poses/seated-cable-row'
import { samplePose } from '../src/lib/tween'

test('reference rhythm has a quick pull, held contraction, longer return and seamless loop', () => {
  expect(ref.returnEnd - ref.holdEnd).toBeGreaterThan(ref.pullEnd)
  expect(referenceRowAmount(0)).toBe(0)
  expect(referenceRowAmount(1)).toBe(0)
  expect(referenceRowAmount(.3)).toBe(1)
  expect(referenceRowAmount(.95)).toBe(0)
  expect(samplePose(motion.rep!.keys, 0, true)).toEqual(samplePose(motion.rep!.keys, 1, true))
  expect(samplePose(motion.rep!.keys, .25, true)).toEqual(samplePose(motion.rep!.keys, .4, true))
  for (let t = 0; t <= 1; t += .01) {
    expect(referenceRowAmount(t)).toBeGreaterThanOrEqual(0)
    expect(referenceRowAmount(t)).toBeLessThanOrEqual(1)
  }
})
