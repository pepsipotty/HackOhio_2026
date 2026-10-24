import '../styles/tokens.css'
import '../styles/base.css'
import '../styles/glass.css'
import '../styles/transitions.css'
import '../styles/exercise.css'
import { applyGlassSupport } from '../lib/glass'
import { prefersReducedMotion } from '../lib/motion-prefs'
import { resolveExercise } from '../lib/catalogue'
import { clampStep, stepForKey } from '../lib/steps'
import { EXERCISES, type Exercise } from '../data/exercises'
import { getMotion, type ExerciseMotion, type View } from '../data/motion'

applyGlassSupport()

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T
const pad = (n: number) => String(n).padStart(2, '0')
const no = (e: Exercise) => `No. ${pad(EXERCISES.indexOf(e) + 1)}`

function show(view: string): HTMLElement {
  for (const el of document.querySelectorAll<HTMLElement>('[data-view]')) el.hidden = el.dataset.view !== view
  return $(`[data-view="${view}"]`)
}

function comingSoon(e: Exercise): void {
  const root = show('coming-soon')
  $('.soon__no', root).textContent = no(e)
  $('.soon__name', root).textContent = e.name
  $('.soon__works', root).textContent = e.works
  $('.soon__why', root).textContent = `Why start here: ${e.why}`
}

function built(e: Exercise, motion: ExerciseMotion): void {
  const root = show('built')
  const reduced = prefersReducedMotion()
  const steps = motion.steps
  const n = steps.length
  let cur = 0
  let view: View = steps[0].camera
  let viewer: { goTo(i: number): void } | null = null
  const visited = new Set<number>()

  $('.panel__no', root).textContent = `${no(e)} · ${e.name}`
  $('.panel__name', root).textContent = e.name

  const canvas = $('.viewport-canvas', root)
  const msg = $('.viewport-msg', root)
  const row = $<HTMLOListElement>('.step-row', root)
  const panel = $('#step-panel', root)
  const numEl = $('.step__num', root)
  const prev = $<HTMLButtonElement>('[data-prev]', root)
  const next = $<HTMLButtonElement>('[data-next]', root)
  const done = $<HTMLAnchorElement>('[data-done]', root)

  const tabs = steps.map((s, k) => {
    const li = document.createElement('li')
    li.setAttribute('role', 'presentation')
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'key'
    b.id = `step-tab-${k + 1}`
    b.setAttribute('role', 'tab')
    b.setAttribute('aria-controls', 'step-panel')
    b.setAttribute('aria-label', `Step ${k + 1}: ${s.title}`)
    b.textContent = String(k + 1)
    b.addEventListener('click', () => goTo(k))
    li.append(b)
    row.append(li)
    return b
  })

  const labelCanvas = () => {
    canvas.setAttribute('aria-label', `Model showing step ${cur + 1}: ${steps[cur].title}, ${view} view`)
  }

  function swapNumeral(text: string): void {
    const fresh = document.createElement('span')
    fresh.textContent = text
    const old = numEl.querySelectorAll('span:not([data-leaving])')
    numEl.append(fresh)
    if (reduced || !old.length) return old.forEach((o) => o.remove())
    const opts = { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' }
    for (const o of old) {
      ;(o as HTMLElement).dataset.leaving = ''
      o.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-24px)', opacity: 0 }], opts).finished
        .then(() => o.remove(), () => o.remove())
    }
    fresh.animate([{ transform: 'translateY(24px)', opacity: 0 }, { transform: 'none', opacity: 1 }], opts)
  }

  function goTo(i: number): void {
    cur = clampStep(i, n)
    const s = steps[cur]
    visited.add(cur)
    view = s.camera
    tabs.forEach((t, k) => {
      const on = k === cur
      t.setAttribute('aria-selected', String(on))
      t.tabIndex = on ? 0 : -1
      t.classList.toggle('is-visited', visited.has(k))
    })
    panel.setAttribute('aria-labelledby', tabs[cur].id)
    swapNumeral(pad(cur + 1))
    $('.step__of', panel).textContent = `Step ${cur + 1} of ${n}`
    $('.step__title', panel).textContent = s.title
    $('.step__instruction', panel).textContent = s.instruction
    $('.mistake__text', panel).textContent = s.mistake
    $('.cues', panel).replaceChildren(
      ...s.cues.map((c) => {
        const li = document.createElement('li')
        li.innerHTML = '<svg aria-hidden="true"><use href="#i-check"/></svg>'
        li.append(c)
        return li
      }),
    )
    prev.disabled = cur === 0
    const last = cur === n - 1
    // Next and "Back to catalogue" swap places; carry focus across so it never drops to <body>
    const focused = document.activeElement
    next.hidden = last
    done.hidden = !last
    if (focused === next && last) done.focus()
    if (focused === done && !last) next.focus()
    labelCanvas()
    viewer?.goTo(cur)
  }

  prev.addEventListener('click', () => goTo(cur - 1))
  next.addEventListener('click', () => goTo(cur + 1))

  document.addEventListener('keydown', (ev) => {
    if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return
    const t = ev.target as HTMLElement
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t.isContentEditable) return
    const k = stepForKey(ev.key, cur, n)
    if (k === null) return
    ev.preventDefault()
    const onTab = tabs.includes(t as HTMLButtonElement)
    if (k !== cur) goTo(k)
    if (onTab) tabs[k].focus()
  })

  goTo(0)

  const c = document.createElement('canvas')
  const webgl = !!(c.getContext('webgl2') || c.getContext('webgl'))
  if (!webgl) {
    msg.dataset.kind = 'off'
    canvas.hidden = true
    const text = $('.viewport-msg__text', msg)
    text.className = 'viewport-msg__text t-body'
    text.textContent = "3D view isn't supported on this browser. Every step is written out alongside."
  }
}

async function main(): Promise<void> {
  const r = resolveExercise(location.search)
  if (r.kind === 'not-found') {
    document.title = 'Exercise not found — Rep One'
    show('not-found')
    return
  }
  document.title = `${r.exercise.name} — Rep One`
  const motion = r.kind === 'built' ? await getMotion(r.exercise.id) : undefined
  if (motion) built(r.exercise, motion)
  else comingSoon(r.exercise)
}

main()
