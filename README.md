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

A pose file can include an optional `rep` keyframe track for the moving rep.

The Seated Cable Row content is a draft pending review by a qualified coach.
