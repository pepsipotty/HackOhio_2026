// Step focus: tints whatever a step is about (hands, feet, spine, the weight pin...) so it reads at a glance.
// Red flashes while the part is moving into place; it turns steady green once it's there.
import {
  Color, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, CatmullRomCurve3, SkinnedMesh,
  SphereGeometry, Vector3, type Material, type Object3D, type Scene,
} from 'three'
import type { FocusPart, StepFocus } from '../data/motion'
import { FOCUS_COLORS } from '../data/muscles'
import type { Rig } from './rig'

export type FocusPhase = 'changing' | 'set'

const MAX_BONES = 128
const FLASH_HZ = 2 // under the 3-flashes-per-second photosensitivity limit
const BODY_BONES: Partial<Record<FocusPart, RegExp>> = {
  hands: /(Left|Right)Hand/,
  feet: /(Left|Right)(Foot|ToeBase|Toe_End)$/,
  arms: /(Left|Right)(Fore)?Arm$/,
}
const BODY_MUSCLES: Partial<Record<FocusPart, string[]>> = {
  'shoulder-blades': ['rhomboid-major', 'rhomboid-minor', 'middle-trap'],
}
const SPINE_BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head'].map((n) => `mixamorig1${n}`)
const XRAY_OPACITY = 0.22

/** 1 for each skeleton bone that belongs to a focused body part, else 0. */
export function focusBoneFlags(boneNames: string[], parts: readonly FocusPart[]): Float32Array {
  const flags = new Float32Array(MAX_BONES)
  const tests = parts.map((p) => BODY_BONES[p]).filter((r): r is RegExp => !!r)
  boneNames.slice(0, MAX_BONES).forEach((name, i) => { if (tests.some((r) => r.test(name))) flags[i] = 1 })
  return flags
}

type BodyMesh = { mesh: SkinnedMesh; bones: { value: Float32Array }; whole: { value: number } }
type Prop = { mesh: Mesh; layers: { material: MeshStandardMaterial; color: Color; emissive: Color }[] }

