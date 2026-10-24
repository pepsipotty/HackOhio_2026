/** Reduced-coordinate cable machine dynamics. SI units throughout.
 * The stack has one vertical DOF; the attachment has three translational DOFs.
 * An inextensible, unilateral cable enforces |handle-exit| <= lead + lift/ratio.
 * Impulses transmit force; a slack cable cannot push. Fixed 240 Hz integration
 * keeps the same mechanics at different display rates. Dimensions and friction
 * are estimates, not measurements or a calibrated model of the real machine.
 */
import { attachmentBox, boxContact, supportRadius, CONTACT_SKIN } from './CollisionBox.js';

export const GRAVITY = 9.80665;
export const FIXED_STEP = 1 / 240;
const axes = ['x', 'y', 'z'];
const vec = () => ({ x: 0, y: 0, z: 0 });
const length = v => Math.hypot(v.x, v.y, v.z);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const ATTACHMENT_PHYSICS = {
  vBar: { mass: 2.2, extent: 0.20, width: 0.17 },
  dHandle: { mass: 0.8, extent: 0.23, width: 0.07 },
  rowHandle: { mass: 2.6, extent: 0.23, width: 0.10 },
  latBar: { mass: 3.6, extent: 0.16, width: 0.55 },
  tricepRope: { mass: 1.0, extent: 0.40, width: 0.05 },
};

export class CablePhysics {
  constructor({ ratio = 1, mass = 20, maxLift = 0.78, lead = 0.18,
    exit = { x: 0, y: 2, z: 0 }, direction = { x: 0, y: -1, z: 0 },
    attachment = 'vBar', friction = 0.012, drag = 3, airDrag = 0.12,
    restitution = 0.12, floor = true, barriers = [], collisionBounds = null, obstacles = [] } = {}) {
    Object.assign(this, { ratio, mass, maxLift, lead, friction, drag, airDrag,
      restitution, floor, barriers, collisionBounds, obstacles });
    this.exit = { ...exit };
    this.p = vec();
    this.velocity = vec();
    this.attachment = { ...ATTACHMENT_PHYSICS[attachment] };
    this.lift = 0;
    this.stackVelocity = 0;
    this.tension = 0;
    this.appliedForce = 0;
    this.slack = 0;
    this.impactEnergy = 0;
    this.elapsed = 0;
    this.accumulator = 0;
    this.target = null;
    const magnitude = length(direction) || 1;
    for (const a of axes) this.p[a] = exit[a] + direction[a] / magnitude * lead;
  }

  get direction() {
    const n = { x: this.p.x - this.exit.x, y: this.p.y - this.exit.y, z: this.p.z - this.exit.z };
    const d = length(n) || 1;
    for (const a of axes) n[a] /= d;
    return n;
  }

  get extension() {
    return Math.max(0, Math.hypot(this.p.x - this.exit.x, this.p.y - this.exit.y, this.p.z - this.exit.z) - this.lead);
  }

  get atRest() {
    return this.lift < 0.001 && Math.abs(this.stackVelocity) < 0.015 && !this.target;
  }

  advance(dt, beforeStep) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // Discard time spent in a background tab rather than applying a huge impulse.
    this.accumulator += Math.min(dt, 0.1);
    while (this.accumulator + 1e-12 >= FIXED_STEP) {
      beforeStep?.(FIXED_STEP, this);
      this.step(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
      this.elapsed += FIXED_STEP;
    }
  }

