# Rep One — Design Spec

Date: 2026-10-24
Status: Approved in brainstorming, pending written-spec review
Context: HackOhio 2026 proof of concept

## 1. Intent

**What it is.** Rep One is a web-based learning tool that teaches beginner weightlifters proper form with an interactive 3D human model. Each exercise is broken into steps. On each step the camera animates to the best viewing angle and the model's joints animate to the correct posture.

**Who it is for.** Beginner lifters learning form for the first time. All copy is plain-language and encouraging, and defines every term it uses. No intimidating or gym-bro tone.

**Success criteria.** A polished, reliable **live hackathon demo** in front of judges, on a Windows laptop running Chrome or Edge (Chromium), shown on the laptop screen (no projector). The demo path is: landing → catalogue → Seated Cable Row → step through all 7 steps, switch camera presets, play the rep. Firefox and Safari get correct fallbacks but are not the optimisation target.

**Scope.** End-to-end flow for the **Seated Cable Row** only. Every other exercise opens a styled "Coming soon" page.

### Decisions made in brainstorming

| Decision | Choice |
|---|---|
| Success target | Live demo (option A) |
| Demo platform | Windows + Chromium, laptop screen |
| Name | **Rep One** |
| Visual direction | **One bold colour**: a single saturated colour floods each page; white type; glass buttons; minimal competing elements. Details settled in the Phase 2 plan's design section. |
| Stack | Vite + TypeScript + Three.js, multi-page, no framework |

### Assumptions (not stated by the user)

- No backend, no accounts, no persistence beyond URL state.
- Demo runs from `vite preview` (or `vite dev`) on the presenter laptop; deployment is out of scope.
- Real 3D model, GIFs, demo video and movement guides arrive later; this build ships labelled placeholders.

## 2. Architecture

Three real HTML pages. Native cross-document View Transitions handle page transitions. Only the detail page loads Three.js.

```
HackOhio_2026/
  index.html            landing
  catalogue.html        catalogue
  exercise.html         detail (?id=seated-cable-row); unbuilt ids → "Coming soon"; unknown → not found
  public/
    media/gifs/<exercise-id>.gif      drop-in GIFs by filename
    media/video/demo.mp4 + demo-poster.jpg
    models/human.glb                  drop-in rigged model (optional)
  src/
    styles/        tokens.css, glass.css, base.css, transitions.css
    data/
      exercises.ts                single typed source of truth (32 exercises)
      poses/seated-cable-row.ts   steps, camera presets, poses, rep track
    lib/
      catalogue.ts      pure filter / sort / pin / URL-param logic
      tween.ts          easing + interpolation
      steps.ts          step state machine
    pages/
      landing.ts        parallax + demo video slot
      catalogue.ts      card rendering, filter UI bound to URL
      exercise.ts       step UI; lazy-imports viewer
    viewer/
      viewer.ts         scene, camera animation, orbit bounds, rep playback
      rig.ts            joint convention, GLB loader, primitive mannequin
  README.md             run instructions + "Replacing placeholders"
```

**Boundaries:**
- `lib/` is pure TypeScript (no DOM, no `three`) and is unit-tested.
- `viewer/` is the only code that imports `three`. The exercise page loads it with a dynamic `import()`.
- The page and viewer interface is `goTo(stepIndex)`, `setCamera(view)`, `play()`, `pause()`, `seek(t)`, `dispose()`.
- The mannequin and the GLB both implement one `Rig` interface: a map from `JointName` to a rotatable `Object3D`.

**Dependencies:** runtime `three` only; `OrbitControls` and `GLTFLoader` come from `three/examples/jsm`, which ships inside the package. Development dependencies: `vite`, `typescript`, `vitest`. Any further dependency must be justified in the plan.

## 3. Data model

### Exercises — `src/data/exercises.ts`

```ts
type Muscle = 'chest'|'back'|'shoulders'|'biceps'|'triceps'|'quads'|'hamstrings'|'glutes'|'calves'|'core'
type Equipment = 'barbell'|'dumbbell'|'cable'|'machine'|'bodyweight'|'kettlebell'
type Pattern = 'push'|'pull'|'squat'|'hinge'|'lunge'|'carry'|'core'
type Difficulty = 'beginner'|'intermediate'|'advanced'

interface Exercise {
  id: string            // kebab-case; also the GIF filename media/gifs/<id>.gif
  name: string
  primary: Muscle[]
  secondary: Muscle[]
  equipment: Equipment
  pattern: Pattern
  difficulty: Difficulty
  works: string         // one plain-language sentence: what it trains
  why: string           // one sentence: why a beginner should do it
  built: boolean        // true only for 'seated-cable-row'
}
```

