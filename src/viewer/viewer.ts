// The exercise page's 3D view: animated camera presets, joint poses, orbit, and rep playback.
// Renders on demand: the rAF loop only runs while a tween, playback or orbit damping is active.
import {
  Color, DataTexture, DirectionalLight, Euler, GridHelper, HemisphereLight,
  Mesh, MeshToonMaterial, NearestFilter, PerspectiveCamera, Quaternion, RedFormat,
  SRGBColorSpace, Scene, Spherical, Vector3, WebGLRenderer, type Material,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createCableRowComposite } from './cable-row-composite'
import { JOINT_NAMES, loadRig } from './rig'
import { createMuscleInteraction } from './muscle-interaction'
import { MODEL_URL } from '../data/media'
import { Tween, samplePose } from '../lib/tween'
import type { CameraPreset, Easing, ExerciseMotion, Pose, View } from '../data/motion'

export interface Viewer {
  goTo(stepIndex: number): void
  setCamera(view: View): void
  play(): void
  pause(): void
  seek(t: number): void
  readonly placeholder: boolean
  readonly muscleGroups: string[]
  toggleMuscle(id: string): void
  clearMuscles(): void
  onMusclesChange(callback: (groups: string[]) => void): void
  dispose(): void
}

const DEG = Math.PI / 180

// three's Color can't parse oklch(), so let the browser paint the token and read the pixel back.
function tokenColor(token: string): Color {
  const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2D canvas unavailable')
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace)
}

