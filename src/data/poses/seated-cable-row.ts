// Draft — to be reviewed by a qualified coach before public release.
// Joint angles: Euler degrees (XYZ) relative to the standing rest pose; positive X flexes.
// See src/viewer/rig.ts for the full convention. root.position is the pelvis position.
import { ROW_REFERENCE } from '../row-reference'
import type { CameraPreset, ExerciseMotion, Pose, Vec3, View } from '../motion'

const STANDING: Vec3 = [0.55, 1.0, 0] // beside the bench, so the legs don't pass through it
const SEATED: Vec3 = [0, 0.52, 0]

// Left and right sides mirror each other; only X rotations are used.
function pose(root: Vec3, spine: number, chest: number, hip: number, knee: number, shoulder: number, elbow: number, hinge = 0): Pose {
  return {
    root: { position: root },
    joints: {
      pelvis: [hinge, 0, 0], neck: [-hinge * .65, 0, 0],
      spine: [spine, 0, 0], chest: [chest, 0, 0],
      hip_L: [hip + hinge, 0, 0], hip_R: [hip + hinge, 0, 0],
      knee_L: [knee, 0, 0], knee_R: [knee, 0, 0],
      shoulder_L: [shoulder, 0, 0], shoulder_R: [shoulder, 0, 0],
      elbow_L: [elbow, 0, 0], elbow_R: [elbow, 0, 0],
    },
  }
}

const SPINE_POSITION = pose(SEATED, 0, 2, 85, 25, 90, 5, 24)
const THE_PULL = pose(SEATED, 0, -2, 85, 25, -5, 100, -6)
const THE_SQUEEZE = pose(SEATED, 0, -2, 85, 25, -8, 104, -8)

const TARGET: Vec3 = [0, 0.8, 0]
const cam = (view: View, position: Vec3): CameraPreset => ({ view, position, target: TARGET, fov: 40 })

const motion: ExerciseMotion = {
  exerciseId: 'seated-cable-row',
  cameras: {
    side: { view: 'side', position: [4.6, 1.6, .7], target: [0, .95, .7], fov: 40 },
    // looking down from just behind the head, so the figure faces up the screen toward the stack
    top: { view: 'top', position: [0.01, 4.6, 0.1], target: [0, 0.8, 0.3], fov: 40 },
    back: cam('back', [0, 1.4, -3.4]),
    // from behind and to the right, so the whole station (bench to weight stack) is in frame
    iso: { view: 'iso', position: [4.2, 2.8, -3.1], target: [0, 1.05, .8], fov: 40 },
  },
  steps: [
    {
      id: 'setup',
      title: 'Setup',
      instruction:
        'Find the seated cable row station and clip on the V-handle (a handle with two grips side by side). Slide the pin into a light weight, one you could pull about 15 times with steady form.',
      mistake: "Starting too heavy. If you have to lean back or jerk the weight, it's too much.",
      cues: ['Pick a weight you could pull 15 times', 'Clip on the V-handle'],
      camera: 'iso',
      pose: pose(STANDING, 0, 0, 0, 0, 0, 5),
      duration: 1100,
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
      duration: 1100,
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
      // The pelvis leads the reach; hip counter-rotation and foot support keep the feet planted.
      pose: pose(SEATED, 0, 4, 85, 25, 75, 0, 30),
      duration: 1100,
      easing: 'easeInOut',
    },
    {
      id: 'spine-position',
      title: 'Spine position',
      instruction:
        "Sit tall with a neutral spine — your back's natural, straight-ish shape, not slumped forward or leaning back. Lift your chest, let your shoulders drop away from your ears, and lightly tighten your stomach as if bracing for a gentle poke.",
      mistake: 'Slouching forward, or leaning far back to start the pull.',
      cues: ['Chest up', 'Shoulders away from your ears', 'Keep the torso movement small'],
      camera: 'side',
      pose: SPINE_POSITION,
      duration: 1100,
      easing: 'easeInOut',
    },
    {
      id: 'the-pull',
      title: 'The pull',
      instruction:
        'Pull the handle toward your upper stomach by driving your elbows straight back, keeping them close to your sides. Let your elbows travel behind your ribs with a small, controlled torso hinge.',
      mistake: 'Rocking your body backward to swing the weight.',
      cues: ['Lead with your elbows', 'Elbows brush your sides', 'Breathe out as you pull'],
      camera: 'side',
      pose: THE_PULL,
      duration: 1100,
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
      duration: 1100,
      easing: 'easeInOut',
    },
    {
      id: 'controlled-return',
      title: 'Controlled return',
      instruction:
        "Slowly let your arms straighten, taking a little longer than the pull, until they are long again and your shoulder blades spread apart a little. Keep sitting tall and don't let the weight pull you forward. That's one rep (one full pull and return)! When your set is done, guide the handle back slowly and rest the weight on the stack before you let go.",
      mistake: 'Letting the weight snap back fast and yank you forward, or letting go of the handle while the weight is still up.',
      cues: ['Return more slowly than you pull', 'Breathe in', 'Stay tall'],
      camera: 'iso',
      pose: SPINE_POSITION,
      duration: 1100,
      easing: 'easeInOut',
    },
  ],
  rep: {
    duration: ROW_REFERENCE.duration,
    keys: [
      { t: 0, pose: SPINE_POSITION },
      { t: ROW_REFERENCE.pullEnd, pose: THE_SQUEEZE },
      { t: ROW_REFERENCE.holdEnd, pose: THE_SQUEEZE },
      { t: ROW_REFERENCE.returnEnd, pose: SPINE_POSITION },
      { t: 1, pose: SPINE_POSITION },
    ],
  },
}

export default motion
