import {
  DIFFICULTIES, EQUIPMENT, EXERCISES, MUSCLES, PATTERNS,
  type Difficulty, type Equipment, type Exercise, type Muscle, type Pattern,
} from '../data/exercises'

export type SortKey = 'recommended' | 'az' | 'easiest'
export interface CatalogueQuery {
  muscle: Muscle[]
  equipment: Equipment[]
  pattern: Pattern[]
  difficulty: Difficulty[]
  sort: SortKey
}

export const PINNED_ID = 'seated-cable-row'
export const EMPTY_QUERY: CatalogueQuery = { muscle: [], equipment: [], pattern: [], difficulty: [], sort: 'recommended' }

const GROUPS = [
  ['muscle', MUSCLES],
  ['equipment', EQUIPMENT],
  ['pattern', PATTERNS],
  ['difficulty', DIFFICULTIES],
] as const

export function parseQuery(search: string): CatalogueQuery {
  const params = new URLSearchParams(search)
  const q: CatalogueQuery = { ...EMPTY_QUERY }
  for (const [key, allowed] of GROUPS) {
    const picked = new Set((params.get(key) ?? '').split(','))
    // taxonomy order + membership check drops junk and duplicates in one pass
    ;(q[key] as string[]) = allowed.filter((v) => picked.has(v))
  }
  const sort = params.get('sort')
  if (sort === 'az' || sort === 'easiest') q.sort = sort
  return q
}

export function serializeQuery(q: CatalogueQuery): string {
  const parts: string[] = []
  for (const [key, allowed] of GROUPS) {
    const picked = new Set<string>(q[key])
    const ordered = allowed.filter((v) => picked.has(v))
    if (ordered.length) parts.push(`${key}=${ordered.join(',')}`)
  }
  if (q.sort !== 'recommended') parts.push(`sort=${q.sort}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

const byName = (a: Exercise, b: Exercise) => a.name.localeCompare(b.name)
const byDifficulty = (a: Exercise, b: Exercise) =>
  DIFFICULTIES.indexOf(a.difficulty) - DIFFICULTIES.indexOf(b.difficulty)

export function applyQuery(list: readonly Exercise[], q: CatalogueQuery): Exercise[] {
  const out = list.filter(
    (e) =>
      (!q.muscle.length || e.primary.some((m) => q.muscle.includes(m))) &&
      (!q.equipment.length || q.equipment.includes(e.equipment)) &&
      (!q.pattern.length || q.pattern.includes(e.pattern)) &&
      (!q.difficulty.length || q.difficulty.includes(e.difficulty)),
  )
  // 'recommended' and 'easiest' share a comparator: easiest first, A-Z within a level
  out.sort(q.sort === 'az' ? byName : (a, b) => byDifficulty(a, b) || byName(a, b))
  // pin = stable partition after sorting, not part of the comparator
  return [...out.filter((e) => e.id === PINNED_ID), ...out.filter((e) => e.id !== PINNED_ID)]
}

export function activeFilterCount(q: CatalogueQuery): number {
  return q.muscle.length + q.equipment.length + q.pattern.length + q.difficulty.length
}

export type Resolved = { kind: 'built' | 'coming-soon'; exercise: Exercise } | { kind: 'not-found' }

export function resolveExercise(search: string, list: readonly Exercise[] = EXERCISES): Resolved {
  const id = new URLSearchParams(search).get('id')
  const exercise = id ? list.find((e) => e.id === id) : undefined
  return exercise ? { kind: exercise.built ? 'built' : 'coming-soon', exercise } : { kind: 'not-found' }
}
