import * as THREE from 'three';

/** Reusable tube buffer: straight cable runs with local rounded pulley bends.
 * No Catmull-Rom overshoot through the frame and no per-frame GPU allocations.
 */
export class DynamicCable extends THREE.BufferGeometry {
  constructor(segments = 160, sides = 6, radius = 0.0025) {
    super();
    Object.assign(this, { segments, sides, radius });
    this.setAttribute('position', new THREE.BufferAttribute(new Float32Array((segments + 1) * (sides + 1) * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((segments + 1) * (sides + 1) * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const indices = [];
    for (let i = 0; i < segments; i++) for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j, b = a + sides + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
    this.setIndex(indices);
  }

  update(waypoints, exit, handle, slack = 0) {
    const route = [];
    const points = [...waypoints, exit];
    route.push(points[0].clone());
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i], before = points[i - 1], after = points[i + 1];
      const radius = Math.min(0.045, p.distanceTo(before) * 0.25, p.distanceTo(after) * 0.25);
      if (radius < 0.0001) continue;
      const start = p.clone().addScaledVector(before.clone().sub(p).normalize(), radius);
      const end = p.clone().addScaledVector(after.clone().sub(p).normalize(), radius);
      for (let j = 0; j <= 6; j++) {
        const t = j / 6;
        route.push(start.clone().multiplyScalar((1 - t) ** 2).addScaledVector(p, 2 * t * (1 - t)).addScaledVector(end, t * t));
      }
    }
    route.push(exit.clone());
    // Parabolic approximation of a slack lead; solve its arc length for sag.
    const distance = exit.distanceTo(handle);
    let low = 0, high = (distance + slack) * 0.65;
    const sagDirection = new THREE.Vector3(0, -1, 0);
    const leadDirection = handle.clone().sub(exit).normalize();
    sagDirection.addScaledVector(leadDirection, -sagDirection.dot(leadDirection));
    if (sagDirection.lengthSq() < 0.01) sagDirection.set(0, 0, 1);
    sagDirection.normalize();
    const sample = (t, sag) => exit.clone().lerp(handle, t).addScaledVector(sagDirection, 4 * t * (1 - t) * sag);
    for (let k = 0; k < 12; k++) {
      const mid = (low + high) / 2;
      let arc = 0, prev = exit;
      for (let j = 1; j <= 20; j++) {
        const p = sample(j / 20, mid);
        arc += p.distanceTo(prev); prev = p;
      }
      if (arc < distance + slack) low = mid; else high = mid;
    }
    const sag = slack > 0.0002 ? (low + high) / 2 : 0;
    for (let j = 1; j <= 20; j++) route.push(sample(j / 20, sag));

    const lengths = [0];
    for (let i = 1; i < route.length; i++) lengths.push(lengths[i - 1] + route[i].distanceTo(route[i - 1]));
    const total = lengths[lengths.length - 1];
    const centers = [];
    let section = 1;
    for (let i = 0; i <= this.segments; i++) {
      const distance = total * i / this.segments;
      while (section < route.length - 1 && lengths[section] < distance) section++;
      const t = (distance - lengths[section - 1]) / Math.max(1e-8, lengths[section] - lengths[section - 1]);
      centers.push(route[section - 1].clone().lerp(route[section], t));
    }
    const positions = this.attributes.position, normals = this.attributes.normal;
    for (let i = 0; i <= this.segments; i++) {
      const tangent = centers[Math.min(i + 1, this.segments)].clone().sub(centers[Math.max(0, i - 1)]).normalize();
      const normal = new THREE.Vector3(Math.abs(tangent.y) > 0.95 ? 1 : 0, Math.abs(tangent.y) > 0.95 ? 0 : 1, 0).cross(tangent).normalize();
      const binormal = tangent.clone().cross(normal);
      for (let j = 0; j <= this.sides; j++) {
        const angle = j / this.sides * Math.PI * 2;
        const n = normal.clone().multiplyScalar(Math.cos(angle)).addScaledVector(binormal, Math.sin(angle));
        const p = centers[i].clone().addScaledVector(n, this.radius);
        const index = i * (this.sides + 1) + j;
        positions.setXYZ(index, p.x, p.y, p.z);
        normals.setXYZ(index, n.x, n.y, n.z);
      }
    }
    positions.needsUpdate = normals.needsUpdate = true;
    this.computeBoundingSphere();
  }
}
