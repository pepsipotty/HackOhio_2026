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
// Seated, the thighs open slightly (degrees) so the knees track out over the feet instead of caving in,
// and the shins pass beside the front of the pad.
const HIP_OUT = 11
/** Seated hip angles: flexion plus the outward opening, mirrored. */
const hips = (flex: number, out = HIP_OUT): { hip_L: Vec3; hip_R: Vec3 } => ({ hip_L: [flex, 0, -out], hip_R: [flex, 0, out] })

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
// Sitting tall with the arms long: the torso just off vertical, the hands held a little below the chest.
const SPINE_POSITION: Pose = { ...pose(SEATED, 0, 2, 85, 25, 74, 5, 16), handle: HELD }
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
/** Walking torso: the hips turn with the swinging leg (degrees, +Y left), the chest turns back against them. */
const gait = (yaw: number): KeyPose['joints'] => ({ pelvis: [0, yaw, 0], spine: [3, 0, 0], chest: [0, -yaw * 1.2, 0], neck: [-2, 0, 0] })
const asKeyPose = (p: Pose): KeyPose => ({ root: p.root?.position, joints: p.joints, scapula: p.scapula ?? 0 })

// ---- step 2: walk two steps to the bench, step over it, sit, and lift the feet onto the plates ----
const L0 = [START[0] + .153, START[2] - .062] as const, R0 = [START[0] - .153, START[2] - .062] as const
const WALK_IN: Keyframe[] = [
  // weight onto the left foot, right heel starts to rise; the body settles a little into the first step
  k(200, { root: [.57, .985, -1.19], feet: { L: flat(...L0), R: heelUp(...R0, 8) }, joints: gait(1) }),
  k(380, { root: [.585, .97, -1.15], feet: { R: heelUp(...R0, 30) }, joints: { ...gait(3), ...arms(8, -6, 18, 12) } }),
  // right foot swings through over a softly bent standing knee; the left arm swings forward, the hips turn with the leg
  k(560, { root: [.585, .985, -1.03], feet: { R: air(.35, .165, -1.05, -8) }, joints: { ...legs('R', [30, 0, 0], 50), ...legs('L', [0, 0, 0], 5), ...arms(20, -14, 26, 12), ...gait(5) } }),
  // heel strike: both feet down, the body at its lowest, arms at the ends of their swing
  k(740, { root: [.52, .955, -.91], feet: { L: flat(...L0), R: toesUp(.3, -.8, 14) }, joints: { ...legs('R', [20, 0, 0], 5), ...arms(22, -16, 28, 12), ...gait(4) } }),
  k(840, { root: [.49, .96, -.85], feet: { R: flat(.3, -.8), L: heelUp(...L0, 22) } }),
  k(940, { root: [.47, .97, -.79], feet: { L: heelUp(...L0, 38) }, joints: { ...arms(4, 2, 18, 18), ...gait(0) } }),
  // left foot swings through
  k(1120, { root: [.46, .985, -.65], feet: { L: air(.67, .165, -.78, -8) }, joints: { ...legs('L', [30, 0, 0], 50), ...legs('R', [0, 0, 0], 5), ...arms(-14, 20, 12, 26), ...gait(-5) } }),
  k(1300, { root: [.47, .955, -.47], feet: { R: flat(.3, -.8), L: toesUp(.6, -.3, 14) }, joints: { ...legs('L', [20, 0, 0], 5), ...arms(-16, 22, 12, 28), ...gait(-4) } }),
  k(1400, { root: [.47, .96, -.41], feet: { L: flat(.6, -.3), R: heelUp(.3, -.8, 22) } }),
  k(1500, { root: [.47, .97, -.35], feet: { R: heelUp(.3, -.8, 38) }, joints: { ...arms(2, 4, 18, 18), ...gait(0) } }),
  // right foot through, landing beside the bench; slowing down, so the swings get smaller
  k(1680, { root: [.47, .985, -.22], feet: { R: air(.27, .165, -.39, -8) }, joints: { ...legs('R', [30, 0, 0], 50), ...legs('L', [0, 0, 0], 5), ...arms(16, -10, 24, 12), ...gait(4) } }),
  k(1860, { root: [.41, .96, -.06], feet: { L: flat(.6, -.3), R: toesUp(.23, .02, 12) }, joints: { ...legs('R', [15, 0, 0], 5), ...arms(14, -8, 22, 12), ...gait(3) } }),
  k(1960, { root: [.4, .965, -.01], feet: { R: flat(.23, .02), L: heelUp(.6, -.3, 18) } }),
  // a short step to bring the left foot alongside, and stand, looking down at the bench
  k(2160, { root: [.39, .98, .04], feet: { L: air(.56, .13, -.14, -5) }, joints: { ...legs('L', [20, 0, 0], 35), ...arms(4, 2, 14, 12), ...gait(-1) } }),
  k(2340, { root: [.38, .985, .07], feet: { L: flat(.53, .02) }, joints: { ...legs('L', [5, 0, 0], 5), ...legs('R', [5, 0, 0], 5), ...arms(0, 0, 10, 10), pelvis: [0, 0, 0], spine: [2, 0, 0], chest: [0, 0, 0], neck: [8, 0, 0] } }),
  k(2500, { root: [.38, .99, .08] }),
  // shift onto the left foot and swing the right leg up and over the bench pad
  k(2750, { root: [.45, .985, .08], feet: { R: heelUp(.23, .02, 15) }, joints: { ...arms(5, 5, 14, 14, 14), spine: [4, 0, 0], neck: [12, 0, 0] } }),
  k(3000, { root: [.46, .98, .08], feet: { R: air(.23, .55, .11, 6) }, joints: legs('R', [75, 0, 12], 100) }),
  k(3250, { root: [.44, .98, .08], feet: { R: air(.07, .7, .15, -2) }, joints: { ...legs('R', [80, 0, 22], 100), ...arms(10, 4, 20, 16, 22), spine: [9, 0, 0], neck: [16, 0, 0] } }),
  k(3500, { root: [.36, .975, .08], feet: { R: air(-.17, .66, .15, 0) }, joints: legs('R', [60, 0, 32], 80) }),
  k(3750, { root: [.24, .93, .08], feet: { R: air(-.29, .27, .08, 0) }, joints: { ...legs('R', [32, 0, 44], 50), ...arms(6, 6, 16, 16, 14), spine: [5, 0, 0], neck: [10, 0, 0] } }),
  k(3950, { root: [.13, .87, .08], feet: { L: flat(.53, .02), R: flat(-.29, .05) }, joints: legs('R', [18, 0, 44], 32) }),
  // weight onto the right foot; the left steps in, so the bench is between the feet
  k(4150, { root: [.05, .885, .08], feet: { L: heelUp(.53, .02, 15) }, joints: { ...legs('L', [5, 0, 0], 5), ...legs('R', [16, 0, 40], 28) } }),
  k(4350, { feet: { L: air(.42, .16, .05, -5) }, joints: legs('L', [25, 0, -6], 45) }),
  k(4550, { root: [0, .95, .08], feet: { L: flat(.29, .05) }, joints: { ...legs('L', [5, 0, -12], 8), ...arms(0, 0, 10, 10, 4) } }),
  k(4700, { root: [0, .955, .08], joints: { pelvis: [0, 0, 0], spine: [2, 0, 0], chest: [0, 0, 0], neck: [6, 0, 0] } }),
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

// ---- step 3: stay on the seat; let the knees fall apart so the arms have room, and fold forward from the hips
// between them to the handle on the footplate bar. The left hand takes it, the right a beat later; then sit up
// tall with the arms long as the knees come back in. ----
const KNEES_APART = 26
const GRIP_IN: Keyframe[] = [
  // the hands lift off beside the pad first, clearing the thighs, then come in as the knees start to part
  k(250, { joints: arms(14, 12, 48, 48, 8) }),
  k(450, {
    joints: { pelvis: [18, 0, 0], spine: [5, 0, 0], neck: [-10, 0, 0], ...hips(103, 20), ...arms(30, 28, 55, 55, -16) },
  }),
  // folding forward between the knees, hands reaching out over the knees and past the end of the pad, the left leading
  k(900, {
    handle: { left: 0 },
    joints: { pelvis: [44, 0, 0], spine: [11, -4, 0], chest: [5, 0, 0], neck: [-26, 0, 0], ...hips(129, KNEES_APART), ...arms(106, 98, 10, 16, -8) },
  }),
  // full reach, looking at the handle; the left hand drops onto it, the right hovers just above
  k(1250, {
    handle: { left: 1, right: 0 },
    joints: { pelvis: [62, 0, 0], spine: [14, -5, 0], chest: [8, 0, 0], neck: [-36, 0, 0], ...hips(147, KNEES_APART), shoulder_L: [118, 0, 4], shoulder_R: [122, 0, -10], elbow_L: [6, 0, 0], elbow_R: [20, 0, 0] },
  }),
  k(1550, { joints: { spine: [14, 0, 0], shoulder_R: [118, 0, -6], elbow_R: [8, 0, 0] } }),
  k(1600, { handle: { right: 1 } }),
  // both hands on: a short pause, then lift it up off the bar and sit up, knees drifting back in
  k(1800, { handle: { carry: 0 }, joints: { pelvis: [62, 0, 0], neck: [-36, 0, 0], ...hips(147, KNEES_APART) } }),
  k(2100, { handle: { carry: .6 }, joints: { pelvis: [57, 0, 0], spine: [12, 0, 0], neck: [-33, 0, 0], ...hips(142, 24), ...arms(116, 116, 4, 4) } }),
  k(2300, { handle: { carry: 1 } }),
  k(2450, {
    joints: { pelvis: [42, 0, 0], spine: [6, 0, 0], chest: [5, 0, 0], neck: [-26, 0, 0], ...hips(127, 18), ...arms(86, 86, 3, 3) },
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
        'Let your knees fall apart a little to make room for your arms, hinge forward from your hips (bend at the hips, not the back) and take the handle with both palms facing each other. Then sit back up tall, knees softly bent, arms straight, so the weight lifts off the stack.',
      mistake: 'Rounding your back to reach the handle instead of hinging at the hips.',
      cues: ['Palms face each other', 'Arms long, shoulders relaxed'],
      camera: 'top',
      // The pelvis leads the reach; hip counter-rotation and foot support keep the feet planted.
      pose: GRIP,
      focus: { parts: ['hands', 'handle'], start: 300 },
      // Watch the reach from the side (left hand nearest), then look down once he sits up with it.
      enter: { duration: 3200, keys: GRIP_IN, camera: { view: 'side', until: 2300 } },
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