  step(h) {
    const n = this.direction;
    const m = this.attachment.mass;
    const invH = 1 / m;
    const invS = 1 / this.mass;
    const r = this.ratio;
    const force = { x: 0, y: -m * GRAVITY, z: 0 };
    this.appliedForce = 0;

    if (this.target) {
      // A compliant hand applies force to the attachment only. The stack is never
      // animated toward a position. Constant stiffness makes inertia perceptible.
      const error = vec();
      for (const a of axes) error[a] = this.target[a] - this.p[a];
      const radialVelocity = dot(this.velocity, n);
      const stiffness = 2200;
      const radialDamping = 1.8 * Math.sqrt(stiffness * (m + this.mass * r * r));
      const lateralDamping = 1.8 * Math.sqrt(stiffness * m);
      const support = this.mass * GRAVITY * r;
      const hand = vec();
      for (const a of axes) {
        hand[a] = stiffness * error[a] - lateralDamping * (this.velocity[a] - radialVelocity * n[a])
          + n[a] * (support - radialDamping * radialVelocity);
      }
      hand.y += m * GRAVITY;
      // Bound actuator force during teleports/very fast pointer movements.
      const scale = Math.min(1, 4500 / (length(hand) || 1));
      for (const a of axes) force[a] += hand[a] * scale;
      this.appliedForce = length(hand) * scale;
    }

    for (const a of axes) this.velocity[a] += (force[a] - this.airDrag * this.velocity[a]) * invH * h;
    // Regularized Coulomb friction opposes the actual motion, with a smooth
    // zero crossing to avoid stick-slip chatter at the 240 Hz solver scale.
    const frictionAcceleration = this.friction * GRAVITY * Math.tanh(this.stackVelocity / 0.01);
    this.stackVelocity -= (GRAVITY + frictionAcceleration) * h;
    this.stackVelocity /= 1 + this.drag * invS * h;

    // Use the actual distance for handles that have moved inside the free lead.
    const distance = Math.hypot(this.p.x - this.exit.x, this.p.y - this.exit.y, this.p.z - this.exit.z);
    const cableC = distance - this.lead - this.lift / r;
    const floorY = this.floorHeight(n);
    const bottomHit = this.lift + h * this.stackVelocity < 0 && this.stackVelocity < -0.25;
    const topHit = this.lift + h * this.stackVelocity > this.maxLift && this.stackVelocity > 0.25;
    const bottomSpeed = bottomHit ? -this.restitution * this.stackVelocity : 0;
    const topSpeed = topHit ? -0.06 * this.stackVelocity : 0;
    if (bottomHit) this.impactEnergy = 0.5 * this.mass * this.stackVelocity ** 2 * (1 - this.restitution ** 2);
    else this.impactEnergy *= Math.exp(-h * 5);
    let cableImpulse = 0;
    let bottomImpulse = 0;
    let topImpulse = 0;
    let floorImpulse = 0;

    // Sequential impulses, clamped cumulatively: contacts and cable only pull /
    // push in their permitted direction. Predictive limits prevent tunnelling.
    for (let i = 0; i < 20; i++) {
      let next = Math.max(0, bottomImpulse + (-this.stackVelocity - this.lift / h + bottomSpeed) / invS);
      this.stackVelocity += (next - bottomImpulse) * invS;
      bottomImpulse = next;
      next = Math.max(0, topImpulse + (this.stackVelocity - (this.maxLift - this.lift) / h - topSpeed) / invS);
      this.stackVelocity -= (next - topImpulse) * invS;
      topImpulse = next;
      if (this.floor) {
        next = Math.max(0, floorImpulse + (-this.velocity.y - (this.p.y - floorY) / h) / invH);
        this.velocity.y += (next - floorImpulse) * invH;
        floorImpulse = next;
      }
      const relativeSpeed = dot(n, this.velocity) - this.stackVelocity / r;
      next = Math.max(0, cableImpulse + (relativeSpeed + cableC / h) / (invH + invS / (r * r)));
      const impulse = next - cableImpulse;
      for (const a of axes) this.velocity[a] -= n[a] * impulse * invH;
      this.stackVelocity += impulse * invS / r;
      cableImpulse = next;
    }

    // Small swept movement increments prevent fast releases from crossing a
    // thin footplate between collision queries. Rotation is recomputed too.
    const movementSteps = this.collisionBounds ? Math.max(1, Math.ceil(length(this.velocity) * h / 0.008)) : 1;
    for (let i = 0; i < movementSteps; i++) {
      for (const a of axes) this.p[a] += this.velocity[a] * h / movementSteps;
      if (this.collisionBounds) this.resolveContacts();
    }
    this.lift = clamp(this.lift + this.stackVelocity * h, 0, this.maxLift);
    // Split position projection repairs small errors from changing cable angle
    // without feeding those corrections back as artificial kinetic energy.
    for (let i = 0; i < 8; i++) {
      this.resolveContacts();
      const dir = this.direction;
      const d = Math.hypot(this.p.x - this.exit.x, this.p.y - this.exit.y, this.p.z - this.exit.z);
      const error = d - this.lead - this.lift / r;
      if (error > 0) {
        const freeStack = this.lift < this.maxLift - 1e-8 ? invS : 0;
        const correction = error / (invH + freeStack / (r * r));
        for (const a of axes) this.p[a] -= dir[a] * correction * invH;
        this.lift = Math.min(this.maxLift, this.lift + correction * freeStack / r);
      }
    }
    if (floorImpulse > 0) {
      const damping = Math.max(0, 1 - 0.5 * floorImpulse / (m * (Math.hypot(this.velocity.x, this.velocity.z) || 1)));
      this.velocity.x *= damping;
      this.velocity.z *= damping;
    }
    this.slack = Math.max(0, this.lead + this.lift / r - Math.hypot(this.p.x - this.exit.x, this.p.y - this.exit.y, this.p.z - this.exit.z));
    this.tension = cableImpulse / h;
    if (this.lift < 1e-7 && Math.abs(this.stackVelocity) < 0.02) this.stackVelocity = 0;
  }

