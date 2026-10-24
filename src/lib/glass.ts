type UAData = { brands?: { brand: string }[] }

export function applyGlassSupport(doc: Document = document): void {
  const win = doc.defaultView
  if (!win) return
  const chromium = ((win.navigator as Navigator & { userAgentData?: UAData }).userAgentData?.brands ?? []).some(
    (b) => b.brand === 'Chromium',
  )
  const ok =
    win.CSS?.supports('backdrop-filter', 'blur(1px)') &&
    chromium &&
    !win.matchMedia('(prefers-reduced-transparency: reduce)').matches
  if (ok) doc.documentElement.classList.add('glass-refract')
}
