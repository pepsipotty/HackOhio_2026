// Draft — to be reviewed by a qualified coach before public release.
// Joint angles: Euler degrees (XYZ) relative to the standing rest pose; positive X flexes.
// See src/viewer/rig.ts for the full convention. root.position is the pelvis position.
import type { CameraPreset, ExerciseMotion, Pose, Vec3, View } from '../motion'

const STANDING: Vec3 = [0, 1.0, 0]
const SEATED: Vec3 = [0, 0.52, 0]

// Left and right sides mirror each other; only X rotations are used.
function pose(root: Vec3, spine: number, chest: number, hip: number, knee: number, shoulder: number, elbow: number): Pose {
  return {
    root: { position: root },
    joints: {
      spine: [spine, 0, 0], chest: [chest, 0, 0],
      hip_L: [hip, 0, 0], hip_R: [hip, 0, 0],
      knee_L: [knee, 0, 0], knee_R: [knee, 0, 0],
      shoulder_L: [shoulder, 0, 0], shoulder_R: [shoulder, 0, 0],
      elbow_L: [elbow, 0, 0], elbow_R: [elbow, 0, 0],
    },
  }
}

const SPINE_POSITION = pose(SEATED, 0, 0, 85, 25, 80, 0)
const THE_PULL = pose(SEATED, 0, -4, 85, 25, 15, 105)
const THE_SQUEEZE = pose(SEATED, 0, -8, 85, 25, -8, 115)

const TARGET: Vec3 = [0, 0.8, 0]
const cam = (view: View, position: Vec3): CameraPreset => ({ view, position, target: TARGET, fov: 40 })

const motion: ExerciseMotion = {
  exerciseId: 'seated-cable-row',
  cameras: {
    side: cam('side', [3.4, 1.2, 0]),
    top: cam('top', [0.01, 4.6, 0.2]),
    back: cam('back', [0, 1.4, -3.4]),
    iso: cam('iso', [2.5, 2.1, 2.5]),
  },
  steps: [
    {
      id: 'setup',
      title: 'Setup',
      instruction:
        'Find the seated cable row station and clip on the V-handle (a handle with two grips side by side). Pick a light weight — one you could lift about 15 times without straining.',
      mistake: "Starting too heavy. If you have to lean back or jerk the weight, it's too much.",
      cues: ['Choose a weight you could lift 15 times', 'Clip on the V-handle'],
      camera: 'iso',
      pose: pose(STANDING, 0, 0, 0, 0, 0, 5),
      duration: 900,
      easing: 'easeInOut',
    },
    {
      id: 'seat-and-feet',
      title: 'Seat and feet',
      instruction:
        'Sit on the bench facing the weight stack. Put your feet flat on the foot platform about hip-width apart, with a soft bend in your knees.',
      mistake: 'Locking your knees straight, which tugs your lower back into a rounded shape.',
      cues: ['Feet flat on the platform', 'Knees slightly bent'],
      camera: 'side',
      pose: pose(SEATED, 0, 0, 85, 25, 0, 10),
      duration: 900,
      easing: 'easeInOut',
    },
    {
      id: 'grip',
      title: 'Grip',
      instruction:
        'Hinge forward from your hips (bend at the hips, not the back) and take the handle with both palms facing each other. Then sit back up tall, arms straight, so the weight lifts just off the stack.',
      mistake: 'Rounding your back to reach the handle instead of hinging at the hips.',
      cues: ['Palms face each other', 'Arms long, shoulders relaxed'],
      camera: 'top',
      pose: pose(SEATED, 22, 8, 100, 25, 75, 0),
      duration: 900,
      easing: 'easeInOut',
    },
    {
      id: 'spine-position',
      title: 'Spine position',
      instruction:
        "Sit tall with a neutral spine — your back's natural, straight-ish shape, not slumped forward or leaning back. Lift your chest, let your shoulders drop away from your ears, and lightly tighten your stomach as if bracing for a gentle poke.",
      mistake: 'Slouching forward, or leaning far back to start the pull.',
      cues: ['Chest up', 'Shoulders away from your ears', 'Your upper body stays still from here'],
      camera: 'side',
      pose: SPINE_POSITION,
      duration: 900,
      easing: 'easeInOut',
    },
    {
      id: 'the-pull',
      title: 'The pull',
      instruction:
        'Pull the handle toward your upper stomach by driving your elbows straight back, keeping them close to your sides. Only your arms and shoulder blades move — your upper body stays upright.',
      mistake: 'Rocking your body backward to swing the weight.',
      cues: ['Lead with your elbows', 'Elbows brush your sides', 'Breathe out as you pull'],
      camera: 'side',
      pose: THE_PULL,
      duration: 900,
      easing: 'easeInOut',
    },
    {
      id: 'the-squeeze',
      title: 'The squeeze',
      instruction:
        'When the handle reaches your stomach, squeeze your shoulder blades (the flat bones on your upper back) together and hold for one second.',
      mistake: 'Shrugging your shoulders up toward your ears.',
      cues: ['Hold for a count of one', 'Shoulders down and back'],
      camera: 'back',
      pose: THE_SQUEEZE,
      duration: 900,
      easing: 'easeInOut',
    },
    {
      id: 'controlled-return',
      title: 'Controlled return',
      instruction:
        "Let your arms straighten slowly, taking about two seconds, until they're long again and your shoulder blades spread apart. Keep sitting tall — don't let the weight pull you forward. That's one rep!",
      mistake: 'Letting the weight snap back fast and yank you forward.',
      cues: ['Count two on the way back', 'Breathe in', 'Stay tall'],
      camera: 'iso',
      pose: SPINE_POSITION,
      duration: 900,
      easing: 'easeInOut',
    },
  ],
  rep: {
    duration: 3000,
    keys: [
      { t: 0, pose: SPINE_POSITION },
      { t: 0.4, pose: THE_PULL },
      { t: 0.55, pose: THE_SQUEEZE },
      { t: 1, pose: SPINE_POSITION },
    ],
  },
}

export default motion
