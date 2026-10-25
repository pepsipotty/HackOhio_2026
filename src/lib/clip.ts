// Transitions between step poses. Every channel (each joint's angles, the pelvis, each planted foot, the
// handle, the shoulder blades) gets its own track from the keys that mention it, interpolated with a
// monotone cubic: velocity is continuous through every key, holds stay perfectly still, nothing overshoots,
// and the movement eases out of the first pose and into the last.
import { JOINT_NAMES, type JointName } from '../data/joints'
import type { Euler, FootTarget, HandleState, KeyPose, Pose, StepEnter, Vec3 } from '../data/motion'

type Track = { t: number[]; v: number[][]; m: number[][] }

function track(points: [number, number[]][]): Track | null {
  if (!points.length) return null
  points.sort((a, b) => a[0] - b[0])
  const t = points.map((p) => p[0]), v = points.map((p) => p[1])
  const n = t.length, dims = v[0].length
  const m = v.map(() => new Array<number>(dims).fill(0)) // zero at both ends: start and finish at rest
  for (let d = 0; d < dims; d++) {
    for (let k = 1; k < n - 1; k++) {
      const h0 = t[k] - t[k - 1], h1 = t[k + 1] - t[k]
      if (h0 <= 0 || h1 <= 0) continue
      const s0 = (v[k][d] - v[k - 1][d]) / h0, s1 = (v[k + 1][d] - v[k][d]) / h1
      if (s0 * s1 <= 0) continue // a turning point or a hold: stop there
      const w0 = 2 * h1 + h0, w1 = h1 + 2 * h0 // PCHIP weights (Fritsch–Butland), keeps each segment monotone
      m[k][d] = (w0 + w1) / (w0 / s0 + w1 / s1)
    }
  }
  return { t, v, m }
}

function evaluate(tr: Track, time: number): number[] {
  const { t, v, m } = tr
  if (time <= t[0]) return v[0].slice()
  const n = t.length
  if (time >= t[n - 1]) return v[n - 1].slice()
  let k = 0
  while (k < n - 2 && time > t[k + 1]) k++
  const h = t[k + 1] - t[k]
  if (h <= 0) return v[k + 1].slice()
  const s = (time - t[k]) / h, s2 = s * s, s3 = s2 * s
  const a = 2 * s3 - 3 * s2 + 1, b = s3 - 2 * s2 + s, c = -2 * s3 + 3 * s2, e = s3 - s2
  return v[k].map((x, d) => a * x + b * h * m[k][d] + c * v[k + 1][d] + e * h * m[k + 1][d])
}

export interface Clip { duration: number; sample(time: number): Pose }

/** The movement of `enter` from `from` (usually the previous step's pose) into `to`. */
export function buildClip(from: Pose, enter: StepEnter, to: Pose): Clip {
  const T = enter.duration
  const keys: { at: number; pose: KeyPose }[] = [
    { at: 0, pose: asKey(from) },
    ...enter.keys,
    { at: T, pose: asKey(to) },
  ]
  const collect = (get: (k: KeyPose) => number[] | undefined) =>
    track(keys.flatMap((k) => { const v = get(k.pose); return v ? [[k.at, v] as [number, number[]]] : [] }))
  const root = collect((k) => k.root && [...k.root])
  const joints = JOINT_NAMES.map((j) => [j, collect((k) => k.joints?.[j] && [...k.joints[j]!])] as const)
  const feet = (['L', 'R'] as const).map((s) => collect((k) => k.feet?.[s] && [...k.feet[s]!]))
  const handle = (['carry', 'left', 'right'] as const).map((h) => collect((k) => (k.handle?.[h] === undefined ? undefined : [k.handle[h]!])))
  const scapula = collect((k) => (k.scapula === undefined ? undefined : [k.scapula]))
  return {
    duration: T,
    sample(time) {
      const pose: Pose = { joints: {} }
      if (root) pose.root = { position: evaluate(root, time) as Vec3 }
      for (const [j, tr] of joints) if (tr) pose.joints[j as JointName] = evaluate(tr, time) as Euler
      if (feet[0] || feet[1]) {
        const off: FootTarget = [0, 0, 0, 0, 0]
        pose.feet = {
          L: feet[0] ? (evaluate(feet[0], time) as FootTarget) : off,
          R: feet[1] ? (evaluate(feet[1], time) as FootTarget) : off,
        }
      }
      if (handle.some(Boolean)) {
        const [carry, left, right] = handle.map((tr) => (tr ? evaluate(tr, time)[0] : 0))
        pose.handle = { carry, left, right }
      }
      if (scapula) pose.scapula = evaluate(scapula, time)[0]
      return pose
    },
  }
}

/** A full pose as a key: joints it leaves out are at rest, and so are the shoulder blades. */
function asKey(p: Pose): KeyPose {
  return {
    root: p.root?.position,
    joints: Object.fromEntries(JOINT_NAMES.map((j) => [j, p.joints[j] ?? [0, 0, 0]])),
    feet: p.feet,
    handle: p.handle,
    scapula: p.scapula ?? 0,
  }
}

const lerp = (a: number, b: number, u: number) => a + (b - a) * u
const lerpAll = <T extends number[]>(a: T, b: T, u: number) => a.map((x, i) => lerp(x, b[i], u)) as unknown as T

/** Blend two poses (u = 0 gives a). Feet or handle left to their defaults on one side follow the other. */
export function mixPose(a: Pose, b: Pose, u: number): Pose {
  const joints: Pose['joints'] = {}
  for (const j of JOINT_NAMES) joints[j] = lerpAll<Euler>(a.joints[j] ?? [0, 0, 0], b.joints[j] ?? [0, 0, 0], u)
  const pa = a.root?.position, pb = b.root?.position
  const out: Pose = { joints }
  const position: Vec3 | undefined = pa && pb ? lerpAll<Vec3>([...pa], [...pb], u) : pb ?? pa
  if (position) out.root = { position }
  if (a.feet && b.feet) out.feet = { L: lerpAll(a.feet.L, b.feet.L, u), R: lerpAll(a.feet.R, b.feet.R, u) }
  else if (a.feet ?? b.feet) out.feet = b.feet ?? a.feet
  const ha = a.handle, hb = b.handle
  if (ha && hb) out.handle = { carry: lerp(ha.carry, hb.carry, u), left: lerp(ha.left, hb.left, u), right: lerp(ha.right, hb.right, u) }
  else if (ha ?? hb) out.handle = (hb ?? ha) as HandleState
  out.scapula = lerp(a.scapula ?? 0, b.scapula ?? 0, u)
  return out
}
