# Rowing motion reference

Reference: `/Users/sengweiyeoh/Downloads/IMG_2260.MOV` (21.87 seconds, 30 fps).
Reviewed frame sequences at 0–21 seconds and 0.25-second intervals at 6–14 seconds.
The repeated reps after setup show a quick pull toward the abdomen, a visible
contraction hold, a longer release, and a short pause at extended arms. Feet
remain planted while the torso hinges slightly and elbows travel behind the ribs.

The authored loop is approximately 3.5 seconds: 0.63 s pull, 1.09 s hold,
1.30 s return, and 0.49 s extended pause. These are visual estimates from the
repetitions around 7–14 seconds, not tracked or calibrated motion capture.
The initial foot placement and final dismount are excluded from the rep loop.

`src/data/row-reference.ts` shares the cadence between Rep One and the original
simulator. Rep One uses authored joint poses plus palm contact solving. The gym
uses the same rhythm to drive its compliant cable target; its existing physical
solver determines the actual handle movement, and the mannequin follows it.
The cadence control continues to scale the simulator speed.

## Hip-hinge correction

The original spine-only lean did not reproduce the reference's hip movement.
The reach now rotates the pelvis 24 degrees forward around the midpoint of the
hip joints; the contracted pose returns to an 8-degree rearward angle. These
are visual approximations of the clip. Hip counter-rotation and two-bone leg
support preserve both ankle positions and orientations on the footplates.
The spine stays nearly neutral, and the neck counter-rotates to keep the gaze
forward. A regression test sweeps the full rep in native gym coordinates and
checks foot drift below 1 mm, including repeated rig updates.
