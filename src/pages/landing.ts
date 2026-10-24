import { applyGlassSupport } from '../lib/glass'
import { isCoarsePointer, isLowPower, prefersReducedMotion } from '../lib/motion-prefs'
import { DEMO_POSTER, DEMO_VIDEO } from '../data/media'

applyGlassSupport()
const reduced = prefersReducedMotion()

// ---------- Demo video ----------
const demo = document.querySelector<HTMLElement>('.demo')!
const video = demo.querySelector<HTMLVideoElement>('.demo__video')!
const toggle = demo.querySelector<HTMLButtonElement>('.demo__toggle')!
const placeholder = demo.querySelector<HTMLElement>('.demo__placeholder')!

const showPlaceholder = (): void => {
  placeholder.hidden = false
  video.hidden = true
  toggle.hidden = true
}
const syncToggle = (): void => {
  toggle.textContent = video.paused ? 'Play demo' : 'Pause demo'
  demo.toggleAttribute('data-playing', !video.paused)
}

// The source is added from script so its error listener exists before the request can fail.
const source = document.createElement('source')
source.type = 'video/mp4'
source.src = DEMO_VIDEO
source.addEventListener('error', showPlaceholder)
video.addEventListener('error', showPlaceholder)
video.addEventListener('play', syncToggle)
video.addEventListener('pause', syncToggle)
// The toggle doubles as the pause control autoplaying video needs (WCAG 2.2.2).
video.addEventListener('loadedmetadata', () => { if (placeholder.hidden) toggle.hidden = false })
toggle.addEventListener('click', () => {
  if (video.paused) video.play().catch(() => {})
  else video.pause()
})
video.poster = DEMO_POSTER
video.append(source)
if (!reduced) video.play().catch(() => {})

// ---------- Parallax ----------
// [scroll rate, pointer travel px] for far, mid, near
const RATES: [number, number][] = [[0.15, 6], [0.35, 14], [0.6, 24]]

if (!reduced && !isCoarsePointer()) {
  const layers = [...document.querySelectorAll<SVGElement>('.parallax .layer')]
  const useScroll = !isLowPower()
  let px = 0
  let py = 0
  let drawn = ''
  let raf = 0

  const tick = (): void => {
    const y = useScroll ? scrollY : 0
    const key = `${y}|${px}|${py}`
    if (key === drawn) { raf = 0; return } // nothing changed for a frame: stop
    drawn = key
    layers.forEach((layer, i) => {
      const [rate, travel] = RATES[i]
      // The backdrop scrolls with the page, so pushing it down by (1 - rate) leaves it moving at `rate`.
      layer.style.transform = `translate3d(${(-px * travel).toFixed(2)}px, ${(y * (1 - rate) - py * travel).toFixed(2)}px, 0)`
    })
    raf = requestAnimationFrame(tick)
  }
  const wake = (): void => { raf ||= requestAnimationFrame(tick) }

  addEventListener('pointermove', (e) => {
    px = (e.clientX / innerWidth) * 2 - 1
    py = (e.clientY / innerHeight) * 2 - 1
    wake()
  }, { passive: true })
  if (useScroll) addEventListener('scroll', wake, { passive: true })
  wake()
}
