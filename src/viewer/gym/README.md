These four JavaScript modules are copied from
/Users/sengweiyeoh/Downloads/Room/gym (24 October 2026).

CableStackApparatus.js creates the detailed four-station cable tower, including
its bench, footplates, handles, textured materials, cables and weight plates.
CablePhysics.js, DynamicCable.js and CollisionBox.js are its runtime dependencies.
No room GLB or reference photographs are required for the isolated assembly.

Keep these files in sync with the simulator if its apparatus changes.
CableStackApparatus.d.ts describes the subset used by Rep One.

The apparatus in both projects now accepts an optional per-station autoRepProfile.
The west row uses the supplied video timing; other stations retain their original
sinusoidal target. The physical cable solver remains unchanged.
