// Oriented boxes in apparatus-local coordinates. These stay independent of the
// renderer so collision behavior can be tested with the fixed-step solver.
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const CONTACT_SKIN = 0.002;

export function supportRadius(box, normal) {
  return box.halfSize.reduce((radius, half, i) => radius + half * Math.abs(dot(box.axes[i], normal)), 0);
}

export function attachmentBox(bounds, position, direction) {
  // Same shortest-arc rotation as Three's setFromUnitVectors((0,-1,0), n).
  let x = -direction.z, z = direction.x, w = 1 - direction.y;
  const norm = Math.hypot(x, z, w);
  if (norm < 1e-8) { x = 0; z = 1; w = 0; }
  else { x /= norm; z /= norm; w /= norm; }
  const axes = [
    { x: 1 - 2 * z * z, y: 2 * w * z, z: 2 * x * z },
    { x: -2 * w * z, y: 1 - 2 * (x * x + z * z), z: 2 * w * x },
    { x: 2 * x * z, y: -2 * w * x, z: 1 - 2 * x * x },
  ];
  const center = { ...position };
  const halfSize = [];
  ['x', 'y', 'z'].forEach((a, i) => {
    const offset = (bounds.min[a] + bounds.max[a]) * 0.5;
    halfSize.push((bounds.max[a] - bounds.min[a]) * 0.5);
    for (const b of ['x', 'y', 'z']) center[b] += axes[i][b] * offset;
  });
  return { center, halfSize, axes };
}

/** SAT on both sets of face normals and their nine edge cross products.
 * The normal points from the obstacle toward the handle.
 */
export function boxContact(handle, obstacle, skin = CONTACT_SKIN) {
  const delta = {
    x: handle.center.x - obstacle.center.x,
    y: handle.center.y - obstacle.center.y,
    z: handle.center.z - obstacle.center.z,
  };
  // Cheap enclosing-AABB rejection before the full oriented-box test.
  for (const axis of ['x', 'y', 'z']) {
    const extent = box => box.halfSize.reduce((sum, half, i) => sum + half * Math.abs(box.axes[i][axis]), 0);
    if (Math.abs(delta[axis]) > extent(handle) + extent(obstacle) + skin) return null;
  }
  let depth = Infinity, normal = null;
  const candidates = [...handle.axes, ...obstacle.axes];
  for (const a of handle.axes) for (const b of obstacle.axes) candidates.push(cross(a, b));
  for (const axis of candidates) {
    const magnitude = Math.hypot(axis.x, axis.y, axis.z);
    if (magnitude < 1e-7) continue;
    const n = { x: axis.x / magnitude, y: axis.y / magnitude, z: axis.z / magnitude };
    const distance = dot(delta, n);
    const overlap = supportRadius(handle, n) + supportRadius(obstacle, n) + skin - Math.abs(distance);
    if (overlap <= 0) return null;
    if (overlap < depth) {
      depth = overlap;
      const sign = distance < 0 ? -1 : 1;
      normal = { x: n.x * sign, y: n.y * sign, z: n.z * sign };
    }
  }
  return normal ? { normal, depth } : null;
}
