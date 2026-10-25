# Rep One

Rep One teaches beginners weightlifting form. Each exercise gets a 3D model you can orbit, with the joint angles and cues that matter.
It is a Vite + TypeScript multi-page app: landing, catalogue and exercise detail.

## Scripts

```
npm install
npm run dev       # dev server
npm test          # vitest
npm run build     # typecheck, vite build, bundle budget check
npm run preview   # serve the built dist/
```

## Humanoid integration

The cable-row scene uses the detailed four-station apparatus from `~/Downloads/Room/gym`, replacing the blue placeholder station. It loads the muscle humanoid from `public/models/human.glb` (14.8 MB). Open `/exercise.html?id=seated-cable-row` to orbit the model, select steps, and play or scrub a repetition. The muscles the row works are painted directly on the humanoid: primary movers (lats, middle trapezius, rhomboids) in gold, assisting groups (upper and lower trapezius, teres major, infraspinatus, shoulders, biceps, forearms, erector spinae) in a softer tint. The list lives in the `muscles` field of `src/data/poses/seated-cable-row.ts`.

Each step also highlights the part it changes, set in the step's `focus` field. The part flashes red while it moves into place, then turns steady green. Setup highlights the selector pin, the plates it selects and the handle. Seat and feet highlights the feet and footplates. Grip highlights the hands and handle. Spine position fades the body and shows the spine straightening from a slump. The pull and the controlled return highlight the arms, and the squeeze highlights the shoulder-blade muscles. Clicking the current step's number replays it. With reduced motion the highlight is shown green without flashing. `src/viewer/step-focus.ts` does the tinting.

The self-contained GLB includes the base body, 90 muscle patches, materials, textures, skin weights and the 65-bone skeleton. Embedded animation is removed; the exercise pose data drives the rig. `src/viewer/humanoid.ts` adapts the original Mixamo T-pose and centimetre skeleton to the scene’s pose controls. `src/viewer/muscle-interaction.ts` handles highlighting and deep-layer visibility; labels live in `src/data/muscles.ts`. No sculpting dependencies are needed at runtime.

The asset was exported from the neighboring `HackOhio_2026/fbx-preview` harness using `export-portable.js`, based on the supplied `Defeated.fbx`. The muscle geometry is a visual prototype. Rep One drives the row attachment, cable, pulleys and selected plates from the authored poses; this is kinematic playback rather than a resistance simulation. In the original gym simulator, the existing cable physics remains in control and the humanoid arms follow the physical row handle. The shared row-grip adapter aligns the palms to the grip bars, curls the finger bones and prevents attachment roll. Joint limits and finger-to-handle collision remain approximate. The mannequin uses muted silver/blue-grey materials, and playback eases into each pose with an approximately 3.5-second rowing cycle matched visually to `IMG_2260.MOV`.

## Replacing placeholders

### Model

`public/models/human.glb`

- Y-up, metres, facing +Z, standing rest pose.
- Bone names equal the joint names, or are mapped through `BONE_MAP` in `src/viewer/rig.ts`.
- Joint names: `pelvis, spine, chest, neck, head, shoulder_L, shoulder_R, elbow_L, elbow_R, wrist_L, wrist_R, hip_L, hip_R, knee_L, knee_R, ankle_L, ankle_R`.
- Angles are Euler degrees, XYZ order, relative to the rest pose. Positive X flexes: spine and chest lean forward, the hip lifts the thigh forward, the knee bends, the shoulder raises the arm forward, the elbow bends.

### GIFs

`public/media/gifs/<id>.gif`, with ids from `src/data/exercises.ts`.

### Demo video

`public/media/video/demo.mp4` and `public/media/video/demo-poster.jpg`.

### Pose data

1. Add `src/data/poses/<id>.ts`.
2. Register it in `getMotion` (`src/data/motion.ts`).
3. Set `built: true` for that exercise in `src/data/exercises.ts`.

A pose file can include an optional `rep` keyframe track for the moving rep. A step's optional `enter` field holds keyframes for the movement from the previous step into it, such as walking in, stepping over the bench or the staggered grip. `src/lib/clip.ts` interpolates these keyframes. Planted feet, the handle state and shoulder-blade retraction are keyed alongside the joints.

The Seated Cable Row content is a draft pending review by a qualified coach.

### Gym simulator handoff

`src/viewer/gym/` contains the original `CableStackApparatus.js`, `CablePhysics.js`, `DynamicCable.js`, and `CollisionBox.js`. `cable-row-composite.ts` assembles that apparatus with the humanoid in its native west-row coordinates. The viewer rotates the complete assembly to match Rep One’s cameras. All four stations remain part of the scene.

The original simulator at `~/Downloads/Room/gym/index.html` loads `assets/human.glb` and `assets/humanoid-runtime/humanoid.js`. Its row handle, pull slider and Auto-Rep move the humanoid’s arms. Click muscles to highlight them. Rebuild that portable runtime after editing the humanoid adapter with:

```sh
node scripts/export-gym-humanoid.mjs /Users/sengweiyeoh/Downloads/Room/gym
```

The original gym simulator retains its optional full-room backdrop. Rep One imports the isolated apparatus assembly, so its runtime does not depend on the Downloads folder or the room backdrop asset.
