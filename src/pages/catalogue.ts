import '../styles/tokens.css'
import '../styles/base.css'
import '../styles/glass.css'
import '../styles/transitions.css'
import '../styles/catalogue.css'
import { applyGlassSupport } from '../lib/glass'
import { DIFFICULTIES, EQUIPMENT, EXERCISES, MUSCLES, PATTERNS, type Exercise } from '../data/exercises'
import { gifSrc } from '../data/media'
import {
  EMPTY_QUERY, PINNED_ID, activeFilterCount, applyQuery, parseQuery, serializeQuery,
  type CatalogueQuery, type SortKey,
} from '../lib/catalogue'

applyGlassSupport()

type Group = 'muscle' | 'equipment' | 'pattern' | 'difficulty'
// Level sits second so MUSCLE + LEVEL share the first row at 1440px, keeping the sticky band two rows tall.
const GROUPS: [Group, string, readonly string[]][] = [
  ['muscle', 'Muscle', MUSCLES],
  ['difficulty', 'Level', DIFFICULTIES],
  ['equipment', 'Equipment', EQUIPMENT],
  ['pattern', 'Movement', PATTERNS],
]
const DEFINITIONS: Record<string, string> = {
  push: 'Pushing weight away',
  pull: 'Pulling it toward you',
  hinge: 'Bending at the hips',
  carry: 'Holding and walking',
}
const LAST_ID = 'rep-one:last-id'
const HERO = 'exercise-hero'

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
const $ = <T extends Element>(sel: string) => document.querySelector(sel) as T

const panel = $<HTMLElement>('#filter-panel')
const toggle = $<HTMLButtonElement>('.filters__toggle')
const sortSelect = $<HTMLSelectElement>('#sort')
const count = $<HTMLElement>('#count')
const activeList = $<HTMLUListElement>('.results__active')
const clearAll = $<HTMLButtonElement>('.results__clear')
const cards = $<HTMLUListElement>('#cards')
const empty = $<HTMLElement>('#empty')

let state: CatalogueQuery = parseQuery(location.search)
const missing = new Set<string>() // ids whose GIF failed to load: go straight to the label

// Filter groups, built once from the taxonomy arrays.
panel.innerHTML = GROUPS.map(([key, label, values]) => `
  <div class="fgroup" role="group" aria-labelledby="fg-${key}">
    <span class="fgroup__label t-label" id="fg-${key}">${label}</span>
    <div class="fgroup__chips">${values.map((v) => `
      <button class="chip t-label" type="button" data-group="${key}" data-value="${v}" aria-pressed="false"${
        DEFINITIONS[v] && key === 'pattern' ? ` title="${DEFINITIONS[v]}"` : ''}>${cap(v)}</button>`).join('')}
    </div>${key === 'pattern' ? `
    <p class="fgroup__help">Push = pushing weight away · Pull = pulling it toward you · Hinge = bending at the hips · Carry = holding and walking</p>` : ''}
  </div>`).join('')

const number = (e: Exercise) => String(EXERCISES.indexOf(e) + 1).padStart(2, '0')

function cardHTML(e: Exercise): string {
  const no = number(e)
  const level = DIFFICULTIES.indexOf(e.difficulty) + 1
  const pinned = e.id === PINNED_ID
  return `
  <li class="card-item" data-id="${e.id}">
    <a class="card${pinned ? ' card--pinned' : ''}" href="exercise.html?id=${e.id}" aria-labelledby="no-${e.id} name-${e.id}${pinned ? ` tab-${e.id}` : ''}${e.built ? '' : ` soon-${e.id}`}">
      <div class="preview">
        <span class="preview__num" aria-hidden="true">${no}</span>
        <svg class="preview__icon" aria-hidden="true" focusable="false"><use href="#icon-${e.pattern}"></use></svg>
        <span class="preview__no t-label" id="no-${e.id}">No. ${no}</span>
        ${pinned ? `<span class="preview__tab t-label" id="tab-${e.id}">Start here</span>` : ''}
      </div>
      <div class="card__body">
        <h2 class="card__name t-h2" id="name-${e.id}">${e.name}</h2>
        ${e.built ? '' : `<span class="card__soon t-label" id="soon-${e.id}">Coming soon</span>`}
        <p class="card__muscles t-label">${e.primary.map(cap).join(' · ')}</p>
        <p class="card__level t-label"><span class="bars bars--${level}" aria-hidden="true"><i></i><i></i><i></i></span>${cap(e.difficulty)}</p>
        <p class="card__text card__works">${e.works}</p>
        <p class="card__text"><strong>Why start here:</strong> ${e.why}</p>
      </div>
    </a>
    <button class="preview-toggle t-label" type="button" aria-pressed="false" aria-label="Preview ${e.name}">Preview</button>
  </li>`
}

