# HackOhio 2026

## FBX motion preview

A local Three.js proof of concept for `Defeated.fbx`.

```sh
npm install
npm run dev
```

Open the URL Vite prints (normally http://127.0.0.1:5173).
The supplied FBX is copied to `fbx-preview/public/Defeated.fbx` and ignored by Git.
On another machine, put the model at that path before starting.

- Play/pause the embedded 6.73-second Mixamo clip; scrub or change speed.
- Select head, torso, either upper arm, or hips. Drag rotation rings or use X/Y/Z sliders.
- Each local axis is limited to ±60°. Editing pauses playback; offsets persist when playback resumes.
- Orbit, zoom, pan, reset camera, and optionally display the skeleton.
- Reset pose offsets restores the original animation at the current time.

This is forward-kinematic joint rotation, with no hand/foot IK, keyframe authoring, saving, or FBX export. The original Downloads file is untouched. The second FBX animation stack contains no playable tracks and is omitted by the loader.

`npm run build` creates `fbx-preview/dist`. All model processing stays in the browser; no upload service is used.

### Animation-free alternative

Open http://127.0.0.1:5173/?model=static or choose **Animation-free · rigged** in the model-version selector. This loads `fbx-preview/public/Defeated_NoAnimation.fbx`; the original remains available in the same selector. Joint posing works on both versions. Playback controls are disabled for the animation-free model.

## Back-muscle development harness

Open http://127.0.0.1:5173/anatomy.html. The original motion viewer remains available.

The back-only study adds 18 bilateral, weighted surface patches: upper/middle/lower trapezius, rhomboid major/minor, continuous latissimus dorsi, infraspinatus, teres major, and a simplified erector-spinae group. The superficial/deep/split switch exposes the rhomboids by removing overlying trapezius; the deep view also removes lats. Upper/lower lat controls affect a single continuous surface per side.

- **Exposed muscle / Clay geometry:** added muscle surfaces fitted to the original rest mesh and weighted to its skeleton.
- **Sculpted skin:** real displacement of the original body vertices. Original topology, UVs and skin weights remain intact; switching back restores the original positions. Deep muscles do not create separate superficial bulges.
- **Sculpt controls:** bilateral prominence, width and vertical placement; additional upper/lower fullness for lats. Values persist in this browser's local storage.
- **Pose check:** arm lowering and torso twist to inspect deformation. No physiological contraction simulation.
- **Save feedback + view:** writes a note, selected region, parameters, camera, pose and JPEG into `feedback/back-study/` through the localhost Vite dev server. Tell the agent “review my feedback” after saving. Feedback is not automatically acted on.
- **Export:** downloadable settings JSON and a binary GLB with current geometry, visible muscles, materials and rig. These do not modify either FBX. Feedback saving requires `npm run dev`; it is not part of static production hosting.

### Anatomy scope and validation

This is an approximate posterior surface study, not an anatomically measured reconstruction. The mannequin has no scapular/vertebral landmark meshes. Attachment paths, scapular mechanics, muscle thickness, fiber directions, fascia, and the latissimus humeral tendon are simplified. The trapezius region boundaries are exaggerated to make selection/readability clear. Exposed surfaces are open sheets rather than closed volumetric muscles. The natural-skin version is limited by the base mesh's resolution.

Placement/layering references: [OpenStax, muscles of the pectoral girdle and upper limbs](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs), [StatPearls, extrinsic back muscles](https://www.ncbi.nlm.nih.gov/books/NBK537216/). Geometry is authored in this project; no reference illustrations or third-party muscle assets are copied.

Validation: posterior and oblique screenshots, layer visibility, parameter persistence, deformation/reset, local feedback and screenshot persistence, GLB meshes/skins and finite geometry attributes, and mobile overflow. Run `node scripts/check-back-preview.cjs` while the dev server is running to repeat the functional smoke check (requires Playwright Chromium).

### Full-body visual pass (v2)

The same `/anatomy.html` harness now opens on the front of the full body. It retains the detailed back and adds 72 rigged surface patches in 14 simplified groups: pectorals, abdominals, obliques/serratus, deltoids, biceps, triceps, forearms, glutes, quadriceps, hamstrings/adductors, calves, shins, neck/face, and hands/feet. Fingers, toes, kneecaps and joint gaps retain a connective-tissue appearance. This is coverage of the major visual groups, not every anatomical muscle.

Choose **Rest of body · visual shapes** under Region controls, or click a visible muscle, to adjust that group's prominence. Width and placement remain back-specific. **Show full-body muscles** can be disabled to compare against the original back-only study. The back layer switch affects only the back. Surface modes, feedback capture, skin displacement, pose checks and GLB export include the full-body additions. The added surfaces inherit the supplied rig's weights. Out-of-silhouette projection samples are clipped; the surfaces are not watertight solids.

### Muscle-surface refinement

The visual refinement pass rounds chest and abdominal contours, adds tapered tendon transitions to the limbs, reduces neighboring surface overlaps, and uses softer volume falloffs with subtler fiber contrast. The middle/lower trapezius share a diagonal boundary, including the corresponding skin-mode deformation mask. Surface fitting recovers near-edge samples and smooths small mannequin grooves outward to reduce clipping while preserving the existing rig. The controls and page layout are unchanged.

### Muscle highlighting

Enable **Click to highlight muscles**, then click muscle-group buttons or visible muscle surfaces to toggle a persistent multi-selection. Both sides of each group use the chosen highlight color. **Dim other muscles** reduces the surrounding muscles to gray; **Clear** restores their current surface materials. Turn click-highlighting off to select a group for sculpting without changing the highlighted set.

Highlights survive camera changes, posing, shape edits and browser reloads. The saved feedback/settings include the selected groups, color and dimming preference; GLB export captures the visible material colors. Hidden selections are listed with a **Show highlighted muscles** action that reveals the appropriate back layer and body coverage. Highlight surfaces are shown in exposed-muscle and clay modes; the reveal action switches from sculpted skin to exposed muscle.

Run `node scripts/check-muscle-highlights.cjs` against the dev server to check multi-selection, actual material colors, persistence, layer reveal, clearing and mobile layout.

### Portable model and Rep One handoff

`fbx-preview/export-portable.js` exports the animation-free rig and all muscle
layers as a self-contained GLB. The `rep-one` branch contains that asset and the
gym cable-stack integration, including highlighting, grip alignment, the
video-referenced rowing cadence, and hip-hinge/footplate support.

Checkpoint: the original FBX preview and full-body sculpting harness are preserved
on `main`; the production application remains on `rep-one`. The source FBX files
and generated build/review output retain their existing Git exclusions. The
geometry and motion are visual prototypes; source assets are needed to rebuild
the harness model. Production deployment instructions are on the `rep-one` branch.
