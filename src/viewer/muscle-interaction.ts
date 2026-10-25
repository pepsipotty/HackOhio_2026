import { Color, Mesh, MeshStandardMaterial, Object3D, Raycaster, Vector2, type Camera } from 'three'
import type { MuscleTargets } from '../data/motion'
import { MUSCLE_TIER_COLORS } from '../data/muscles'

// Primary movers read strongest; secondary/stabilising groups get a softer tint of the same hue.
const TIERS = {
  primary: { color: MUSCLE_TIER_COLORS.primary, emissive: .5 },
  secondary: { color: MUSCLE_TIER_COLORS.secondary, emissive: .05 },
} as const
type Tier = keyof typeof TIERS

export interface MuscleInteractionOptions {
  /** Groups painted permanently on the model, e.g. the muscles an exercise works. */
  targets?: MuscleTargets
  /** Click a muscle to toggle its highlight. Defaults to true. */
  interactive?: boolean
}

export function createMuscleInteraction(
  root: Object3D, camera: Camera, canvas: HTMLCanvasElement, request: () => void, opts: MuscleInteractionOptions = {},
) {
  const meshes: Mesh[] = [], selected = new Set<string>()
  root.traverse(o => { if (o instanceof Mesh) meshes.push(o) })
  const muscles = meshes.filter(m => typeof m.userData.muscle === 'string')
  const interactive = opts.interactive ?? true
  const tiers = new Map<string, Tier>()
  for (const id of opts.targets?.secondary ?? []) tiers.set(id, 'secondary')
  for (const id of opts.targets?.primary ?? []) tiers.set(id, 'primary')
  const originals = new Map<MeshStandardMaterial, {color: Color; map: MeshStandardMaterial['map']; vertexColors: boolean}>()
  for (const mesh of muscles) {
    // A per-part material prevents GLTF deduplication from highlighting unrelated groups.
    mesh.material = (mesh.material as MeshStandardMaterial).clone()
    const m = mesh.material as MeshStandardMaterial
    originals.set(m, {color: m.color.clone(), map: m.map, vertexColors: m.vertexColors})
  }
  // A clicked group takes the primary colour; otherwise fall back to the exercise's own tier.
  const tierOf = (id: string): Tier | undefined => selected.has(id) ? 'primary' : tiers.get(id)
  let onChange: (groups: string[]) => void = () => {}
  const apply = () => {
    const showDeep = muscles.some(m => m.userData.anatomyLayer === 'deep' && tierOf(m.userData.muscle as string))
    for (const mesh of muscles) {
      const id = mesh.userData.muscle as string
      const tier = tierOf(id)
      const deep = mesh.userData.anatomyLayer === 'deep'
      const covering = ['upper-trap', 'middle-trap', 'lower-trap', 'latissimus'].includes(id)
      mesh.visible = deep ? showDeep : !(showDeep && covering && !tier)
      // Jaw and temple patches print dark blobs on the face and aren't part of any exercise view.
      if (!interactive && id === 'neck-face' && !tier) mesh.visible = false
      const m = mesh.material as MeshStandardMaterial, original = originals.get(m)!
      m.color.copy(original.color); m.map = original.map; m.vertexColors = original.vertexColors
      m.emissive.set(0); m.emissiveIntensity = 0
      if (tier) {
        const style = TIERS[tier]
        m.color.set(style.color); m.map = null; m.vertexColors = false
        m.emissive.set(style.color); m.emissiveIntensity = style.emissive
      }
      m.needsUpdate = true
    }
    onChange([...selected]); request()
  }
  const toggle = (id: string) => { if (!muscles.some(m => m.userData.muscle === id)) return; if (selected.has(id)) selected.delete(id); else selected.add(id); apply() }
  const raycaster = new Raycaster(), pointer = new Vector2()
  let down: [number, number] | null = null
  const onDown = (e: PointerEvent) => { down = e.button === 0 ? [e.clientX, e.clientY] : null }
  const onUp = (e: PointerEvent) => {
    if (!down || e.button !== 0 || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return
    down = null
    const r = canvas.getBoundingClientRect()
    pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    root.updateMatrixWorld(true)
    const hit = raycaster.intersectObjects(meshes.filter(m => m.visible), false)[0]
    if (hit?.object.userData.muscle) toggle(hit.object.userData.muscle as string)
  }
  if (interactive) {
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)
  }
  apply()
  return {
    groups: [...new Set(muscles.map(m => m.userData.muscle as string))],
    toggle,
    clear() { selected.clear(); apply() },
    subscribe(fn: typeof onChange) { onChange = fn; onChange([...selected]) },
    dispose() { canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp) },
  }
}
