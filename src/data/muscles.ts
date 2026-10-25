export const MUSCLE_NAMES: Record<string, string> = {
  'upper-trap': 'Upper trapezius', 'middle-trap': 'Middle trapezius', 'lower-trap': 'Lower trapezius',
  'rhomboid-major': 'Rhomboid major', 'rhomboid-minor': 'Rhomboid minor', latissimus: 'Latissimus dorsi',
  infraspinatus: 'Infraspinatus', 'teres-major': 'Teres major', erectors: 'Erector spinae',
  pectorals: 'Chest', abdominals: 'Abdominals', obliques: 'Obliques', deltoids: 'Shoulders',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', glutes: 'Glutes',
  quadriceps: 'Quadriceps', hamstrings: 'Hamstrings', calves: 'Calves', shins: 'Shins',
  'neck-face': 'Neck and face', 'hands-feet': 'Hands and feet',
}

// Highlight colours for the muscles an exercise works; shared by the 3D viewer and the page legend.
export const MUSCLE_TIER_COLORS = { primary: '#f6c453', secondary: '#d8bf8c' } as const
// Step focus: red flashes while a part moves into place, green once it's there.
export const FOCUS_COLORS = { changing: '#ff3b30', set: '#30d158' } as const
