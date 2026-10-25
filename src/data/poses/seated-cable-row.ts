// Joint angles: Euler degrees (XYZ) relative to the standing rest pose; positive X flexes.
// See src/viewer/rig.ts for the full convention. root.position is the pelvis position.
// Facing +Z (toward the stack), left is +X: -Z abducts the left hip or shoulder, +Z the right; +Y turns left.
import { ROW_REFERENCE } from '../row-reference'
import { ANKLE_HEIGHT, footplateTarget } from '../row-station'
import type { ExerciseMotion, FootTarget, HandleState, Keyframe, KeyPose, Pose, Vec3 } from '../motion'

// Two steps back from where he sits, so the handle and stack are in view from the iso camera.
const START: Vec3 = [0.55, 1.0, -1.2]
// Far enough back on the pad that the backs of the thighs rest along it and the knees are only softly bent;
// a touch higher than the pelvis's resting height so the thighs lie on the pad rather than sink into it.
const SEATED: Vec3 = [0, 0.545, -0.02]
// Scooted forward on the pad, knees bent, to reach the handle on the footplate bar.
const REACH_Z = 0.28, REACH_Y = 0.53
// Seated, the thighs open slightly (degrees) so the knees track out over the feet instead of caving in,
// and the shins pass beside the front of the pad.
const HIP_OUT = 11
/** Seated hip angles: flexion plus the outward opening, mirrored. */
const hips = (flex: number): { hip_L: Vec3; hip_R: Vec3 } => ({ hip_L: [flex, 0, -HIP_OUT], hip_R: [flex, 0, HIP_OUT] })

// Left and right sides mirror each other. abduct takes the elbows out from the sides (degrees).
function pose(root: Vec3, spine: number, chest: number, hip: number, knee: number, shoulder: number, elbow: number, hinge = 0, abduct = 0): Pose {
  return {
    root: { position: root },
    joints: {
      pelvis: [hinge, 0, 0], neck: [-hinge * .65, 0, 0],
      spine: [spine, 0, 0], chest: [chest, 0, 0],
      ...(root[1] < .7 ? hips(hip + hinge) : { hip_L: [hip + hinge, 0, 0], hip_R: [hip + hinge, 0, 0] }),
      knee_L: [knee, 0, 0], knee_R: [knee, 0, 0],
      shoulder_L: [shoulder, 0, -abduct], shoulder_R: [shoulder, 0, abduct],
      elbow_L: [elbow, 0, 0], elbow_R: [elbow, 0, 0],
    },
  }
}

// ---- planted feet (FootTarget: ankle position above the floor, toes-up pitch, IK weight) ----
const DEG = Math.PI / 180
const TOE_AHEAD = 0.134, TOE_DROP = 0.0915, HEEL_BEHIND = 0.058 // ball of the foot and heel, from the ankle
/** Foot flat on the floor; z is the ankle's. */
const flat = (x: number, z: number): FootTarget => [x, ANKLE_HEIGHT, z, 0, 1]
/** Heel lifting, rolling over the ball of the foot (push-off). z is where the ankle sits with the foot flat. */
const heelUp = (x: number, z: number, deg: number): FootTarget => {
  const a = deg * DEG
  return [x, ANKLE_HEIGHT - TOE_DROP + TOE_DROP * Math.cos(a) + TOE_AHEAD * Math.sin(a), z + TOE_AHEAD - TOE_AHEAD * Math.cos(a) + TOE_DROP * Math.sin(a), -deg, 1]
}
/** Toes up, rocking on the heel (heel strike). */
const toesUp = (x: number, z: number, deg: number): FootTarget => {
  const a = deg * DEG
  return [x, ANKLE_HEIGHT * Math.cos(a) + HEEL_BEHIND * Math.sin(a), z - HEEL_BEHIND + HEEL_BEHIND * Math.cos(a) - ANKLE_HEIGHT * Math.sin(a), deg, 1]
}
const air = (x: number, y: number, z: number, pitch = 0): FootTarget => [x, y, z, pitch, 1]
const PLATE_L = footplateTarget('L'), PLATE_R = footplateTarget('R')

