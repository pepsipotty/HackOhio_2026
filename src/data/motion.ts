import type { JointName } from './joints'

export type Vec3 = [number, number, number]
export type Euler = [x: number, y: number, z: number] // degrees, local, relative to rest pose
export type Pose = { root?: { position: Vec3 }; joints: Partial<Record<JointName, Euler>> }
export type View = 'side' | 'top' | 'back' | 'iso'
export const VIEWS: readonly View[] = ['side', 'top', 'back', 'iso']

export interface CameraPreset { view: View; position: Vec3; target: Vec3; fov: number }

export type Easing = 'easeInOut' | 'easeOut' | 'linear'

// What a step is about. Body parts are tinted on the humanoid; the rest are parts of the row station.
export const FOCUS_PARTS = ['hands', 'feet', 'arms', 'shoulder-blades', 'spine', 'weight-pin', 'handle', 'footplates'] as const
export type FocusPart = (typeof FOCUS_PARTS)[number]
export interface StepFocus {
  parts: FocusPart[]
  /** Where the demonstration starts; defaults to the previous step's pose. */
  from?: Pose
  /** How long the parts flash red while moving into place (ms), before turning green. */
  duration: number
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
  duration: number // ms
  easing: Easing
  focus?: StepFocus
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
