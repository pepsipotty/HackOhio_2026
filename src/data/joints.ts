export const JOINT_NAMES = [
  'pelvis', 'spine', 'chest', 'neck', 'head',
  'shoulder_L', 'shoulder_R', 'elbow_L', 'elbow_R', 'wrist_L', 'wrist_R',
  'hip_L', 'hip_R', 'knee_L', 'knee_R', 'ankle_L', 'ankle_R',
] as const

export type JointName = (typeof JOINT_NAMES)[number]

export const JOINT_PARENT: Record<JointName, JointName | null> = {
  pelvis: null,
  spine: 'pelvis',
  chest: 'spine',
  neck: 'chest',
  head: 'neck',
  shoulder_L: 'chest',
  shoulder_R: 'chest',
  elbow_L: 'shoulder_L',
  elbow_R: 'shoulder_R',
  wrist_L: 'elbow_L',
  wrist_R: 'elbow_R',
  hip_L: 'pelvis',
  hip_R: 'pelvis',
  knee_L: 'hip_L',
  knee_R: 'hip_R',
  ankle_L: 'knee_L',
  ankle_R: 'knee_R',
}
