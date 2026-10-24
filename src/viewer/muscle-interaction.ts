import { Color, Mesh, MeshStandardMaterial, Object3D, Raycaster, Vector2, type Camera } from 'three'



export function createMuscleInteraction(root: Object3D, camera: Camera, canvas: HTMLCanvasElement, request: () => void) {
  const meshes: Mesh[] = [], selected = new Set<string>()
  root.traverse(o => { if (o instanceof Mesh) meshes.push(o) })
  const muscles = meshes.filter(m => typeof m.userData.muscle === 'string')
  const originals = new Map<MeshStandardMaterial, {color: Color; map: MeshStandardMaterial['map']; vertexColors: boolean}>()
  for (const mesh of muscles) {
    // A per-part material prevents GLTF deduplication from highlighting unrelated groups.
    mesh.material = (mesh.material as MeshStandardMaterial).clone()
    const m = mesh.material as MeshStandardMaterial
    originals.set(m, {color: m.color.clone(), map: m.map, vertexColors: m.vertexColors})
  }
  let onChange: (groups: string[]) => void = () => {}
  const apply = () => {
    const showDeep = [...selected].some(id => muscles.some(m => m.userData.muscle === id && m.userData.anatomyLayer === 'deep'))
    for (const mesh of muscles) {
      const id = mesh.userData.muscle as string
      const deep = mesh.userData.anatomyLayer === 'deep'
      const covering = ['upper-trap', 'middle-trap', 'lower-trap', 'latissimus'].includes(id)
      mesh.visible = deep ? showDeep : !(showDeep && covering && !selected.has(id))
      const m = mesh.material as MeshStandardMaterial, original = originals.get(m)!
      m.color.copy(original.color); m.map = original.map; m.vertexColors = original.vertexColors
      m.emissive.set(0); m.emissiveIntensity = 0
      if (selected.has(id)) { m.color.set('#f6c453'); m.map = null; m.vertexColors = false; m.emissive.set('#f6c453'); m.emissiveIntensity = .15 }
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
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointerup', onUp)
  apply()
  return {
    groups: [...new Set(muscles.map(m => m.userData.muscle as string))],
    toggle,
    clear() { selected.clear(); apply() },
    subscribe(fn: typeof onChange) { onChange = fn; onChange([...selected]) },
    dispose() { canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp) },
  }
}
