import { describe, expect, test } from 'vitest'
import { DIFFICULTIES, EQUIPMENT, EXERCISES, MUSCLES, PATTERNS } from '../src/data/exercises'
import { JOINT_NAMES, JOINT_PARENT } from '../src/data/joints'
import { DEMO_POSTER, DEMO_VIDEO, MODEL_URL, gifSrc } from '../src/data/media'

describe('exercise catalogue', () => {
  test('has 32 exercises with unique kebab ids', () => {
    expect(EXERCISES.length).toBe(32)
    const ids = EXERCISES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/))
  })

  test('every taxonomy value is valid and used', () => {
    for (const e of EXERCISES) {
      expect(EQUIPMENT).toContain(e.equipment)
      expect(PATTERNS).toContain(e.pattern)
      expect(DIFFICULTIES).toContain(e.difficulty)
      expect(e.primary.length).toBeGreaterThan(0)
      ;[...e.primary, ...e.secondary].forEach((m) => expect(MUSCLES).toContain(m))
    }
    EQUIPMENT.forEach((v) => expect(EXERCISES.some((e) => e.equipment === v)).toBe(true))
    PATTERNS.forEach((v) => expect(EXERCISES.some((e) => e.pattern === v)).toBe(true))
    DIFFICULTIES.forEach((v) => expect(EXERCISES.some((e) => e.difficulty === v)).toBe(true))
    MUSCLES.forEach((v) => expect(EXERCISES.some((e) => e.primary.includes(v))).toBe(true))
  })

  test('exactly one built exercise: seated-cable-row, listed first', () => {
    expect(EXERCISES.filter((e) => e.built).map((e) => e.id)).toEqual(['seated-cable-row'])
    expect(EXERCISES[0].id).toBe('seated-cable-row')
  })

  test('every exercise has works and why copy of at most 160 chars', () => {
    for (const e of EXERCISES) {
      for (const s of [e.works, e.why]) {
        expect(s.trim().length).toBeGreaterThan(0)
        expect(s.length).toBeLessThanOrEqual(160)
      }
    }
  })
})

describe('joints', () => {
  test('hierarchy is rooted at pelvis', () => {
    expect(JOINT_NAMES).toHaveLength(17)
    expect(JOINT_PARENT.pelvis).toBeNull()
    JOINT_NAMES.filter((j) => j !== 'pelvis').forEach((j) => expect(JOINT_NAMES).toContain(JOINT_PARENT[j]))
  })
})

describe('media', () => {
  test('urls are built from BASE_URL', () => {
    expect(gifSrc('plank')).toMatch(/media\/gifs\/plank\.gif$/)
    expect(DEMO_VIDEO).toMatch(/media\/video\/demo\.mp4$/)
    expect(DEMO_POSTER).toMatch(/media\/video\/demo-poster\.jpg$/)
    expect(MODEL_URL).toMatch(/models\/human\.glb$/)
  })
})
