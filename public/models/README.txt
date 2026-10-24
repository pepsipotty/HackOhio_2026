human.glb is the integrated muscle humanoid, exported from the neighboring
HackOhio_2026/fbx-preview/export-portable.js harness.

Source: user-supplied Defeated.fbx, with embedded animation removed.
Includes base body, 90 muscle patches in 23 groups, embedded materials/textures,
skin weights, and the original 65-bone Mixamo skeleton. All anatomical layers
are included; the interaction module controls deep-layer visibility.

Coordinate convention: Y-up, facing +Z, T-pose, exported at 2 units high.
src/viewer/humanoid.ts normalizes and adapts the skeleton to exercise controls.
Mesh extras muscle and anatomyLayer are used by muscle-interaction.ts.

This is an approximate visual anatomy prototype, not a medical reference.