const ON_PAD: HandleState = { carry: 0, left: 0, right: 0 }
const HELD: HandleState = { carry: 1, left: 1, right: 1 }

// ---- step poses ----
const STANDING: Pose = {
  ...pose(START, 0, 0, 0, 0, 0, 5),
  feet: { L: flat(START[0] + .153, START[2] - .062), R: flat(START[0] - .153, START[2] - .062) },
  handle: ON_PAD,
}
// Hands hang just outside the pad's edges.
const SEAT_AND_FEET: Pose = { ...pose(SEATED, 0, 0, 85, 25, 0, 10, 0, 10), handle: ON_PAD }
const GRIP: Pose = { ...pose(SEATED, 0, 4, 85, 25, 75, 0, 30), handle: HELD }
const SPINE_POSITION = pose(SEATED, 0, 2, 85, 25, 90, 5, 24)
// Elbows travel back just outside the ribs, so the forearms pass beside the torso and the hands stop in front of it.
const THE_PULL: Pose = { ...pose(SEATED, 0, -2, 85, 25, 7, 81, -6, 22), scapula: 8 }
// The squeeze: shoulder blades pinch together and the chest lifts a touch, elbows drift just behind the torso.
const THE_SQUEEZE: Pose = { ...pose(SEATED, 0, -5, 85, 25, -3, 85, -8, 25), scapula: 20 }
// After the return the shoulder blades spread apart a little.
const RETURNED: Pose = { ...SPINE_POSITION, scapula: -5 }
// The common fault for the spine step: rounded through the lower and upper back.
const SLUMPED = pose(SEATED, 16, 20, 85, 25, 85, 5, 12)

const k = (at: number, p: KeyPose): Keyframe => ({ at, pose: p })
const legs = (side: 'L' | 'R', hip: [number, number, number], knee: number): KeyPose['joints'] =>
  side === 'L' ? { hip_L: hip, knee_L: [knee, 0, 0] } : { hip_R: hip, knee_R: [knee, 0, 0] }
const arms = (l: number, r: number, el = 15, er = 15, abduct = 0): KeyPose['joints'] => ({
  shoulder_L: [l, 0, -abduct], shoulder_R: [r, 0, abduct], elbow_L: [el, 0, 0], elbow_R: [er, 0, 0],
})
const asKeyPose = (p: Pose): KeyPose => ({ root: p.root?.position, joints: p.joints, scapula: p.scapula ?? 0 })

