import type { Easing, Euler, Pose, Vec3 } from '../data/motion'
import type { JointName } from '../data/joints'

export const EASE: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  easeOut: (t) => 1 - (1 - t) ** 3,
  easeInOut: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
}

export class Tween {
  constructor(
    private from: number[],
    private to: number[],
    private duration: number,
    private easing: Easing,
    private start: number,
  ) {}

  private progress(now: number): number {
    return this.duration <= 0 ? 1 : Math.min(Math.max((now - this.start) / this.duration, 0), 1)
  }

  value(now: number): number[] {
    const e = EASE[this.easing](this.progress(now))
    return this.to.map((b, i) => this.from[i] + (b - this.from[i]) * e)
  }

  done(now: number): boolean {
    return this.progress(now) >= 1
  }

  retarget(to: number[], now: number, duration: number, easing: Easing): void {
    this.from = this.value(now)
    this.to = to
    this.duration = duration
    this.easing = easing
    this.start = now
  }
}

const lerp3 = (a: readonly number[], b: readonly number[], u: number) =>
  a.map((x, i) => x + (b[i] - x) * u) as Vec3

export function samplePose(keys: { t: number; pose: Pose }[], t: number, smooth = false): Pose {
  t = Math.min(Math.max(t, 0), 1)
  let i = keys.findIndex((k) => k.t >= t)
  if (i < 0) i = keys.length - 1
  const hi = keys[i]
  const lo = keys[Math.max(i - 1, 0)]
  const fraction = hi.t === lo.t ? 1 : (t - lo.t) / (hi.t - lo.t)

  const u = smooth ? fraction * fraction * (3 - 2 * fraction) : fraction

  const joints: Pose['joints'] = {}
  for (const j of new Set([...Object.keys(lo.pose.joints), ...Object.keys(hi.pose.joints)]) as Set<JointName>) {
    joints[j] = lerp3(lo.pose.joints[j] ?? [0, 0, 0], hi.pose.joints[j] ?? [0, 0, 0], u) as Euler
  }
  const a = lo.pose.root?.position
  const b = hi.pose.root?.position
  const position = a && b ? lerp3(a, b, u) : a ?? b
  const pose: Pose = position ? { root: { position }, joints } : { joints }
  if (lo.pose.scapula !== undefined || hi.pose.scapula !== undefined) {
    pose.scapula = (lo.pose.scapula ?? 0) + ((hi.pose.scapula ?? 0) - (lo.pose.scapula ?? 0)) * u
  }
  // An explicit hold carries through keys that leave it out, so the hands never fall back to guessing.
  const handle = hi.pose.handle ?? lo.pose.handle
  if (handle) pose.handle = handle
  return pose
}