  floorHeight(n = this.direction) {
    if (this.collisionBounds) {
      const box = attachmentBox(this.collisionBounds, this.p, n);
      return this.p.y - box.center.y + supportRadius(box, { x: 0, y: 1, z: 0 }) + CONTACT_SKIN;
    }
    return 0.025 + Math.max(0, -n.y) * this.attachment.extent
      + Math.abs(n.x) * this.attachment.width;
  }

  resolveContacts() {
    if (this.floor) {
      const floorY = this.floorHeight();
      if (this.p.y < floorY) {
        this.p.y = floorY;
        this.velocity.y = Math.max(0, this.velocity.y);
      }
    }
    // Guard planes account for the whole oriented attachment, not just the
    // connector. A wide bar still has clearance when its cable is at rest.
    for (const { axis, min, max } of this.barriers) {
      const box = this.collisionBox;
      const normal = { x: 0, y: 0, z: 0 };
      normal[axis] = 1;
      const radius = box ? supportRadius(box, normal) + CONTACT_SKIN : 0;
      const offset = box ? box.center[axis] - this.p[axis] : 0;
      const lower = min === undefined ? -Infinity : min + radius - offset;
      const upper = max === undefined ? Infinity : max - radius - offset;
      if (this.p[axis] < lower) {
        this.p[axis] = lower;
        this.velocity[axis] = Math.max(0, this.velocity[axis]);
      }
      if (this.p[axis] > upper) {
        this.p[axis] = upper;
        this.velocity[axis] = Math.min(0, this.velocity[axis]);
      }
    }
    if (!this.collisionBounds) return;
    let handleBox = this.collisionBox;
    for (const obstacle of this.obstacles) {
      const contact = boxContact(handleBox, obstacle);
      if (!contact) continue;
      const { normal, depth } = contact;
      for (const a of axes) this.p[a] += normal[a] * depth;
      const speed = dot(this.velocity, normal);
      if (speed < 0) {
        // Inelastic normal response; Coulomb friction opposes tangential motion.
        for (const a of axes) this.velocity[a] -= normal[a] * speed;
        const tangentSpeed = length(this.velocity);
        const damping = Math.max(0, 1 - 0.45 * -speed / Math.max(1e-8, tangentSpeed));
        for (const a of axes) this.velocity[a] *= damping;
      }
      handleBox = this.collisionBox;
    }
  }

  get collisionBox() {
    return this.collisionBounds ? attachmentBox(this.collisionBounds, this.p, this.direction) : null;
  }

  energy() {
    return this.mass * GRAVITY * this.lift + this.attachment.mass * GRAVITY * this.p.y
      + 0.5 * this.mass * this.stackVelocity ** 2
      + 0.5 * this.attachment.mass * length(this.velocity) ** 2;
  }
}