// ---- step 2: walk two steps to the bench, step over it, sit, and lift the feet onto the plates ----
const L0 = [START[0] + .153, START[2] - .062] as const, R0 = [START[0] - .153, START[2] - .062] as const
const WALK_IN: Keyframe[] = [
  // weight onto the left foot, right heel starts to rise
  k(200, { root: [.57, .995, -1.19], feet: { L: flat(...L0), R: heelUp(...R0, 8) } }),
  k(380, { root: [.585, .99, -1.15], feet: { R: heelUp(...R0, 30) } }),
  // right foot swings through; the opposite arm swings forward
  k(560, { root: [.585, 1, -1.03], feet: { R: air(.35, .165, -1.05, -8) }, joints: { ...legs('R', [30, 0, 0], 50), ...legs('L', [0, 0, 0], 5), ...arms(14, -10, 18, 12) } }),
  k(740, { root: [.52, .97, -.91], feet: { L: flat(...L0), R: toesUp(.3, -.8, 14) }, joints: legs('R', [20, 0, 0], 5) }),
  k(840, { root: [.49, .975, -.85], feet: { R: flat(.3, -.8), L: heelUp(...L0, 22) } }),
  k(940, { root: [.47, .985, -.79], feet: { L: heelUp(...L0, 38) } }),
  // left foot swings through
  k(1120, { root: [.46, 1, -.65], feet: { L: air(.67, .165, -.78, -8) }, joints: { ...legs('L', [30, 0, 0], 50), ...legs('R', [0, 0, 0], 5), ...arms(-10, 14, 12, 18) } }),
  k(1300, { root: [.47, .97, -.47], feet: { R: flat(.3, -.8), L: toesUp(.6, -.3, 14) }, joints: legs('L', [20, 0, 0], 5) }),
  k(1400, { root: [.47, .975, -.41], feet: { L: flat(.6, -.3), R: heelUp(.3, -.8, 22) } }),
  k(1500, { root: [.47, .985, -.35], feet: { R: heelUp(.3, -.8, 38) } }),
  // right foot through, landing beside the bench
  k(1680, { root: [.47, 1, -.22], feet: { R: air(.27, .165, -.39, -8) }, joints: { ...legs('R', [30, 0, 0], 50), ...legs('L', [0, 0, 0], 5), ...arms(14, -10, 18, 12) } }),
  k(1860, { root: [.41, .975, -.06], feet: { L: flat(.6, -.3), R: toesUp(.23, .02, 12) }, joints: legs('R', [15, 0, 0], 5) }),
  k(1960, { root: [.4, .98, -.01], feet: { R: flat(.23, .02), L: heelUp(.6, -.3, 18) } }),
  // a short step to bring the left foot alongside, and stand
  k(2160, { root: [.39, .995, .04], feet: { L: air(.56, .13, -.14, -5) }, joints: { ...legs('L', [20, 0, 0], 35), ...arms(4, 2, 10, 10) } }),
  k(2340, { root: [.38, 1, .07], feet: { L: flat(.53, .02) }, joints: { ...legs('L', [5, 0, 0], 5), ...legs('R', [5, 0, 0], 5), ...arms(0, 0, 8, 8) } }),
  k(2500, { root: [.38, 1, .08] }),
  // shift onto the left foot and swing the right leg up and over the bench pad
  k(2750, { root: [.45, .985, .08], feet: { R: heelUp(.23, .02, 15) }, joints: arms(5, 5, 12, 12, 14) }),
  k(3000, { root: [.46, .98, .08], feet: { R: air(.21, .36, .11, -12) }, joints: legs('R', [70, 0, 10], 95) }),
  k(3250, { root: [.44, .98, .08], feet: { R: air(.07, .66, .15, -2) }, joints: legs('R', [80, 0, 22], 100) }),
  k(3500, { root: [.36, .975, .08], feet: { R: air(-.17, .64, .15, 0) }, joints: legs('R', [60, 0, 28], 80) }),
  k(3750, { root: [.24, .95, .08], feet: { R: air(-.29, .27, .08, 0) }, joints: legs('R', [25, 0, 18], 30) }),
  k(3950, { root: [.13, .92, .08], feet: { L: flat(.53, .02), R: flat(-.29, .05) }, joints: legs('R', [5, 0, 12], 8) }),
  // weight onto the right foot; the left steps in, so the bench is between the feet
  k(4150, { root: [.05, .93, .08], feet: { L: heelUp(.53, .02, 15) }, joints: legs('L', [5, 0, 0], 5) }),
  k(4350, { feet: { L: air(.42, .16, .05, -5) }, joints: legs('L', [25, 0, -6], 45) }),
  k(4550, { root: [0, .95, .08], feet: { L: flat(.29, .05) }, joints: { ...legs('L', [5, 0, -12], 8), ...arms(0, 0, 10, 10, 4) } }),
  k(4700, { root: [0, .955, .08], joints: { pelvis: [0, 0, 0], spine: [0, 0, 0], neck: [0, 0, 0] } }),
  // sit back and down: lean forward for balance, arms forward, then upright on the bench
  k(5200, {
    root: [0, .74, .03],
    joints: { pelvis: [24, 0, 0], spine: [8, 0, 0], neck: [-14, 0, 0], ...legs('L', [55, 0, -12], 70), ...legs('R', [55, 0, 12], 70), ...arms(28, 28, 20, 20, 6) },
  }),
  k(5700, {
    root: SEATED, feet: { L: flat(.29, .08), R: flat(-.29, .08) },
    joints: { pelvis: [4, 0, 0], spine: [0, 0, 0], neck: [-2, 0, 0], ...legs('L', [85, 0, -20], 95), ...legs('R', [85, 0, 20], 95), ...arms(10, 10, 15, 15) },
  }),
  // left foot, then right, up and forward onto the footplates; the legs reach out to a soft bend
  k(5900, { feet: { L: heelUp(.29, .08, 10) } }),
  k(6150, { feet: { L: air(.26, .3, .3, 18), R: heelUp(-.29, .08, 10) }, joints: legs('L', [75, 0, -22], 70) }),
  k(6400, { feet: { L: air(.18, .33, .56, 48), R: air(-.26, .3, .3, 18) }, joints: legs('R', [75, 0, 22], 70) }),
  k(6600, { feet: { L: PLATE_L }, joints: legs('L', [85, 0, -HIP_OUT], 25) }),
  k(6650, { feet: { R: air(-.18, .33, .56, 48) } }),
  k(6850, { feet: { R: PLATE_R }, joints: legs('R', [85, 0, HIP_OUT], 25) }),
]

