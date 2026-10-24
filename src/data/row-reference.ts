// Visually timed from IMG_2260.MOV, repeated rows around 7–14 seconds.
// Approximate reference timing, not motion-capture measurements.
export const ROW_REFERENCE = { duration: 3500, pullEnd: .18, holdEnd: .49, returnEnd: .86, minPull: .40, maxPull: .70 }
export function referenceRowAmount(phase: number) {
  const t = ((phase % 1) + 1) % 1
  const smooth = (u: number) => u * u * (3 - 2 * u)
  if (t < ROW_REFERENCE.pullEnd) return smooth(t / ROW_REFERENCE.pullEnd)
  if (t < ROW_REFERENCE.holdEnd) return 1
  if (t < ROW_REFERENCE.returnEnd) return 1 - smooth((t - ROW_REFERENCE.holdEnd) / (ROW_REFERENCE.returnEnd - ROW_REFERENCE.holdEnd))
  return 0
}