export async function createViewer(
  host: HTMLElement,
  motion: ExerciseMotion,
  opts: { reducedMotion: boolean; onPlayback: (t: number, playing: boolean) => void },
): Promise<Viewer> {
  const paper = tokenColor('--paper')
  const shade = tokenColor('--flood-light')
  const mid = tokenColor('--flood-mid')

  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  const scene = new Scene()
  const camera = new PerspectiveCamera(40, 1, 0.1, 60)
  scene.add(camera)

  // Flat two-tone: the shadow side is exactly --flood-light (ambient alone), the lit side clips to white.
  scene.add(new HemisphereLight(shade, shade, Math.PI))
  const sun = new DirectionalLight(paper, 2.4)
  sun.position.set(-1.5, 2.5, 0.5) // rides with the camera, so the lit side always faces the viewer
  camera.add(sun)
  const gradientMap = new DataTexture(new Uint8Array([0, 255]), 2, 1, RedFormat)
  gradientMap.minFilter = gradientMap.magFilter = NearestFilter
  gradientMap.needsUpdate = true
  const skin = new MeshToonMaterial({ color: paper, gradientMap })

  const rig = await loadRig(MODEL_URL, skin)
  const composite = createCableRowComposite(rig)
  // Reorient the native gym assembly to the exercise camera/pose convention.
  composite.root.rotation.y = -Math.PI / 2
  composite.root.position.z = 1.85
  scene.add(composite.root)
  scene.add(new GridHelper(10, 20, mid, mid))
  const pelvis = rig.joints.pelvis

  const euler = new Euler()
  const q = new Quaternion()
  const targetsOf = (pose: Pose) =>
    JOINT_NAMES.map((j) => {
      const a = pose.joints[j] ?? [0, 0, 0]
      return rig.rest[j].clone().multiply(q.setFromEuler(euler.set(a[0] * DEG, a[1] * DEG, a[2] * DEG, 'XYZ')))
    })
  const applyPose = (pose: Pose) => {
    composite.restorePose()
    targetsOf(pose).forEach((t, k) => rig.joints[JOINT_NAMES[k]].quaternion.copy(t))
    if (pose.root) pelvis.position.set(...pose.root.position)
  }

  // Pose tween: 0→1, slerping each joint from wherever it is now, so a retarget never snaps.
  type PoseAnim = { tween: Tween; fromQ: Quaternion[]; toQ: Quaternion[]; fromP: Vector3; toP: Vector3 }
  let poseAnim: PoseAnim | null = null
  const startPose = (pose: Pose, duration: number, easing: Easing, now: number) => {
    composite.restorePose()
    poseAnim = {
      tween: new Tween([0], [1], duration, easing, now),
      fromQ: JOINT_NAMES.map((j) => rig.joints[j].quaternion.clone()),
      toQ: targetsOf(pose),
      fromP: pelvis.position.clone(),
      toP: pose.root ? new Vector3(...pose.root.position) : pelvis.position.clone(),
    }
  }
  const stepPose = (now: number) => {
    if (!poseAnim) return
    const { tween, fromQ, toQ, fromP, toP } = poseAnim
    const [u] = tween.value(now)
    JOINT_NAMES.forEach((j, k) => rig.joints[j].quaternion.slerpQuaternions(fromQ[k], toQ[k], u))
    pelvis.position.lerpVectors(fromP, toP, u)
    if (tween.done(now)) poseAnim = null
  }

  const controls = new OrbitControls(camera, renderer.domElement)
  Object.assign(controls, {
    enablePan: false, enableDamping: true, minDistance: 2, maxDistance: 7,
    minPolarAngle: 0.05, maxPolarAngle: Math.PI / 2 - 0.05,
  })

  // Camera tween over [radius, polar, azimuth, target xyz, fov]: orbiting around the figure
  // reads better than cutting a straight line through it.
  const sph = new Spherical()
  const off = new Vector3()
  const camState = (): number[] => {
    sph.setFromVector3(off.copy(camera.position).sub(controls.target))
    return [sph.radius, sph.phi, sph.theta, ...controls.target.toArray(), camera.fov]
  }
  const presetState = (p: CameraPreset, from: number[]): number[] => {
    sph.setFromVector3(off.set(...p.position).sub(new Vector3(...p.target)))
    let theta = sph.theta
    while (theta - from[2] > Math.PI) theta -= 2 * Math.PI // shortest way round
    while (theta - from[2] < -Math.PI) theta += 2 * Math.PI
    return [sph.radius, sph.phi, theta, ...p.target, p.fov]
  }
  const applyCam = (v: number[]) => {
    controls.target.set(v[3], v[4], v[5])
    camera.position.setFromSpherical(sph.set(v[0], v[1], v[2])).add(controls.target)
    camera.fov = v[6]
    camera.updateProjectionMatrix()
  }
  let camTween: Tween | null = null
  const startCam = (view: View, duration: number, easing: Easing, now: number) => {
    const from = camState()
    camTween = new Tween(from, presetState(motion.cameras[view], from), duration, easing, now)
  }
  controls.addEventListener('start', () => (camTween = null)) // a drag takes over from the preset

  // Rep track; without one, the step poses play in order.
  const rep = motion.rep ?? {
    duration: motion.steps.reduce((s, x) => s + x.duration, 0),
    keys: motion.steps.map((s, k) => ({ t: k / Math.max(motion.steps.length - 1, 1), pose: s.pose })),
  }
  let playing = false
  let t = 0

  let raf = 0
  let last = 0
  let disposed = false
  const request = () => {
    if (!raf && !disposed && document.visibilityState === 'visible') raf = requestAnimationFrame(frame)
  }
  function frame(now: number): void {
    raf = 0
    const dt = last ? Math.min(now - last, 100) : 0
    last = now
    let busy = false
    if (camTween) {
      applyCam(camTween.value(now))
      if (camTween.done(now)) camTween = null
      else busy = true
    }
    composite.restorePose()
    stepPose(now)
    if (poseAnim) busy = true
    if (playing) {
      if (!poseAnim) {
        t = (t + dt / rep.duration) % 1
        applyPose(samplePose(rep.keys, t, true))
      }
      opts.onPlayback(t, true)
      busy = true
    }
    busy = controls.update() || busy
    composite.sync()
    renderer.render(scene, camera)
    if (busy) request()
    else last = 0
  }
  controls.addEventListener('change', request)

  const onVisibility = () => {
    if (document.visibilityState === 'visible') return request()
    cancelAnimationFrame(raf)
    raf = 0
    last = 0
  }
  document.addEventListener('visibilitychange', onVisibility)

  const ro = new ResizeObserver(() => {
    const w = host.clientWidth
    const h = host.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.zoom = Math.min(1, w / h) // presets are framed for landscape; widen the view on tall viewports
    camera.updateProjectionMatrix()
    request()
  })
  ro.observe(host)
  host.append(renderer.domElement)

  // Start framed on step 1 with no tween.
  const first = motion.cameras[motion.steps[0].camera]
  camera.position.set(...first.position)
  controls.target.set(...first.target)
  camera.fov = first.fov
  camera.updateProjectionMatrix()
  applyPose(motion.steps[0].pose)
  request()

  const muscleInteraction = createMuscleInteraction(rig.root, camera, renderer.domElement, request)

  const ms = (d: number) => (opts.reducedMotion ? 0 : d)
  return {
    placeholder: rig.placeholder,
    muscleGroups: muscleInteraction.groups,
    toggleMuscle: muscleInteraction.toggle,
    clearMuscles: muscleInteraction.clear,
    onMusclesChange: muscleInteraction.subscribe,
    goTo(i) {
      const s = motion.steps[i]
      if (!s) return
      playing = false
      t = 0
      const now = performance.now()
      startCam(s.camera, ms(s.duration), s.easing, now)
      startPose(s.pose, ms(s.duration), s.easing, now)
      request()
    },
    setCamera(view) {
      startCam(view, ms(700), 'easeInOut', performance.now())
      request()
    },
    play() {
      if (playing) return
      // ease into the rep's current frame instead of snapping to it
      startPose(samplePose(rep.keys, t, true), ms(400), 'easeOut', performance.now())
      playing = true
      request()
    },
    pause() {
      playing = false
      opts.onPlayback(t, false)
    },
    seek(v) {
      playing = false
      poseAnim = null
      t = Math.min(Math.max(v, 0), 1)
      applyPose(samplePose(rep.keys, t, true))
      opts.onPlayback(t, false)
      request()
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      controls.dispose()
      muscleInteraction.dispose()
      scene.traverse((o) => {
        const m = o as Mesh
        m.geometry?.dispose()
        const materials = Array.isArray(m.material) ? m.material : [m.material]
        for (const material of materials) material?.dispose?.()
      })
      gradientMap.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