// ---- step 3: bend the knees to scoot forward and lean to the handle on the footplate bar; the left hand takes it,
// the right a beat later; then push back with the legs to the seat and sit up tall, arms long ----
const GRIP_IN: Keyframe[] = [
  k(550, {
    root: [0, REACH_Y, .1],
    joints: { pelvis: [16, 0, 0], spine: [5, -4, 0], neck: [-12, 0, 0], ...hips(101), ...arms(58, 40, 12, 18) },
  }),
  // hands forward over the knees, clear of the pad, before reaching down past its front end
  k(850, {
    root: [0, REACH_Y, .21], handle: { left: 0 },
    joints: { pelvis: [30, 0, 0], spine: [9, -5, 0], neck: [-20, 0, 0], ...hips(115), shoulder_L: [66, 0, 4], shoulder_R: [48, 0, 0], elbow_L: [6, 0, 0], elbow_R: [16, 0, 0] },
  }),
  k(1150, {
    root: [0, REACH_Y, REACH_Z],
    joints: {
      pelvis: [44, 0, 0], spine: [14, -6, 0], chest: [8, 0, 0], neck: [-30, 0, 0], ...hips(129),
      shoulder_L: [58, 0, 4], shoulder_R: [34, 0, 0], elbow_L: [6, 0, 0], elbow_R: [22, 0, 0],
    },
  }),
  k(1250, { handle: { left: 1, right: 0 } }),
  k(1550, { joints: { spine: [14, 0, 0], shoulder_R: [58, 0, -4], elbow_R: [6, 0, 0] } }),
  k(1600, { handle: { right: 1 } }),
  // both hands on: lift it off the bar and sit up a little
  k(1800, { root: [0, REACH_Y, REACH_Z], handle: { carry: 0 }, joints: { pelvis: [44, 0, 0], shoulder_L: [58, 0, 4], shoulder_R: [58, 0, -4], neck: [-30, 0, 0] } }),
  k(2350, {
    root: [0, REACH_Y, .22], handle: { carry: 1 },
    joints: { pelvis: [38, 0, 0], spine: [6, 0, 0], chest: [6, 0, 0], neck: [-24, 0, 0], ...hips(123), ...arms(66, 66, 3, 3) },
  }),
  // the legs push the hips back along the pad, arms long, until the knees are only softly bent
  k(3050, {
    root: [0, SEATED[1], .01],
    joints: { pelvis: [32, 0, 0], spine: [2, 0, 0], chest: [5, 0, 0], neck: [-20, 0, 0], ...hips(117), ...arms(72, 72, 1, 1) },
  }),
]

