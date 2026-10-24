import type { JointName } from './joints'

export type Vec3 = [number, number, number]
export type Euler = [x: number, y: number, z: number] // degrees, local, relative to rest pose
export type Pose = { root?: { position: Vec3 }; joints: Partial<Record<JointName, Euler>> }
export type View = 'side' | 'top' | 'back' | 'iso'
export const VIEWS: readonly View[] = ['side', 'top', 'back', 'iso']

export interface CameraPreset { view: View; position: Vec3; target: Vec3; fov: number }

export type Easing = 'easeInOut' | 'easeOut' | 'linear'

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
}

export interface ExerciseMotion {
  exerciseId: string
  cameras: Record<View, CameraPreset>
  steps: Step[]
  rep?: { duration: number; keys: { t: number; pose: Pose }[] } // t in [0,1]
}

// Pose files are lazy chunks so they stay out of the catalogue bundle.
// Convention for new cases: pose files use `export default` of an ExerciseMotion, e.g.
//   case 'seated-cable-row': return (await import('./poses/seated-cable-row')).default
export async function getMotion(id: string): Promise<ExerciseMotion | undefined> {
  switch (id) {
    default:
      return undefined
  }
}