function render(): void {
  for (const chip of panel.querySelectorAll<HTMLButtonElement>('.chip')) {
    const picked = (state[chip.dataset.group as Group] as string[]).includes(chip.dataset.value!)
    chip.setAttribute('aria-pressed', String(picked))
  }
  sortSelect.value = state.sort

  const n = activeFilterCount(state)
  $<HTMLElement>('[data-filter-count]').textContent = String(n)
  clearAll.hidden = n === 0
  activeList.innerHTML = GROUPS.flatMap(([key]) => (state[key] as string[]).map((v) => `
    <li><button class="active-chip t-label" type="button" data-group="${key}" data-value="${v}" aria-label="Remove filter: ${cap(v)}">${cap(v)}<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2 2l8 8M10 2l-8 8" /></svg></button></li>`)).join('')

  const list = applyQuery(EXERCISES, state)
  count.textContent = `${list.length} ${list.length === 1 ? 'exercise' : 'exercises'}`
  cards.innerHTML = list.map(cardHTML).join('')
  cards.hidden = list.length === 0
  empty.hidden = list.length > 0
}

function update(next: CatalogueQuery): void {
  state = next
  history.replaceState(null, '', serializeQuery(state) || location.pathname)
  render()
}

// One delegated handler for filter chips, active-chip removal and both clear buttons.
document.addEventListener('click', (ev) => {
  const btn = (ev.target as Element).closest<HTMLButtonElement>('button[data-group], button[data-clear]')
  if (!btn) return
  if (btn.hasAttribute('data-clear')) {
    update({ ...EMPTY_QUERY, sort: state.sort })
  } else {
    const key = btn.dataset.group as Group
    const value = btn.dataset.value!
    const cur = state[key] as string[]
    update({ ...state, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] })
  }
  // the pressed control was removed or hidden by the re-render: don't drop keyboard focus to <body>
  if (!btn.isConnected || btn.closest('[hidden]')) {
    ;(activeList.querySelector('button') ?? cards.querySelector('a') ?? empty.querySelector('button'))?.focus()
  }
})

sortSelect.addEventListener('change', () => update({ ...state, sort: sortSelect.value as SortKey }))

toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true'
  toggle.setAttribute('aria-expanded', String(open))
  panel.classList.toggle('is-open', open)
})

// Previews: the <img> is created lazily on first hover/focus; CSS decides when it shows.
function ensurePreview(item: HTMLElement): void {
  const win = item.querySelector('.preview')!
  if (win.querySelector('.preview-gif')) return
  const id = item.dataset.id!
  const name = item.querySelector('.card__name')!.textContent
  const soon = () => {
    missing.add(id)
    const label = document.createElement('span')
    label.className = 'preview-gif preview-soon t-label'
    label.textContent = 'Preview coming soon'
    win.querySelector('img.preview-gif')?.remove()
    win.append(label)
  }
  if (missing.has(id)) return soon()
  const img = document.createElement('img')
  img.className = 'preview-gif'
  img.alt = `Animated preview of ${name}`
  img.decoding = 'async'
  img.addEventListener('error', soon, { once: true })
  img.src = gifSrc(id)
  win.append(img)
}

const itemOf = (t: EventTarget | null) => (t as Element | null)?.closest<HTMLElement>('.card-item')
cards.addEventListener('pointerover', (ev) => { const it = itemOf(ev.target); if (it) ensurePreview(it) })
cards.addEventListener('focusin', (ev) => { const it = itemOf(ev.target); if (it) ensurePreview(it) })

cards.addEventListener('click', (ev) => {
  const target = ev.target as Element
  const item = itemOf(target)
  if (!item) return
  const previewBtn = target.closest<HTMLButtonElement>('.preview-toggle')
  if (previewBtn) {
    ensurePreview(item)
    previewBtn.setAttribute('aria-pressed', String(previewBtn.getAttribute('aria-pressed') !== 'true'))
    return
  }
  if (!target.closest('.card')) return
  setHero(item)
  try { sessionStorage.setItem(LAST_ID, item.dataset.id!) } catch { /* storage blocked: morph just won't run on back */ }
})

// Only one element may carry the shared transition name at a time.
function setHero(item: HTMLElement | null): void {
  for (const el of cards.querySelectorAll<HTMLElement>('.preview')) el.style.viewTransitionName = ''
  const win = item?.querySelector<HTMLElement>('.preview')
  if (win) win.style.viewTransitionName = HERO
}

window.addEventListener('pagereveal', (ev) => {
  const vt = (ev as Event & { viewTransition?: ViewTransition | null }).viewTransition
  if (!vt) return
  let id: string | null = null
  try { id = sessionStorage.getItem(LAST_ID) } catch { /* storage blocked */ }
  const item = id ? cards.querySelector<HTMLElement>(`.card-item[data-id="${CSS.escape(id)}"]`) : null
  if (!item) return
  setHero(item)
  vt.finished.finally(() => setHero(null))
})

render()
