import type { JointName } from './joints'

export type Vec3 = [number, number, number]
export type Euler = [x: number, y: number, z: number] // degrees, local, relative to rest pose
/**
 * Where an ankle is planted: metres in the figure's horizontal frame with y measured up from the floor,
 * pitch in degrees (positive lifts the toes), and how strongly the leg reaches for it (0 = leave the joints as posed).
 */
export type FootTarget = [x: number, y: number, z: number, pitch: number, weight: number]
/** The row handle: carry 0 rests it on the footplate bar, 1 follows the hands; left/right are each hand's hold on it. */
export interface HandleState { carry: number; left: number; right: number }
export type Pose = {
  root?: { position: Vec3 }
  joints: Partial<Record<JointName, Euler>>
  /** Planted feet. Without them, seated poses put both feet on the footplates and standing poses leave the legs as posed. */
  feet?: { L: FootTarget; R: FootTarget }
  /** Without it, the hands take the handle once they are seated and raised toward it. */
  handle?: HandleState
  /** Shoulder-blade retraction in degrees; negative spreads them apart. */
  scapula?: number
}
/** A partial pose at a moment in a transition: anything it leaves out is interpolated from the keys around it. */
export interface KeyPose {
  root?: Vec3
  joints?: Partial<Record<JointName, Euler>>
  feet?: { L?: FootTarget; R?: FootTarget }
  handle?: Partial<HandleState>
  scapula?: number
}
export interface Keyframe { at: number; pose: KeyPose } // ms after the transition starts
/** The movement from the previous step's pose into this step's pose. */
export interface StepEnter {
  duration: number // ms; the step's pose is reached at the end
  keys: Keyframe[]
  /** Hold a different camera while the movement plays, then move to the step's camera at `until` ms. */
  camera?: { view: View; until: number }
}
export type View = 'side' | 'top' | 'back' | 'iso'
export const VIEWS: readonly View[] = ['side', 'top', 'back', 'iso']

export interface CameraPreset { view: View; position: Vec3; target: Vec3; fov: number }

export type Easing = 'easeInOut' | 'easeOut' | 'linear'

// What a step is about. Body parts are tinted on the humanoid; the rest are parts of the row station.
export const FOCUS_PARTS = ['hands', 'feet', 'arms', 'shoulder-blades', 'spine', 'weight-pin', 'handle', 'footplates'] as const
export type FocusPart = (typeof FOCUS_PARTS)[number]
export interface StepFocus {
  parts: FocusPart[]
  /** With an `enter` movement: ms into it when the parts start flashing red. They turn green when it ends. */
  start?: number
  /** Without an `enter` movement: how long the parts flash red before turning green (ms). */
  duration?: number
  /** Fade the body so the spine shows through. */
  xray?: boolean
}

export interface Step {
  id: string
  title: string
  instruction: string
  mistake: string
  cues: string[]
  camera: View
  pose: Pose
  duration: number // ms, camera move and the fallback ease when there's no `enter` movement
  easing: Easing
  focus?: StepFocus
  enter?: StepEnter
}

// Muscle-group ids from src/data/muscles.ts, painted on the humanoid while the exercise is shown.
export interface MuscleTargets { primary: string[]; secondary?: string[] }

export interface ExerciseMotion {
  exerciseId: string
  cameras: Record<View, CameraPreset>
  steps: Step[]
  muscles?: MuscleTargets
  rep?: { duration: number; keys: { t: number; pose: Pose }[] } // t in [0,1]
}

// Pose files are lazy chunks so they stay out of the catalogue bundle.
// Convention for new cases: pose files use `export default` of an ExerciseMotion, e.g.
//   case 'seated-cable-row': return (await import('./poses/seated-cable-row')).default
export async function getMotion(id: string): Promise<ExerciseMotion | undefined> {
  switch (id) {
    case 'seated-cable-row':
      return (await import('./poses/seated-cable-row')).default
    default:
      return undefined
  }
}