export function createStepFocus(rig: Rig, apparatus: { root: Object3D; stations: Record<string, any> }, scene: Scene) {
  const color = { value: new Color(FOCUS_COLORS.changing) }
  const amount = { value: 0 }

  // ---- body: a skin-weight tint injected into every humanoid material ----
  const body: BodyMesh[] = []
  if (!rig.placeholder) {
    rig.root.traverse((o) => {
      if (!(o instanceof SkinnedMesh)) return
      const entry: BodyMesh = { mesh: o, bones: { value: new Float32Array(MAX_BONES) }, whole: { value: 0 } }
      const material = o.material as Material
      const previous = material.onBeforeCompile
      material.onBeforeCompile = (shader, renderer) => {
        previous?.call(material, shader, renderer)
        Object.assign(shader.uniforms, { focusBones: entry.bones, focusWhole: entry.whole, focusColor: color, focusAmount: amount })
        shader.vertexShader = shader.vertexShader
          .replace('void main() {', `uniform float focusBones[${MAX_BONES}];\nuniform float focusWhole;\nvarying float vFocus;\nvoid main() {`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
	vFocus = focusWhole;
	#ifdef USE_SKINNING
		vFocus = max(vFocus, focusBones[int(skinIndex.x)] * skinWeight.x + focusBones[int(skinIndex.y)] * skinWeight.y
			+ focusBones[int(skinIndex.z)] * skinWeight.z + focusBones[int(skinIndex.w)] * skinWeight.w);
	#endif`)
        shader.fragmentShader = shader.fragmentShader
          .replace('void main() {', 'uniform vec3 focusColor;\nuniform float focusAmount;\nvarying float vFocus;\nvoid main() {')
          .replace('#include <color_fragment>', '#include <color_fragment>\n\tfloat focusMix = clamp( vFocus, 0.0, 1.0 ) * focusAmount;\n\tdiffuseColor.rgb = mix( diffuseColor.rgb, focusColor, focusMix );')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance = mix( totalEmissiveRadiance, focusColor * 0.55, focusMix );')
      }
      const key = material.customProgramCacheKey.bind(material)
      material.customProgramCacheKey = () => `${key()}|step-focus`
      material.needsUpdate = true
      body.push(entry)
    })
  }

  // ---- spine: beads along the spine bones, drawn through the faded body ----
  const spineBones = SPINE_BONES.map((n) => rig.root.getObjectByName(n)).filter((b): b is Object3D => !!b)
  const BEADS = 18
  const beadMaterial = new MeshBasicMaterial({ color: color.value, transparent: true, depthTest: false, depthWrite: false })
  const beads = new InstancedMesh(new SphereGeometry(0.017, 14, 10), beadMaterial, BEADS)
  beads.renderOrder = 10
  beads.frustumCulled = false
  beads.visible = false
  scene.add(beads)
  const curvePoints = spineBones.map(() => new Vector3())
  const curve = new CatmullRomCurve3(curvePoints)
  const at = new Vector3(), m4 = new Matrix4()
  const placeBeads = () => {
    spineBones.forEach((b, i) => b.getWorldPosition(curvePoints[i]))
    curve.updateArcLengths()
    for (let i = 0; i < BEADS; i++) {
      curve.getPointAt(i / (BEADS - 1), at)
      const s = 1 - 0.35 * (i / (BEADS - 1)) // lumbar beads larger than cervical
      beads.setMatrixAt(i, m4.makeScale(s, s, s).setPosition(at))
    }
    beads.instanceMatrix.needsUpdate = true
  }

  // ---- props: apparatus parts get their own material so the tint never leaks to other stations ----
  const props = new Map<Mesh, Prop>()
  const propMeshes = (part: FocusPart): Mesh[] => {
    const station = apparatus.stations.westSeatedRow
    const out: Mesh[] = []
    const collect = (root?: Object3D, keep: (m: Mesh) => boolean = () => true) =>
      root?.traverse((o) => { if (o instanceof Mesh && keep(o)) out.push(o) })
    if (part === 'weight-pin') {
      // the pin is small; the plates it selects (top plate down to the pin) make the choice readable
      collect(station?.pinGroup)
      for (const plate of station?.plates?.slice(0, (station.pinIndex ?? 0) + 1) ?? []) collect(plate.group, (m) => m.userData.interactiveType === 'weightPlate')
    }
    if (part === 'handle') collect(station?.handleGroup)
    if (part === 'footplates') {
      const plate = (apparatus as any).materials?.studdedFootplate
      collect(apparatus.root.getObjectByName('Station_WestSeatedRow'), (m) => m.material === plate || props.has(m))
    }
    return out
  }
  const propFor = (mesh: Mesh): Prop => {
    let p = props.get(mesh)
    if (!p) {
      const cloned = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => (m as MeshStandardMaterial).clone())
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]
      p = { mesh, layers: cloned.map((material) => ({ material, color: material.color.clone(), emissive: material.emissive?.clone() ?? new Color(0) })) }
      props.set(mesh, p)
    }
    return p
  }

  // ---- x-ray: fade the whole figure so the spine reads through it ----
  const saved = new Map<Material, { transparent: boolean; opacity: number; depthWrite: boolean }>()
  const setXray = (on: boolean) => {
    for (const { mesh } of body) {
      const m = mesh.material as Material
      if (on && !saved.has(m)) {
        saved.set(m, { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite })
        Object.assign(m, { transparent: true, opacity: XRAY_OPACITY, depthWrite: false })
        m.needsUpdate = true
      } else if (!on && saved.has(m)) {
        Object.assign(m, saved.get(m)!)
        saved.delete(m)
        m.needsUpdate = true
      }
    }
  }

  let focus: StepFocus | null = null
  let phase: FocusPhase = 'set'
  let since = 0
  let active: Prop[] = []

  const paint = () => {
    for (const l of active.flatMap((p) => p.layers)) {
      l.material.color.copy(l.color).lerp(color.value, amount.value)
      l.material.emissive?.copy(l.emissive).lerp(color.value, amount.value * 0.6)
    }
    beadMaterial.color.copy(color.value)
    beadMaterial.opacity = 0.35 + 0.65 * amount.value
  }

  return {
    /** Show a step's focus, or clear it with null. */
    set(next: StepFocus | null, startPhase: FocusPhase, now: number) {
      for (const l of active.flatMap((p) => p.layers)) { l.material.color.copy(l.color); l.material.emissive?.copy(l.emissive) }
      focus = next
      const parts = next?.parts ?? []
      for (const entry of body) {
        entry.bones.value.set(focusBoneFlags(entry.mesh.skeleton.bones.map((b) => b.name), parts))
        const groups = parts.flatMap((p) => BODY_MUSCLES[p] ?? [])
        entry.whole.value = groups.includes(entry.mesh.userData.muscle) ? 1 : 0
      }
      active = [...new Set(parts.flatMap(propMeshes))].map(propFor)
      beads.visible = parts.includes('spine') && spineBones.length > 1
      setXray(!!next?.xray && !rig.placeholder)
      this.setPhase(startPhase, now)
    },
    setPhase(next: FocusPhase, now: number) {
      phase = next
      since = now
      color.value.set(FOCUS_COLORS[next])
      this.tick(now)
    },
    get phase() { return phase },
    /** Advance the flash and follow the skeleton. Returns true while it needs more frames. */
    tick(now: number): boolean {
      if (!focus) { amount.value = 0; return false }
      amount.value = phase === 'changing' ? 0.3 + 0.7 * (0.5 + 0.5 * Math.cos(2 * Math.PI * FLASH_HZ * (now - since) / 1000)) : 0.85
      if (beads.visible) placeBeads()
      paint()
      return phase === 'changing'
    },
    dispose() {
      setXray(false)
      scene.remove(beads)
      beads.geometry.dispose()
      beadMaterial.dispose()
    },
  }
}
