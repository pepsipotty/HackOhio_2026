import { describe, expect, test } from 'vitest'
import { clampStep, stepForKey } from '../src/lib/steps'

describe('steps', () => {
  test('clampStep', () => {
    expect(clampStep(-1, 7)).toBe(0)
    expect(clampStep(9, 7)).toBe(6)
    expect(clampStep(3, 7)).toBe(3)
  })

  test('stepForKey', () => {
    expect(stepForKey('ArrowRight', 6, 7)).toBe(6)
    expect(stepForKey('ArrowDown', 2, 7)).toBe(3)
    expect(stepForKey('ArrowLeft', 0, 7)).toBe(0)
    expect(stepForKey('ArrowUp', 4, 7)).toBe(3)
    expect(stepForKey('Home', 5, 7)).toBe(0)
    expect(stepForKey('End', 0, 7)).toBe(6)
    expect(stepForKey('a', 3, 7)).toBeNull()
  })
})
