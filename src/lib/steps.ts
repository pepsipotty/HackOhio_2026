export const clampStep = (i: number, count: number): number =>
  Math.min(Math.max(i, 0), count - 1)

export function stepForKey(key: string, current: number, count: number): number | null {
  const next =
    key === 'ArrowRight' || key === 'ArrowDown' ? current + 1
    : key === 'ArrowLeft' || key === 'ArrowUp' ? current - 1
    : key === 'Home' ? 0
    : key === 'End' ? count - 1
    : null
  return next === null ? null : clampStep(next, count)
}