const motion: ExerciseMotion = {
  exerciseId: 'seated-cable-row',
  cameras: {
    side: { view: 'side', position: [3.5, 1.4, .35], target: [0, .95, .35], fov: 40 },
    // looking down from just behind the head, so the figure faces up the screen toward the stack
    top: { view: 'top', position: [0.01, 4.6, -0.12], target: [0, 0.8, 0.08], fov: 40 },
    back: { view: 'back', position: [0, 1.35, -2.8], target: [0, 0.9, -0.2], fov: 40 },
    // from behind and to the right, framed on the figure with the stack still in view
    // from behind and to the right: the figure at its start, the handle on the footplate bar and the stack all in view
    iso: { view: 'iso', position: [3.75, 2.2, -2.0], target: [.2, .8, -.2], fov: 40 },
  },
  steps: [
    {
      id: 'setup',
      title: 'Setup',
      instruction:
        'Find the seated cable row station and clip on the V-handle (a handle with two grips side by side). Slide the pin into a weight you could pull 6â€“8 times with steady form.',
      mistake: "Starting too heavy. If you have to lean back or jerk the weight, it's too much.",
      cues: ['Pick a weight you could pull 6â€“8 times', 'Clip on the V-handle'],
      camera: 'iso',
      pose: STANDING,
      focus: { parts: ['weight-pin', 'handle'], duration: 2400 },
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
      pose: SEAT_AND_FEET,
      // The feet flash once they start for the footplates.
      focus: { parts: ['feet', 'footplates'], start: 5850 },
      enter: { duration: 7100, keys: WALK_IN, camera: { view: 'iso', until: 5000 } },
      duration: 1100,
      easing: 'easeInOut',
    },
    {
      id: 'grip',
      title: 'Grip',
      instruction:
        'Bend your knees to slide forward, hinge from your hips (bend at the hips, not the back) and take the handle with both palms facing each other. Then push back with your legs until your knees are only softly bent, and sit up tall, arms straight, so the weight lifts off the stack.',
      mistake: 'Rounding your back to reach the handle instead of hinging at the hips.',
      cues: ['Palms face each other', 'Arms long, shoulders relaxed'],
      camera: 'top',
      // The pelvis leads the reach; hip counter-rotation and foot support keep the feet planted.
      pose: GRIP,
      focus: { parts: ['hands', 'handle'], start: 300 },
      // Watch the reach and the push back from the side (left hand nearest), then look down once seated.
      enter: { duration: 3700, keys: GRIP_IN, camera: { view: 'side', until: 3100 } },
      duration: 1100,
      easing: 'easeInOut',
    },
    {
      id: 'spine-position',
      title: 'Spine position',
      instruction:
        "Sit tall with a neutral spine â€” your back's natural, straight-ish shape, not slumped forward or leaning back. Lift your chest, let your shoulders drop away from your ears, and lightly tighten your stomach as if bracing for a gentle poke.",
      mistake: 'Slouching forward, or leaning far back to start the pull.',
      cues: ['Chest up', 'Shoulders away from your ears', 'Keep the torso movement small'],
      camera: 'side',
      pose: SPINE_POSITION,
      // Slumps first so the spine visibly straightens; the body fades so the spine shows through.
      focus: { parts: ['spine'], xray: true },
      enter: { duration: 2800, keys: [k(900, asKeyPose(SLUMPED)), k(1400, asKeyPose(SLUMPED))] },
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
      focus: { parts: ['arms'] },
      // Elbows lead; the shoulder blades start to draw back as the handle comes in.
      enter: { duration: 1300, keys: [k(450, { ...asKeyPose(pose(SEATED, 0, 0, 85, 25, 50, 50, 10, 12)), scapula: 4 })] },
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
      focus: { parts: ['shoulder-blades'] },
      // Squeeze the shoulder blades together, then hold for a count of one.
      enter: { duration: 1650, keys: [k(650, asKeyPose(THE_SQUEEZE))] },
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
      pose: RETURNED,
      focus: { parts: ['arms'] },
      // Slower than the pull, as the instruction says; the shoulder blades release first.
      enter: { duration: 2800, keys: [k(600, { ...asKeyPose(pose(SEATED, 0, -1, 85, 25, 14, 80, -4, 20)), scapula: 9 })] },
      duration: 1100,
      easing: 'easeInOut',
    },
  ],
  // Muscles worked by the row, highlighted on the humanoid. Ids match src/data/muscles.ts.
  muscles: {
    primary: ['latissimus', 'middle-trap', 'rhomboid-major', 'rhomboid-minor'],
    // upper-trap is listed so it stays visible: unlisted covering muscles are hidden to expose the deep layer
    secondary: ['upper-trap', 'lower-trap', 'teres-major', 'infraspinatus', 'deltoids', 'biceps', 'forearms', 'erectors'],
  },
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
