import { describe, expect, test } from 'vitest'
import { DIFFICULTIES, EXERCISES } from '../src/data/exercises'
import {
  EMPTY_QUERY, PINNED_ID, activeFilterCount, applyQuery, parseQuery, resolveExercise, serializeQuery,
  type CatalogueQuery,
} from '../src/lib/catalogue'

const rank = (d: string) => DIFFICULTIES.indexOf(d as (typeof DIFFICULTIES)[number])

describe('applyQuery', () => {
  test('filters by muscle (any selected in primary)', () => {
    const r = applyQuery(EXERCISES, { ...EMPTY_QUERY, muscle: ['biceps'] })
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((e) => e.primary.includes('biceps'))).toBe(true)
  })

  test('groups combine with AND, values with OR', () => {
    const a = applyQuery(EXERCISES, { ...EMPTY_QUERY, equipment: ['cable'], pattern: ['pull'] })
    expect(a.length).toBeGreaterThan(0)
    expect(a.every((e) => e.equipment === 'cable' && e.pattern === 'pull')).toBe(true)
    const b = applyQuery(EXERCISES, { ...EMPTY_QUERY, equipment: ['cable', 'machine'] })
    expect(b.some((e) => e.equipment === 'cable')).toBe(true)
    expect(b.some((e) => e.equipment === 'machine')).toBe(true)
    expect(b.every((e) => e.equipment === 'cable' || e.equipment === 'machine')).toBe(true)
  })

  test('recommended sort', () => {
    const r = applyQuery(EXERCISES, EMPTY_QUERY)
    expect(r[0].id).toBe(PINNED_ID)
    const rest = r.slice(1)
    for (let i = 1; i < rest.length; i++) {
      const [p, c] = [rest[i - 1], rest[i]]
      expect(rank(p.difficulty)).toBeLessThanOrEqual(rank(c.difficulty))
      if (p.difficulty === c.difficulty) expect(p.name.localeCompare(c.name)).toBeLessThanOrEqual(0)
    }
  })

  test('az sort pins seated-cable-row first', () => {
    const r = applyQuery(EXERCISES, { ...EMPTY_QUERY, sort: 'az' })
    expect(r[0].id).toBe(PINNED_ID)
    const rest = r.slice(1)
    for (let i = 1; i < rest.length; i++) expect(rest[i - 1].name.localeCompare(rest[i].name)).toBeLessThanOrEqual(0)
  })

  test('easiest sort pins too', () => {
    const r = applyQuery(EXERCISES, { ...EMPTY_QUERY, sort: 'easiest' })
    expect(r[0].id).toBe(PINNED_ID)
    const rest = r.slice(1)
    for (let i = 1; i < rest.length; i++) expect(rank(rest[i - 1].difficulty)).toBeLessThanOrEqual(rank(rest[i].difficulty))
  })

  test('pinned only when it matches', () => {
    const r = applyQuery(EXERCISES, { ...EMPTY_QUERY, muscle: ['quads'] })
    expect(r.length).toBeGreaterThan(0)
    expect(r.some((e) => e.id === PINNED_ID)).toBe(false)
  })
})

describe('query string', () => {
  const q: CatalogueQuery = {
    muscle: ['chest', 'core'], equipment: ['cable'], pattern: ['push', 'pull'], difficulty: ['beginner'], sort: 'az',
  }

  test('round trip', () => {
    expect(parseQuery(serializeQuery(q))).toEqual(q)
  })

  test('serialize: empty, fixed key order, sort omitted when recommended', () => {
    expect(serializeQuery(EMPTY_QUERY)).toBe('')
    expect(serializeQuery(q)).toBe('?muscle=chest,core&equipment=cable&pattern=push,pull&difficulty=beginner&sort=az')
    expect(serializeQuery({ ...EMPTY_QUERY, muscle: ['back'] })).toBe('?muscle=back')
  })

  test('serialize uses taxonomy order and parse de-duplicates', () => {
    expect(serializeQuery({ ...EMPTY_QUERY, muscle: ['core', 'chest'] })).toBe('?muscle=chest,core')
    expect(parseQuery('?muscle=back,back,chest').muscle).toEqual(['chest', 'back'])
  })

  test('ignores junk', () => {
    expect(parseQuery('?muscle=back,nope&sort=zzz&difficulty=')).toEqual({ ...EMPTY_QUERY, muscle: ['back'] })
  })

  test('activeFilterCount counts values across the four groups', () => {
    expect(activeFilterCount(EMPTY_QUERY)).toBe(0)
    expect(activeFilterCount(q)).toBe(6)
  })
})

describe('resolveExercise', () => {
  test('built, coming-soon, not-found', () => {
    expect(resolveExercise('?id=seated-cable-row').kind).toBe('built')
    expect(resolveExercise('?id=plank').kind).toBe('coming-soon')
    for (const s of ['', '?id=', '?id=../x', '?id=Plank', '?id=plank%20']) expect(resolveExercise(s).kind).toBe('not-found')
  })
})
