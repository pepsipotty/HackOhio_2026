export const MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core'] as const
export const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell'] as const
export const PATTERNS = ['push', 'pull', 'squat', 'hinge', 'lunge', 'carry', 'core'] as const
export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const

export type Muscle = (typeof MUSCLES)[number]
export type Equipment = (typeof EQUIPMENT)[number]
export type Pattern = (typeof PATTERNS)[number]
export type Difficulty = (typeof DIFFICULTIES)[number]

export interface Exercise {
  id: string // kebab-case; also the GIF filename media/gifs/<id>.gif
  name: string
  primary: Muscle[]
  secondary: Muscle[]
  equipment: Equipment
  pattern: Pattern
  difficulty: Difficulty
  works: string // one plain-language sentence: what it trains
  why: string // one sentence: why a beginner should do it
  built: boolean // true only for 'seated-cable-row'
}

type Row = [
  id: string, name: string, primary: Muscle[], secondary: Muscle[], equipment: Equipment,
  pattern: Pattern, difficulty: Difficulty, works: string, why: string,
]

const ROWS: Row[] = [
  ['seated-cable-row', 'Seated Cable Row', ['back'], ['biceps', 'shoulders'], 'cable', 'pull', 'beginner',
    'Strengthens your upper and middle back, plus the muscles that pull your shoulders back.',
    "It's seated and supported, so you can learn to pull with good posture before trying free weights."],
  ['lat-pulldown', 'Lat Pulldown', ['back'], ['biceps'], 'cable', 'pull', 'beginner',
    'Works your lats (the big, wing-shaped muscles along the sides of your back) as you pull a bar down.',
    'The machine guides the movement, so it is a friendly way to build toward your first pull-up.'],
  ['one-arm-dumbbell-row', 'One-Arm Dumbbell Row', ['back'], ['biceps'], 'dumbbell', 'pull', 'beginner',
    'Builds your back one side at a time by pulling a dumbbell up toward your hip.',
    'Resting a hand on a bench supports your body, so you can focus on feeling your back work.'],
  ['barbell-row', 'Barbell Row', ['back'], ['biceps', 'hamstrings'], 'barbell', 'pull', 'intermediate',
    'Builds a strong back by pulling a barbell toward your stomach while you hold a hinged-forward position.',
    'It teaches you to keep a steady, flat back under load, which helps in many other lifts.'],
  ['pull-up', 'Pull-Up', ['back'], ['biceps', 'core'], 'bodyweight', 'pull', 'advanced',
    'Strengthens your back and arms by pulling your whole body up to a bar.',
    "It's a great long-term goal, and you can start with assisted versions or lat pulldowns."],
  ['face-pull', 'Face Pull', ['shoulders'], ['back'], 'cable', 'pull', 'beginner',
    'Strengthens the back of your shoulders by pulling a rope toward your face.',
    'It balances all the pushing you do and helps keep your shoulders healthy and your posture upright.'],
  ['dumbbell-curl', 'Dumbbell Curl', ['biceps'], [], 'dumbbell', 'pull', 'beginner',
    'Builds your biceps (the muscles on the front of your upper arms) by bending your elbows.',
    "It's a simple, low-risk move that is easy to learn and easy to adjust with light weights."],
  ['hammer-curl', 'Hammer Curl', ['biceps'], [], 'dumbbell', 'pull', 'beginner',
    'Builds your biceps and forearms by curling dumbbells with your palms facing each other.',
    'Holding the weights like hammers is comfortable on your wrists and helps build grip strength.'],
  ['bench-press', 'Bench Press', ['chest'], ['triceps', 'shoulders'], 'barbell', 'push', 'intermediate',
    'Builds your chest, shoulders and triceps by pressing a barbell up while lying on a bench.',
    'It is a classic way to measure and build upper-body pushing strength once you know the basics.'],
  ['push-up', 'Push-Up', ['chest'], ['triceps', 'core'], 'bodyweight', 'push', 'beginner',
    'Builds your chest, arms and core by pressing your body up from the floor.',
    'It needs no equipment, and you can start with your knees down or your hands on a bench.'],
  ['dumbbell-bench-press', 'Dumbbell Bench Press', ['chest'], ['triceps', 'shoulders'], 'dumbbell', 'push', 'beginner',
    'Builds your chest, shoulders and triceps by pressing a dumbbell in each hand while lying on a bench.',
    'Each arm moves on its own, so it is easy to find a comfortable path and keep both sides even.'],
  ['machine-chest-press', 'Machine Chest Press', ['chest'], ['triceps'], 'machine', 'push', 'beginner',
    'Builds your chest and triceps by pushing two handles forward on a guided machine.',
    'The machine sets the path for you, so you can learn the pushing motion with very little to balance.'],
  ['overhead-press', 'Overhead Press', ['shoulders'], ['triceps', 'core'], 'barbell', 'push', 'intermediate',
    'Builds strong shoulders and triceps by pressing a barbell from your shoulders to overhead.',
    'It trains your whole upper body to push, and your core to stay steady while you do it.'],
  ['dumbbell-shoulder-press', 'Dumbbell Shoulder Press', ['shoulders'], ['triceps'], 'dumbbell', 'push', 'beginner',
    'Builds your shoulders and triceps by pressing a dumbbell in each hand overhead.',
    'Dumbbells let each arm move naturally, which is gentler on your shoulders while you learn.'],
  ['lateral-raise', 'Lateral Raise', ['shoulders'], [], 'dumbbell', 'push', 'beginner',
    'Targets the sides of your shoulders by lifting light dumbbells out to your sides.',
    'It needs only light weights, so you can learn to feel your shoulders working with little risk.'],
  ['triceps-pushdown', 'Triceps Pushdown', ['triceps'], [], 'cable', 'push', 'beginner',
    'Builds your triceps (the muscles on the back of your upper arms) by pushing a cable handle down.',
    'The cable keeps steady tension and the move is simple, so it is easy to learn and track.'],
  ['dips', 'Dips', ['triceps'], ['chest', 'shoulders'], 'bodyweight', 'push', 'advanced',
    'Builds your triceps and chest by lowering and pressing your body between two parallel bars.',
    'It is a strong bodyweight goal to work toward, and assisted dip machines can help you build up.'],
  ['standing-calf-raise', 'Standing Calf Raise', ['calves'], [], 'machine', 'push', 'beginner',
    'Builds your calves (the muscles at the back of your lower legs) by rising up onto your toes.',
    'Strong calves help with walking, running and jumping, and the movement is easy to learn.'],
  ['goblet-squat', 'Goblet Squat', ['quads'], ['glutes', 'core'], 'dumbbell', 'squat', 'beginner',
    'Builds your thighs and glutes by squatting while holding one dumbbell against your chest.',
    'Holding the weight in front helps you stay upright, which makes good squat form easier to find.'],
  ['back-squat', 'Back Squat', ['quads'], ['glutes', 'core'], 'barbell', 'squat', 'intermediate',
    'Builds your thighs, glutes and core by squatting with a barbell resting across your upper back.',
    'It lets you train your legs with heavier weight over time once your squat form is solid.'],
  ['front-squat', 'Front Squat', ['quads'], ['glutes', 'core'], 'barbell', 'squat', 'advanced',
    'Builds your thighs and core by squatting with a barbell resting across the front of your shoulders.',
    'It teaches you to stay tall and braced, and is a good next step after you are comfortable squatting.'],
  ['leg-press', 'Leg Press', ['quads'], ['glutes'], 'machine', 'squat', 'beginner',
    'Builds your thighs and glutes by pushing a weighted platform away with your feet.',
    "You're seated and supported, so you can train your legs hard without worrying about balance."],
  ['leg-extension', 'Leg Extension', ['quads'], [], 'machine', 'squat', 'beginner',
    'Isolates your quads (the big muscles on the front of your thighs) by straightening your knees against a pad.',
    'It trains your thighs on their own, which is simple to learn and easy to do with light weight.'],
  ['romanian-deadlift', 'Romanian Deadlift', ['hamstrings'], ['glutes', 'back'], 'barbell', 'hinge', 'intermediate',
    'Builds the back of your legs by hinging forward at the hips (bending there, not your back) with a barbell.',
    'It teaches the hip hinge, a key movement for lifting things safely from the floor.'],
  ['deadlift', 'Deadlift', ['hamstrings'], ['glutes', 'back'], 'barbell', 'hinge', 'advanced',
    'Builds your legs, glutes and back by lifting a barbell from the floor to standing.',
    'It is a full-body strength builder, best learned after you know the hip hinge with lighter weight.'],
  ['kettlebell-swing', 'Kettlebell Swing', ['glutes'], ['hamstrings', 'core'], 'kettlebell', 'hinge', 'intermediate',
    'Builds your glutes and hamstrings by swinging a kettlebell forward with a quick hip snap.',
    'It builds power and gets your heart rate up, and it teaches you to move from your hips.'],
  ['hip-thrust', 'Hip Thrust', ['glutes'], ['hamstrings'], 'barbell', 'hinge', 'intermediate',
    'Builds your glutes (your butt muscles) by driving your hips up while your upper back rests on a bench.',
    'It targets your glutes directly and is easy on your back, since you are supported by the bench.'],
  ['lying-leg-curl', 'Lying Leg Curl', ['hamstrings'], [], 'machine', 'hinge', 'beginner',
    'Isolates your hamstrings (the muscles on the back of your thighs) by curling your heels toward your glutes.',
    'The machine holds you in place, so it is a simple way to train the backs of your legs.'],
  ['walking-lunge', 'Walking Lunge', ['quads'], ['glutes'], 'dumbbell', 'lunge', 'beginner',
    'Builds your thighs and glutes by stepping forward into a deep step, one leg at a time.',
    'Training one leg at a time builds balance and shows you if one side is weaker.'],
  ['bulgarian-split-squat', 'Bulgarian Split Squat', ['quads'], ['glutes'], 'dumbbell', 'lunge', 'intermediate',
    'Builds your thighs and glutes by squatting on one leg with your other foot resting on a bench behind you.',
    'It trains each leg separately and builds balance, a good step up from basic lunges.'],
  ['farmers-carry', "Farmer's Carry", ['core'], ['shoulders', 'back'], 'dumbbell', 'carry', 'beginner',
    'Builds your core, grip and upper back by walking while holding a heavy dumbbell in each hand.',
    'You already know how to walk, so it builds real-world strength and good posture with little to learn.'],
  ['plank', 'Plank', ['core'], ['shoulders'], 'bodyweight', 'core', 'beginner',
    'Builds your core (the muscles around your middle) by holding your body straight, like the top of a push-up.',
    'It teaches you to brace your stomach and keep a straight body line, with no equipment needed.'],
]

export const EXERCISES: readonly Exercise[] = ROWS.map(
  ([id, name, primary, secondary, equipment, pattern, difficulty, works, why]) => ({
    id, name, primary, secondary, equipment, pattern, difficulty, works, why,
    built: id === 'seated-cable-row',
  }),
)