- 32 exercises. Every `Equipment`, `Pattern` and `Difficulty` value is used at least once, and every `Muscle` appears as a primary muscle at least once.
- **Filters:** muscle (multi-select, matches if any selected muscle is in `primary`), equipment (multi-select), pattern (multi-select), difficulty (multi-select). The groups combine with AND; values within one group combine with OR.
- **Sort:** `recommended` (default; beginner first, then intermediate, then advanced, then A–Z), `az`, `easiest` (difficulty ascending, then A–Z).
- **Pinning:** whenever `seated-cable-row` is in the result set, it comes first under every sort.
- **URL params:** `?muscle=back,biceps&equipment=cable&pattern=pull&difficulty=beginner&sort=az`. Unknown values are ignored, and an unknown sort falls back to `recommended`.

### Joint naming convention

`pelvis, spine, chest, neck, head, shoulder_L, shoulder_R, elbow_L, elbow_R, wrist_L, wrist_R, hip_L, hip_R, knee_L, knee_R, ankle_L, ankle_R`

Hierarchy: `pelvis` is the root; `spine` → `chest` → `neck` → `head`; `chest` → `shoulder_*` → `elbow_*` → `wrist_*`; `pelvis` → `hip_*` → `knee_*` → `ankle_*`.

A GLB either uses these bone names or supplies a name map in `rig.ts` (`BONE_MAP: Partial<Record<JointName, string>>`).

### Motion — `src/data/poses/seated-cable-row.ts`

```ts
type Vec3 = [number, number, number]
type Euler = [x: number, y: number, z: number]          // degrees, local, relative to rest pose
type Pose = { root?: { position: Vec3 }; joints: Partial<Record<JointName, Euler>> }
type View = 'side'|'top'|'back'|'iso'

interface CameraPreset { view: View; position: Vec3; target: Vec3; fov: number }

interface Step {
  id: string
  title: string
  instruction: string
  mistake: string
  cues: string[]
  camera: View
  pose: Pose
  duration: number                       // ms
  easing: 'easeInOut'|'easeOut'|'linear'
}

interface ExerciseMotion {
  exerciseId: string
  cameras: Record<View, CameraPreset>
  steps: Step[]
  rep?: { duration: number; keys: { t: number; pose: Pose }[] }  // t in [0,1]
}
```

**Seated Cable Row steps:** 1 Setup, 2 Seat and feet, 3 Grip, 4 Spine position, 5 The pull, 6 The squeeze, 7 Controlled return. The content is beginner-safe and plain-language, and defines terms inline (for example "neutral spine — your back's natural, straight-ish shape"). The file header and the detail page both carry: **"Draft — to be reviewed by a qualified coach before public release."**

Sample `rep` track: 4 keys (sit tall → pull → squeeze → return), duration 3000 ms.

## 4. 3D viewer

**Startup:**
1. Step text renders right away from data, so all content is readable without 3D.
2. WebGL check (`canvas.getContext('webgl2') || getContext('webgl')`). If it fails, the page shows a styled panel ("3D view isn't supported on this browser. Every step is written out alongside.") and `three` is never downloaded.
3. Otherwise a loading state shows while `viewer/` is imported.
4. The viewer tries `models/human.glb`. On a 404 or error it builds a **primitive mannequin** (capsules and spheres in the joint hierarchy above) and shows the badge "Placeholder model — final model coming soon".

**Step change:**
- The camera tweens position, target and fov to the step's preset over `duration` with the step's easing.
- Joints slerp (quaternion) from their current rotation to the target. Joints the step doesn't mention keep their current rotation. `root.position` lerps.
- A new step change during a tween retargets from the current values; it never snaps.
- Reduced motion: values are applied instantly.

**Camera preset switcher (Side / Top / Back / Iso):** overrides the angle until the next step change. Uses `aria-pressed`.

**Orbit:** `OrbitControls` with damping, no panning, a polar angle clamp so the camera stays above the floor, and a distance clamp. Supports touch (one-finger orbit, pinch zoom). A user orbit holds until the next step or preset change.

**Rep playback:** Play/Pause plus a range scrubber over `rep`. If there is no `rep`, the steps' poses play in sequence, labelled "Placeholder motion".

**Lifecycle:** `dispose()` frees the renderer, geometries, materials and listeners. The render loop renders only while tweening, playing or orbit-damping, and pauses when `document.hidden`.

## 5. Pages

### Landing — `index.html`
- A header with the **Rep One** wordmark.
- Left: a large rounded **demo video panel**: `<video muted loop autoplay playsinline poster="media/video/demo-poster.jpg">` with `src="media/video/demo.mp4"`. On error, or if the file is missing, a labelled placeholder shows "Demo video coming soon" and the slot path. Under reduced motion there is no autoplay; the poster and a play button show instead.
- Right: "See catalogue" text above a liquid glass button that links to `catalogue.html`.
- **Parallax:** 3–4 depth layers moved by scroll and pointer through one `requestAnimationFrame` loop that writes `transform`.
  - Off under `prefers-reduced-motion` and on `(pointer: coarse)`.
  - Pointer-only (no scroll layer) when `navigator.hardwareConcurrency <= 4`.

