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
import { createStepFocus } from './step-focus'
import { MODEL_URL } from '../data/media'
import { EASE, Tween, samplePose } from '../lib/tween'
import { buildClip, mixPose, type Clip } from '../lib/clip'
import type { CameraPreset, Easing, ExerciseMotion, Pose, StepFocus, View } from '../data/motion'

export interface Viewer {
  goTo(stepIndex: number): void
  setCamera(view: View): void
  play(): void
  pause(): void
  seek(t: number): void
  readonly placeholder: boolean
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
  opts: { reducedMotion: boolean; onPlayback: (t: number, playing: boolean) => void; onView?: (view: View) => void },
): Promise<Viewer> {
  const paper = tokenColor('--paper')
  const shade = tokenColor('--flood-light')
  const gridColor = tokenColor('--flood-mid')

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
  scene.add(new GridHelper(10, 20, gridColor, gridColor))
  const pelvis = rig.joints.pelvis

  const euler = new Euler()
  const q = new Quaternion()
  const targetsOf = (pose: Pose) =>
    JOINT_NAMES.map((j) => {
      const a = pose.joints[j] ?? [0, 0, 0]
      return rig.rest[j].clone().multiply(q.setFromEuler(euler.set(a[0] * DEG, a[1] * DEG, a[2] * DEG, 'XYZ')))
    })
  // Every frame re-applies one whole pose: joints, pelvis, planted feet, shoulder blades and the handle.
  let current: Pose = motion.steps[0].pose
  const applyPose = (pose: Pose) => {
    composite.restorePose()
    targetsOf(pose).forEach((t, k) => rig.joints[JOINT_NAMES[k]].quaternion.copy(t))
    if (pose.root) pelvis.position.set(...pose.root.position)
    rig.setFeet?.(pose.feet ?? null)
    rig.setScapula?.(pose.scapula ?? 0)
    composite.setHandle(pose.handle ?? null)
    current = pose
  }
  const smooth = (u: number) => u * u * (3 - 2 * u)
  const standing = (p: Pose) => (p.root?.position[1] ?? 1) > 0.7

  // Each step's movement in from the previous step, built once.
  const clips = motion.steps.map((s, k) => (k > 0 && s.enter ? buildClip(motion.steps[k - 1].pose, s.enter, s.pose) : null))
  // The movement in progress: a step's clip (forwards, or backwards when stepping back) or a plain ease.
  // `blend` eases out of wherever the figure was, so an interrupted movement never jumps.
  type Move = { start: number; duration: number; sample: (elapsed: number) => Pose; target: Pose; blend?: Pose }
  let move: Move | null = null
  const BLEND_MS = 350
  const sampleMove = (now: number): Pose => {
    const m = move!
    const elapsed = now - m.start
    if (elapsed >= m.duration) {
      move = null
      return m.target
    }
    const pose = m.sample(elapsed)
    return m.blend && elapsed < BLEND_MS ? mixPose(m.blend, pose, smooth(elapsed / BLEND_MS)) : pose
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
  let repBlend: { from: Pose; start: number } | null = null
  let stepFocus: ReturnType<typeof createStepFocus> | null = null
  let focusAt: { focus: StepFocus; at: number } | null = null // a step's highlight waiting for its moment
  let focusSetAt = 0 // when the current highlight turns from flashing red to steady green
  let camAt: { view: View; at: number } | null = null // a camera move scheduled partway through a step

  let raf = 0
  let last = 0
  let disposed = false
  const request = () => {
    if (!raf && !disposed && document.visibilityState === 'visible') raf = requestAnimationFrame(frame)
  }
  function frame(): void {
    // One clock for everything: movements and highlights are scheduled from performance.now() too.
    const now = performance.now()
    raf = 0
    const dt = last ? Math.min(now - last, 100) : 0
    last = now
    let busy = false
    if (camAt && now >= camAt.at) {
      startCam(camAt.view, 1400, 'easeInOut', now)
      opts.onView?.(camAt.view)
      camAt = null
    }
    if (camAt) busy = true
    if (camTween) {
      applyCam(camTween.value(now))
      if (camTween.done(now)) camTween = null
      else busy = true
    }
    if (move) {
      applyPose(sampleMove(now))
      busy = true
    } else if (playing) {
      t = (t + dt / rep.duration) % 1
      let pose = samplePose(rep.keys, t, true)
      if (repBlend) {
        const u = (now - repBlend.start) / 400
        if (u >= 1) repBlend = null
        else pose = mixPose(repBlend.from, pose, smooth(u))
      }
      applyPose(pose)
      opts.onPlayback(t, true)
      busy = true
    } else applyPose(current)
    busy = controls.update() || busy
    composite.sync()
    if (focusAt && now >= focusAt.at) {
      stepFocus?.set(focusAt.focus, 'changing', now)
      focusAt = null
    }
    if (focusAt) busy = true
    if (stepFocus?.phase === 'changing' && now >= focusSetAt) stepFocus.setPhase('set', now)
    busy = (stepFocus?.tick(now) ?? false) || busy
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

  // The exercise's worked muscles stay painted on the model; there is no click-to-toggle here.
  const muscleInteraction = createMuscleInteraction(rig.root, camera, renderer.domElement, request, {
    targets: motion.muscles, interactive: false,
  })
  // After the muscle materials are cloned, so the focus tint is compiled into the final materials.
  stepFocus = createStepFocus(rig, composite.apparatus, scene)
  controls.addEventListener('start', () => (camAt = null)) // a drag also cancels a scheduled camera move
  // Dev-only inspection hook for screenshot and clipping checks; stripped from production builds.
  if (import.meta.env.DEV) {
    Object.assign(window, {
      __rep: {
        camera, controls, rig, composite, scene, clips, rep, motion,
        sampleRep: (u: number) => samplePose(rep.keys, u, true),
        show(pose: Pose, cam?: { position: number[]; target: number[] }) {
          move = null
          playing = false
          camTween = null
          camAt = null
          applyPose(pose)
          if (cam) {
            camera.position.set(cam.position[0], cam.position[1], cam.position[2])
            controls.target.set(cam.target[0], cam.target[1], cam.target[2])
          }
          controls.update()
          composite.sync()
          renderer.render(scene, camera)
        },
      },
    })
  }

  const ms = (d: number) => (opts.reducedMotion ? 0 : d)
  let shown = -1
  return {
    placeholder: rig.placeholder,
    goTo(i) {
      const s = motion.steps[i]
      if (!s) return
      const prev = shown
      shown = i
      playing = false
      repBlend = null
      t = 0
      camAt = null
      const now = performance.now()
      const view = (v: View, duration = s.duration) => {
        startCam(v, ms(duration), s.easing, now)
        opts.onView?.(v)
      }
      const highlight = (start: number, end: number) => {
        stepFocus?.set(null, 'set', now)
        focusAt = s.focus ? { focus: s.focus, at: start } : null
        focusSetAt = end
      }
      const forward = (clip: Clip, blend?: Pose) => {
        move = { start: now, duration: clip.duration, sample: clip.sample, target: s.pose, blend }
        highlight(now + (s.focus?.start ?? 0), now + clip.duration)
        if (s.enter?.camera) {
          view(s.enter.camera.view)
          camAt = { view: s.camera, at: now + s.enter.camera.until }
        } else view(s.camera)
      }
      if (opts.reducedMotion || prev < 0) {
        // No movement: the step's pose, highlighted as already in place.
        move = null
        applyPose(s.pose)
        view(s.camera)
        stepFocus?.set(s.focus ?? null, 'set', now)
        focusAt = null
      } else if (i === prev + 1 && clips[i]) {
        forward(clips[i]!, current)
      } else if (i === prev - 1 && clips[prev]) {
        // Stepping back plays the later step's movement in reverse: stand up, step back over the bench...
        const clip = clips[prev]!
        move = { start: now, duration: clip.duration, sample: (e) => clip.sample(clip.duration - e), target: s.pose, blend: current }
        highlight(now, now + clip.duration)
        view(s.camera)
      } else if (clips[i]) {
        // A jump, or replaying this step: start its movement from the previous step's pose.
        applyPose(motion.steps[i - 1].pose)
        forward(clips[i]!)
      } else if (standing(current) !== standing(s.pose)) {
        // Can't ease between standing and seated without passing through the bench; cut instead.
        move = null
        applyPose(s.pose)
        highlight(now, now + (s.focus?.duration ?? s.duration))
        view(s.camera)
      } else {
        const from = current
        const duration = ms(s.duration)
        move = { start: now, duration, sample: (e) => mixPose(from, s.pose, EASE[s.easing](e / duration)), target: s.pose }
        highlight(now, now + (s.focus?.duration ?? s.duration))
        view(s.camera)
      }
      request()
    },
    setCamera(view) {
      camAt = null
      startCam(view, ms(700), 'easeInOut', performance.now())
      request()
    },
    play() {
      if (playing) return
      const now = performance.now()
      move = null
      focusAt = null
      stepFocus?.set(null, 'set', now)
      // Ease into the rep's current frame instead of snapping, unless standing (the ease would cross the bench).
      repBlend = opts.reducedMotion || standing(current) ? null : { from: current, start: now }
      playing = true
      request()
    },
    pause() {
      playing = false
      opts.onPlayback(t, false)
    },
    seek(v) {
      playing = false
      move = null
      repBlend = null
      focusAt = null
      stepFocus?.set(null, 'set', performance.now())
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
      stepFocus?.dispose()
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