### Catalogue — `catalogue.html`
- **Filter bar:** chip groups for muscle, equipment, pattern and difficulty (`<button aria-pressed>`), plus a sort `<select>`.
- **Active filters** shown as removable chips, with "Clear all".
- A **result count** in an `aria-live="polite"` region.
- **Empty state:** "No exercises match those filters" plus a Clear filters button.
- **Card:** name, primary muscles, difficulty pill, `works` and `why`. The whole card is a link to `exercise.html?id=<id>`.
  - On hover or `:focus-within`, it loads and shows `media/gifs/<id>.gif` (loaded lazily on first trigger).
  - With `(hover: none)`, a visible "Preview" toggle button shows the GIF.
  - A missing GIF shows a "Preview coming soon" tile.
- Seated Cable Row carries a "Start here" badge.

### Detail — `exercise.html?id=…`
- **Built:** the viewer is the main area (stacked above the steps on narrow screens). The step panel holds a progress indicator ("Step 3 of 7" plus a bar), Previous/Next, a direct step list, and the active step's title, instruction, common mistake and cues. Keyboard: ←/→ change steps; the step list uses roving tabindex.
- **Not built:** the "Coming soon" view with the name, `works`/`why`, and a glass "Back to catalogue" button.
- **Unknown or missing id:** "We couldn't find that exercise" plus "Back to catalogue".

### Transitions
- `@view-transition { navigation: auto; }` on all pages gives the default page transition.
- Card-to-detail morph: when a card is clicked, it gets `view-transition-name: exercise-hero` (applied only to the clicked card), and the detail header has the same name, so the card expands into the header. The reverse direction uses the same name on the matching card when it renders.
- `prefers-reduced-motion`: transition animations are disabled.

### Liquid glass buttons (all primary buttons)
- `backdrop-filter: blur() saturate()` plus an SVG `feDisplacementMap` and specular highlight, applied only where `backdrop-filter: url(#…)` is supported (Chromium).
- A solid tint layer under the label guarantees at least 4.5:1 text contrast.
- Fallback is solid fill when `backdrop-filter` is unsupported or under `prefers-reduced-transparency: reduce`.

## 6. Accessibility

- Every page has `header`, `main` and `nav` landmarks and a skip link.
- A visible, high-contrast focus ring that reads on any flood colour.
- The 3D canvas has `role="img"` with an `aria-label` updated per step, for example "Model showing step 3: Grip, side view". The step text is the complete alternative.
- Real buttons, links and selects throughout; GIFs and posters have alt text.
- `prefers-reduced-motion` turns off parallax, tweens, view transitions and video autoplay.

## 7. Performance

- `three` loads only on the detail page, and only when WebGL is available.
- GIFs load on first interaction; posters use `loading="lazy"`.
- **Budget (gzipped JS):** landing ≤ 30 KB, catalogue ≤ 30 KB, viewer chunk ≤ 200 KB. A post-build script checks this, and the build fails if a budget is exceeded.
- Render on demand (see Lifecycle).

## 8. Error, empty and loading states

| View | States |
|---|---|
| Catalogue | empty filter result; invalid URL params ignored |
| Detail | unknown id; not built ("Coming soon"); WebGL unavailable; model loading; GLB failed → mannequin; no `rep` → placeholder timeline |
| Media | missing video / GIF / poster → labelled placeholder tile |

## 9. Testing

Vitest, written test-first for `lib/` and the data:
- `catalogue.ts`: each filter, combined filters, each sort, Seated Cable Row pinned under every sort, URL param parse/serialise round trip, unknown values ignored.
- `steps.ts`: next/prev clamp at the ends, goto, key mapping.
- `tween.ts`: easing endpoints (0→0, 1→1), interpolation, retarget mid-tween.
- Data integrity: 32 exercises (≥ 30), unique ids, valid taxonomy values, exactly one `built`, Seated Cable Row has 7 steps, every step camera exists in `cameras`, every pose joint name is in the convention, `rep` key `t` values in [0,1] and ascending.

The UI, transitions and 3D are verified in Chromium during Phase 3: every route, transition, filter and sort, step navigation, preset switching, playback, reduced-motion and the WebGL-off fallback.

## 10. README: "Replacing placeholders"

Documents exactly:
- **Model:** put the GLB at `public/models/human.glb`, using the joint names or a `BONE_MAP` entry; rest-pose expectations; what units and up-axis to use.
- **GIFs:** `public/media/gifs/<exercise-id>.gif` (the id comes from `exercises.ts`).
- **Demo video:** `public/media/video/demo.mp4` and `demo-poster.jpg`.
- **Pose data:** edit `src/data/poses/seated-cable-row.ts`; add `src/data/poses/<id>.ts` plus `built: true` to enable another exercise.

## 11. Out of scope

Exercises beyond Seated Cable Row, user accounts, progress saving, a backend, deployment, webcam pose scoring, and i18n.
