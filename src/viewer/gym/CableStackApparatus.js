import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CablePhysics, ATTACHMENT_PHYSICS } from './CablePhysics.js';
import { DynamicCable } from './DynamicCable.js';

/**
 * Physically Accurate 3D Recreation of the Isolated Life Fitness Signature Series
 * 4-Stack Cable Motion Multi-Jungle Tower (from reference photos IMG_2246 – IMG_2263).
 *
 * Includes all 4 stations and their exact physical constraints:
 *  1. South (+Z): High Pulley / Tricep Pushdown (1:1 ratio, 15 plates: 10–190 lbs)
 *  2. East  (+X): Lat Pulldown with Overhead Boom, Seat & Adjustable Thigh Pads (1:1 ratio, 16 plates: 10–260 lbs)
 *  3. West  (-X): Seated Low Row with Triple Studded Footplates & Long Monorail Bench (1:1 ratio, 16 plates: 10–260 lbs)
 *  4. North (-Z): Adjustable Hi-Low Cable Column with 18-Hole Chrome Guide Column & Braided Rope (2:1 ratio, 15 plates: 5–95 lbs)
 *
 * Physical Constraints Modeled:
 *  - 1-DOF vertical guide-rod constraint for each weight plate stack
 *  - Selector pin coupling: plates 1..k above/at the pin lift together with the central stem; plates k+1..N remain on the bottom bumpers
 *  - Pin interlock constraint: selector pin cannot be pulled/moved while the stack is lifted under tension
 *  - Mechanical advantage coupling: 1:1 on South/East/West stations; 2:1 compound floating stack pulley on North station
 *    (stack lifts 0.5x of handle cable pull, handle travel is 2x stack travel, effective handle resistance is 0.5x physical stack weight)
 *  - No-slip pulley sheave angular velocity: every active sheave rotates by Δθ = Δs_local / R_sheave
 *  - Swiveling pulley housings (North carriage & South high pulley) dynamically orient toward the 3D pull direction vector
 *  - Newtonian dynamics: gravity F = m*g, mass-dependent inertia, guide-rod viscous/Coulomb damping, unilateral cable tension (cables only pull, never push),
 *    and damped restitution on bottom bumper / resting-plate impact and upper travel limit stop
 *  - Indexed locking pin adjustments for North carriage height (18 holes) and East thigh roller pad height (6 holes)
 */

const LBS_TO_KG = 0.45359237;


export const STATION_CONFIGS = {
  southHighPulley: {
    id: 'southHighPulley',
    name: 'South: High Pulley / Tricep Pushdown',
    shortName: 'South High Pulley',
    face: '+Z (South)',
    ratio: 1.0, // 1:1 mechanical advantage
    maxStackTravel: 0.78, // meters
    defaultPinIndex: 4, // 50 lbs (matches IMG_2255)
    pinColor: 'black',
    defaultAttachment: 'vBar',
    stackCenter: new THREE.Vector3(0.0, 0.0, 0.285),
    stackRotY: 0, // faces +Z
    plates: [
      { label: '10', lbs: 10, wide: false },
      { label: '20', lbs: 20, wide: false },
      { label: '30', lbs: 30, wide: false },
      { label: '40', lbs: 40, wide: false },
      { label: '50', lbs: 50, wide: false },
      { label: '60', lbs: 60, wide: false },
      { label: '70', lbs: 70, wide: true },
      { label: '85', lbs: 85, wide: true },
      { label: '100', lbs: 100, wide: true },
      { label: '115', lbs: 115, wide: true },
      { label: '130', lbs: 130, wide: true },
      { label: '145', lbs: 145, wide: true },
      { label: '160', lbs: 160, wide: true },
      { label: '175', lbs: 175, wide: true },
      { label: '190', lbs: 190, wide: true },
    ],
    restHandleDir: new THREE.Vector3(0.0, -1.0, 0.08).normalize(),
    pullAxisDefault: new THREE.Vector3(0.0, -0.94, 0.34).normalize(),
    cameraView: {
      pos: new THREE.Vector3(0.15, 1.48, 2.35),
      target: new THREE.Vector3(0.0, 1.15, 0.15),
    },
  },

  eastLatPulldown: {
    id: 'eastLatPulldown',
    name: 'East: Lat Pulldown Station',
    shortName: 'East Lat Pulldown',
    face: '+X (East)',
    ratio: 1.0, // 1:1 mechanical advantage
    maxStackTravel: 0.76,
    defaultPinIndex: 7, // 100 lbs (matches IMG_2251)
    pinColor: 'yellow',
    defaultAttachment: 'dHandle', // matches IMG_2246 top-right (can switch to latBar)
    stackCenter: new THREE.Vector3(0.24, 0.0, 0.0),
    stackRotY: Math.PI / 2, // faces +X
    plates: [
      { label: '10', lbs: 10, wide: false },
      { label: '20', lbs: 20, wide: false },
      { label: '30', lbs: 30, wide: false },
      { label: '40', lbs: 40, wide: false },
      { label: '55', lbs: 55, wide: false },
      { label: '70', lbs: 70, wide: false },
      { label: '85', lbs: 85, wide: true },
      { label: '100', lbs: 100, wide: true },
      { label: '120', lbs: 120, wide: true },
      { label: '140', lbs: 140, wide: true },
      { label: '160', lbs: 160, wide: true },
      { label: '180', lbs: 180, wide: true },
      { label: '200', lbs: 200, wide: true },
      { label: '220', lbs: 220, wide: true },
      { label: '240', lbs: 240, wide: true },
      { label: '260', lbs: 260, wide: true },
    ],
    restHandleDir: new THREE.Vector3(0.0, -1.0, 0.0),
    pullAxisDefault: new THREE.Vector3(0.05, -0.99, 0.0).normalize(),
    cameraView: {
      pos: new THREE.Vector3(2.15, 1.45, 1.65),
      target: new THREE.Vector3(0.55, 1.15, 0.0),
    },
  },

  westSeatedRow: {
    id: 'westSeatedRow',
    name: 'West: Seated Low Row Station',
    shortName: 'West Seated Row',
    face: '-X (West)',
    ratio: 1.0, // 1:1 mechanical advantage
    maxStackTravel: 0.76,
    defaultPinIndex: 6, // 85 lbs
    pinColor: 'yellow',
    defaultAttachment: 'rowHandle', // close-grip dual-D row handle (IMG_2256, IMG_2262)
    stackCenter: new THREE.Vector3(-0.24, 0.0, 0.0),
    stackRotY: -Math.PI / 2, // faces -X
    plates: [
      { label: '10', lbs: 10, wide: false },
      { label: '20', lbs: 20, wide: false },
      { label: '30', lbs: 30, wide: false },
      { label: '40', lbs: 40, wide: false },
      { label: '55', lbs: 55, wide: false },
      { label: '70', lbs: 70, wide: false },
      { label: '85', lbs: 85, wide: true },
      { label: '100', lbs: 100, wide: true },
      { label: '120', lbs: 120, wide: true },
      { label: '140', lbs: 140, wide: true },
      { label: '160', lbs: 160, wide: true },
      { label: '180', lbs: 180, wide: true },
      { label: '200', lbs: 200, wide: true },
      { label: '220', lbs: 220, wide: true },
      { label: '240', lbs: 240, wide: true },
      { label: '260', lbs: 260, wide: true },
    ],
    restHandleDir: new THREE.Vector3(-0.98, 0.18, 0.0).normalize(),
    pullAxisDefault: new THREE.Vector3(-0.98, 0.18, 0.0).normalize(),
    cameraView: {
      pos: new THREE.Vector3(-2.15, 1.35, 1.75),
      target: new THREE.Vector3(-0.85, 0.72, 0.0),
    },
  },

  northAdjustableColumn: {
    id: 'northAdjustableColumn',
    name: 'North: Hi-Low Adjustable Cable Column (2:1)',
    shortName: 'North Hi-Low Column',
    face: '-Z (North)',
    ratio: 0.5, // 2:1 mechanical advantage! Stack moves 0.5x cable distance
    maxStackTravel: 0.78, // max handle pull is 1.56m!
    defaultPinIndex: 6, // 35 lbs effective resistance (IMG_2249)
    pinColor: 'black',
    defaultAttachment: 'tricepRope', // black & red braided rope (IMG_2249, IMG_2251)
    stackCenter: new THREE.Vector3(0.0, 0.0, -0.285),
    stackRotY: Math.PI, // faces -Z
    plates: [
      { label: '5', lbs: 5, wide: false },
      { label: '10', lbs: 10, wide: false },
      { label: '15', lbs: 15, wide: false },
      { label: '20', lbs: 20, wide: false },
      { label: '25', lbs: 25, wide: false },
      { label: '30', lbs: 30, wide: false },
      { label: '35', lbs: 35, wide: false },
      { label: '42.5', lbs: 42.5, wide: true },
      { label: '50', lbs: 50, wide: true },
      { label: '57.5', lbs: 57.5, wide: true },
      { label: '65', lbs: 65, wide: true },
      { label: '72.5', lbs: 72.5, wide: true },
      { label: '80', lbs: 80, wide: true },
      { label: '87.5', lbs: 87.5, wide: true },
      { label: '95', lbs: 95, wide: true },
    ],
    restHandleDir: new THREE.Vector3(0.0, -0.96, -0.28).normalize(),
    pullAxisDefault: new THREE.Vector3(0.0, -0.45, -0.89).normalize(),
    cameraView: {
      pos: new THREE.Vector3(1.45, 1.48, -2.15),
      target: new THREE.Vector3(0.10, 1.12, -0.35),
    },
  },
};

export class CableStackApparatus {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'LifeFitness4StackMultiJungle';

    this.materials = this.createMaterials();
    this.interactiveObjects = [];
    this.handleCollisionMeshes = [];
    this.stations = {};

    // Adjustable carriage state (North Hi-Low Column: 18 holes from y=0.28m to y=1.98m)
    this.carriageHoleCount = 18;
    this.carriageMinY = 0.28;
    this.carriageMaxY = 1.98;
    this.carriageHoleIndex = 14; // default upper-chest height matching IMG_2249 / IMG_2251 (~1.60m)

    // Adjustable thigh roller pad state (East Lat Pulldown: 6 holes from y=0.58m to y=0.73m)
    this.thighPadHoleCount = 6;
    this.thighPadMinY = 0.58;
    this.thighPadMaxY = 0.73;
    this.thighPadHoleIndex = 3; // ~0.67m

    this.onStateChange = null;

    this.buildCentralCageFrame();
    this.buildAllWeightStacks();
    this.buildSouthHighPulleyStation();
    this.buildEastLatPulldownStation();
    this.buildWestSeatedRowStation();
    this.buildNorthAdjustableColumnStation();
    this.buildFloorAccessories();

    this.refreshHandleColliders();

    // Initialize all kinematics at t = 0
    for (const stationId of Object.keys(this.stations)) {
      this.initStationPhysics(stationId);
      this.updateStationVisuals(stationId, 0);
    }
  }

  // ============================================================================
  // Procedural PBR Materials & Textures
  // ============================================================================
  createMaterials() {
    // 1. Metallic Silver-Grey Powder Coat (Frame Tubes)
    const silverFrame = new THREE.MeshStandardMaterial({
      name: 'LF_Silver_Metallic_Frame',
      color: 0xbec4cc,
      roughness: 0.36,
      metalness: 0.72,
      bumpMap: this.createSurfaceGrain(96, 0.16),
      bumpScale: 0.00022,
    });

    // 2. Polished Chrome (Guide Rods, Adjustable Column, Lat Bar, Carabiners)
    const chrome = new THREE.MeshStandardMaterial({
      name: 'LF_Polished_Chrome',
      color: 0xf2f5f8,
      roughness: 0.08,
      metalness: 0.96,
    });

    // 3. Cast Iron / Matte Black Weight Plate Surface
    const weightPlateIron = new THREE.MeshStandardMaterial({
      name: 'LF_Weight_Plate_Iron',
      color: 0x1c1e22,
      roughness: 0.68,
      metalness: 0.3,
      bumpMap: this.createSurfaceGrain(128, 0.7),
      bumpScale: 0.0006,
    });

    // 4. Black Fiberglass-Reinforced Nylon Pulley Sheave
    const pulleyBlack = new THREE.MeshStandardMaterial({
      name: 'LF_Pulley_Nylon',
      color: 0x17181b,
      roughness: 0.34,
      metalness: 0.18,
    });

    // 5. Black Contoured Upholstery (Seats & Rollers)
    const upholstery = new THREE.MeshStandardMaterial({
      name: 'LF_Black_Upholstery',
      color: 0x24262a,
      bumpMap: this.createSurfaceGrain(192, 0.8),
      bumpScale: 0.0007,
      roughness: 0.57,
      metalness: 0.06,
    });

    // 6. Molded Black Rubber (Foot Caps, Bumpers, Ball Stops, Increment Donut)
    const blackRubber = new THREE.MeshStandardMaterial({
      name: 'LF_Molded_Rubber',
      color: 0x121315,
      roughness: 0.76,
      metalness: 0.04,
    });

    // 7. Aircraft Steel Cable (Nylon-Coated Dark Steel)
    const steelCable = new THREE.MeshStandardMaterial({
      name: 'LF_Steel_Cable',
      color: 0x55585c,
      roughness: 0.32,
      metalness: 0.78,
    });

    // 8. Yellow Safety Selector Pin / Pull-Pin Knob
    const safetyYellow = new THREE.MeshStandardMaterial({
      name: 'LF_Safety_Yellow',
      color: 0xfacc15,
      roughness: 0.28,
      metalness: 0.08,
    });

    // 9. Red Anodized Guide-Rod Bushing Collar (visible on top plate in IMG_2255)
    const redBushing = new THREE.MeshStandardMaterial({
      name: 'LF_Red_Bushing',
      color: 0xb91c1c,
      roughness: 0.35,
      metalness: 0.25,
    });

    // 10. Studded Grey Footplate Texture & Material (matching IMG_2256 & IMG_2262)
    const footplateTex = this.createStuddedFootplateTexture();
    const studdedFootplate = new THREE.MeshStandardMaterial({
      name: 'LF_Studded_Footplate',
      color: 0x7c8086,
      map: footplateTex.colorMap,
      bumpMap: footplateTex.bumpMap,
      bumpScale: 0.006,
      roughness: 0.48,
      metalness: 0.45,
    });

    // 11. Red & Black Braided Tricep Rope Texture & Material (matching IMG_2249 & IMG_2251)
    const ropeTex = this.createBraidedRopeTexture();
    const braidedRope = new THREE.MeshStandardMaterial({
      name: 'LF_Braided_Tricep_Rope',
      map: ropeTex,
      bumpMap: ropeTex,
      bumpScale: 0.005,
      roughness: 0.68,
      metalness: 0.05,
    });

    // 12. Life Fitness Vertical Logo Decal Material
    const logoTex = this.createLifeFitnessLogoTexture();
    const logoDecal = new THREE.MeshStandardMaterial({
      name: 'LF_Logo_Decal',
      map: logoTex,
      transparent: true,
      roughness: 0.18,
      metalness: 0.85,
      depthWrite: false,
    });

    // 13. Instructional Placard Sticker Material
    const placardTex = this.createPlacardTexture();
    const placardMat = new THREE.MeshStandardMaterial({
      name: 'LF_Placard_Sticker',
      map: placardTex,
      roughness: 0.32,
      metalness: 0.10,
    });

    // 14. Caution Tape Accent (on North overhead pull-up grip in IMG_2248 / IMG_2256)
    const cautionMat = new THREE.MeshStandardMaterial({
      name: 'LF_Caution_Yellow',
      color: 0xeab308,
      roughness: 0.42,
      metalness: 0.05,
    });

    return {
      silverFrame,
      chrome,
      weightPlateIron,
      pulleyBlack,
      upholstery,
      blackRubber,
      steelCable,
      safetyYellow,
      redBushing,
      studdedFootplate,
      braidedRope,
      logoDecal,
      placardMat,
      cautionMat,
    };
  }

  createSurfaceGrain(size, strength) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const data = ctx.createImageData(size, size);
    let seed = 417;
    for (let i = 0; i < data.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const value = 128 + ((seed / 4294967296) - 0.5) * 110 * strength;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = value;
      data.data[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    return texture;
  }

  createStuddedFootplateTexture() {
    const size = 256;
    const cCanvas = document.createElement('canvas');
    cCanvas.width = size;
    cCanvas.height = size;
    const cCtx = cCanvas.getContext('2d');

    const bCanvas = document.createElement('canvas');
    bCanvas.width = size;
    bCanvas.height = size;
    const bCtx = bCanvas.getContext('2d');

    cCtx.fillStyle = '#75787d';
    cCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#404040';
    bCtx.fillRect(0, 0, size, size);

    const cols = 8;
    const rows = 10;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = ((c + 0.5) / cols) * size;
        const cy = ((r + 0.5) / rows) * size;
        cCtx.fillStyle = '#8b8f96';
        cCtx.beginPath();
        cCtx.ellipse(cx, cy, 8, 11, 0, 0, Math.PI * 2);
        cCtx.fill();

        cCtx.strokeStyle = '#55585c';
        cCtx.lineWidth = 1.5;
        cCtx.stroke();

        const grad = bCtx.createRadialGradient(cx, cy, 1, cx, cy, 10);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.75, '#b0b0b0');
        grad.addColorStop(1, '#404040');
        bCtx.fillStyle = grad;
        bCtx.beginPath();
        bCtx.ellipse(cx, cy, 9, 12, 0, 0, Math.PI * 2);
        bCtx.fill();
      }
    }

    const colorMap = new THREE.CanvasTexture(cCanvas);
    colorMap.colorSpace = THREE.SRGBColorSpace;
    const bumpMap = new THREE.CanvasTexture(bCanvas);
    return { colorMap, bumpMap };
  }

  createBraidedRopeTexture() {
    const w = 128;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, w, h);

    const stripeCount = 8;
    for (let i = -stripeCount; i < stripeCount * 2; i++) {
      const y0 = (i / stripeCount) * h;
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.lineTo(w, y0 + h * 0.5);
      ctx.lineWidth = 14;
      ctx.strokeStyle = i % 2 === 0 ? '#dc2626' : '#111215';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, y0 + 6);
      ctx.lineTo(w, y0 + h * 0.5 + 6);
      ctx.lineWidth = 3;
      ctx.strokeStyle = i % 2 === 0 ? '#f87171' : '#3f3f46';
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 3);
    return tex;
  }

  createLifeFitnessLogoTexture() {
    const w = 128;
    const h = 512;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w * 0.58, h * 0.5);
    ctx.rotate(-Math.PI / 2);
    ctx.font = 'italic bold 54px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(20, 22, 26, 0.85)';
    ctx.strokeText('Life Fitness', 0, 0);

    const grad = ctx.createLinearGradient(-180, -25, 180, 25);
    grad.addColorStop(0.0, '#e2e8f0');
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(1.0, '#94a3b8');
    ctx.fillStyle = grad;
    ctx.fillText('Life Fitness', 0, 0);
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  createPlacardTexture() {
    const w = 128;
    const h = 384;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Top white/orange warning sticker
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(10, 8, w - 20, 95);
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(14, 12, w - 28, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WARNING', w / 2, 28);
    ctx.fillStyle = '#1e293b';
    ctx.font = '9px sans-serif';
    ctx.fillText('KEEP CLEAR OF', w / 2, 48);
    ctx.fillText('MOVING WEIGHTS', w / 2, 62);
    ctx.fillText('INSERT PIN FULLY', w / 2, 76);

    // Lower dark instructional placard (matching IMG_2246 & IMG_2251)
    ctx.fillStyle = '#18181b';
    ctx.fillRect(6, 118, w - 12, h - 126);
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 120, w - 16, h - 130);

    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('CABLE MOTION', w / 2, 142);

    // Diagram boxes
    ctx.fillStyle = '#27272a';
    ctx.fillRect(16, 155, w - 32, 90);
    ctx.fillRect(16, 258, w - 32, 95);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(w / 2, 182, 10, 0, Math.PI * 2);
    ctx.moveTo(w / 2, 192);
    ctx.lineTo(w / 2, 224);
    ctx.moveTo(w / 2 - 16, 205);
    ctx.lineTo(w / 2 + 16, 205);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(w / 2, 295, 14, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Generates a crisp canvas texture for a single weight plate's front face,
   * with dual-column weight numbers on both sides of the center pin hole (matching IMG_2255).
   */
  createPlateLabelMaterial(label, isTopPlate = false) {
    const w = 256;
    const h = 64;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1c1e22';
    ctx.fillRect(0, 0, w, h);

    // Subtle cast-iron grain
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fillRect(0, 2, w, 3);

    // Center selector hole shadow
    ctx.fillStyle = '#070809';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3f434a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dual weight numbers (left and right of pin hole, as in IMG_2255 & IMG_2249)
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2 - 42, h / 2 + 1);
    if (!isTopPlate) {
      ctx.fillText(label, w / 2 + 42, h / 2 + 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: tex,
      roughness: 0.48,
      metalness: 0.35,
    });
  }

  // ============================================================================
  // 1. Central 4-Column Cage Frame
  // ============================================================================
  buildCentralCageFrame() {
    const frameGroup = new THREE.Group();
    frameGroup.name = 'CentralCageFrame';
    this.root.add(frameGroup);

    const { silverFrame, blackRubber, logoDecal, placardMat, chrome } = this.materials;

    // 4 Corner Columns: X = ±0.36m, Z = ±0.42m
    const colPositions = [
      { x: -0.36, z: 0.42, rotY: 0, name: 'Col_SW' },
      { x: 0.36, z: 0.42, rotY: 0, name: 'Col_SE' },
      { x: -0.36, z: -0.42, rotY: Math.PI, name: 'Col_NW' },
      { x: 0.36, z: -0.42, rotY: Math.PI, name: 'Col_NE' },
    ];

    const colGeo = new THREE.CylinderGeometry(0.044, 0.044, 2.04, 24);
    colGeo.scale(1.15, 1.0, 0.82); // Oval Life Fitness Signature column profile

    const footGeo = new THREE.BoxGeometry(0.15, 0.032, 0.12);
    const bossGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.018, 14);
    bossGeo.rotateX(Math.PI / 2);

    for (const c of colPositions) {
      const colMesh = new THREE.Mesh(colGeo, silverFrame);
      colMesh.position.set(c.x, 1.04, c.z);
      frameGroup.add(colMesh);

      // Molded rubber floor boot
      const foot = new THREE.Mesh(footGeo, blackRubber);
      foot.position.set(c.x, 0.016, c.z);
      frameGroup.add(foot);

      // Curved upper arch connecting each column to the central top cap (y = 2.06m -> 2.34m)
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(c.x, 2.05, c.z),
        new THREE.Vector3(c.x * 0.88, 2.24, c.z * 0.88),
        new THREE.Vector3(c.x * 0.42, 2.34, c.z * 0.42),
        new THREE.Vector3(0.0, 2.34, 0.0),
      ]);
      const archGeo = new THREE.TubeGeometry(curve, 18, 0.036, 16, false);
      frameGroup.add(new THREE.Mesh(archGeo, silverFrame));

      const zSign = Math.sign(c.z);
      // Life Fitness vertical raised script decal
      const logoPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.34), logoDecal);
      logoPlane.position.set(c.x, 1.82, c.z + zSign * 0.038);
      if (zSign < 0) logoPlane.rotation.y = Math.PI;
      frameGroup.add(logoPlane);

      // Instructional placard below logo
      const placardPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.078, 0.28), placardMat);
      placardPlane.position.set(c.x, 1.38, c.z + zSign * 0.038);
      if (zSign < 0) placardPlane.rotation.y = Math.PI;
      frameGroup.add(placardPlane);

      // Black rubber-coated accessory storage horn sticking out sideways (IMG_2255)
      const xSign = Math.sign(c.x);
      const hornGeo = new THREE.CylinderGeometry(0.011, 0.013, 0.095, 14);
      hornGeo.rotateZ(-xSign * (Math.PI / 2 - 0.15));
      const horn = new THREE.Mesh(hornGeo, blackRubber);
      horn.position.set(c.x + xSign * 0.08, 1.47, c.z);
      frameGroup.add(horn);

      // Chrome bolt bosses on column face (IMG_2255)
      for (const by of [1.02, 1.16]) {
        const boss = new THREE.Mesh(bossGeo, chrome);
        boss.position.set(c.x, by, c.z + zSign * 0.038);
        frameGroup.add(boss);
      }
    }

    // Central Top Hub Cap (visible in IMG_2248, IMG_2249, IMG_2263)
    const hubCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.088, 0.18, 24),
      silverFrame
    );
    hubCylinder.position.set(0, 2.31, 0);
    frameGroup.add(hubCylinder);

    const hubCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.092, 0.092, 0.035, 24),
      blackRubber
    );
    hubCap.position.set(0, 2.405, 0);
    frameGroup.add(hubCap);

    // Lower Perimeter Base Rails (y = 0.13m) & Internal Stack Support Bars
    const railRadius = 0.027;
    const addBar = (p0, p1, r = railRadius, mat = silverFrame) => {
      const vec = new THREE.Vector3().subVectors(p1, p0);
      const len = vec.length();
      const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
      const geo = new THREE.CylinderGeometry(r, r, len, 18);
      geo.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(mid);
      mesh.lookAt(p1);
      frameGroup.add(mesh);
      return mesh;
    };

    // Outer bottom rectangle (y = 0.13m)
    addBar(new THREE.Vector3(-0.36, 0.13, 0.42), new THREE.Vector3(0.36, 0.13, 0.42));
    addBar(new THREE.Vector3(-0.36, 0.13, -0.42), new THREE.Vector3(0.36, 0.13, -0.42));
    addBar(new THREE.Vector3(-0.36, 0.13, -0.42), new THREE.Vector3(-0.36, 0.13, 0.42));
    addBar(new THREE.Vector3(0.36, 0.13, -0.42), new THREE.Vector3(0.36, 0.13, 0.42));

    // Inner bottom weight-stack support crossbars (y = 0.13m)
    addBar(new THREE.Vector3(-0.36, 0.13, 0.285), new THREE.Vector3(0.36, 0.13, 0.285), 0.022);
    addBar(new THREE.Vector3(-0.36, 0.13, -0.285), new THREE.Vector3(0.36, 0.13, -0.285), 0.022);
    addBar(new THREE.Vector3(-0.24, 0.13, -0.285), new THREE.Vector3(-0.24, 0.13, 0.285), 0.022);
    addBar(new THREE.Vector3(0.24, 0.13, -0.285), new THREE.Vector3(0.24, 0.13, 0.285), 0.022);

    // Upper Perimeter Cross-Tubes (y = 2.08m) & Guide-Rod Top Support Frame
    addBar(new THREE.Vector3(-0.36, 2.08, 0.42), new THREE.Vector3(0.36, 2.08, 0.42), 0.024);
    addBar(new THREE.Vector3(-0.36, 2.08, -0.42), new THREE.Vector3(0.36, 2.08, -0.42), 0.024);
    addBar(new THREE.Vector3(-0.36, 2.08, -0.42), new THREE.Vector3(-0.36, 2.08, 0.42), 0.024);
    addBar(new THREE.Vector3(0.36, 2.08, -0.42), new THREE.Vector3(0.36, 2.08, 0.42), 0.024);

    addBar(new THREE.Vector3(-0.36, 2.08, 0.285), new THREE.Vector3(0.36, 2.08, 0.285), 0.020);
    addBar(new THREE.Vector3(-0.36, 2.08, -0.285), new THREE.Vector3(0.36, 2.08, -0.285), 0.020);
    addBar(new THREE.Vector3(-0.24, 2.08, -0.285), new THREE.Vector3(-0.24, 2.08, 0.285), 0.020);
    addBar(new THREE.Vector3(0.24, 2.08, -0.285), new THREE.Vector3(0.24, 2.08, 0.285), 0.020);
  }

  // ============================================================================
  // 2. All 4 Weight Stacks + Guide Rods + Selector Pins + Increment Donuts
  // ============================================================================
  buildAllWeightStacks() {
    for (const [stationId, cfg] of Object.entries(STATION_CONFIGS)) {
      this.buildSingleWeightStack(stationId, cfg);
    }
  }

  buildSingleWeightStack(stationId, cfg) {
    const {
      chrome,
      weightPlateIron,
      blackRubber,
      safetyYellow,
      redBushing,
      silverFrame,
      pulleyBlack,
    } = this.materials;

    const stackGroup = new THREE.Group();
    stackGroup.name = `WeightStack_${stationId}`;
    stackGroup.position.copy(cfg.stackCenter);
    stackGroup.rotation.y = cfg.stackRotY;
    this.root.add(stackGroup);

    const rodOffset = 0.092; // ±9.2cm guide rod spacing
    const rodBottomY = 0.14;
    const rodTopY = 2.08;
    const rodHeight = rodTopY - rodBottomY;

    // Twin Polished Stainless Steel Guide Rods
    const rodGeo = new THREE.CylinderGeometry(0.0095, 0.0095, rodHeight, 16);
    const bumperGeo = new THREE.CylinderGeometry(0.026, 0.028, 0.028, 18);
    for (const rx of [-rodOffset, rodOffset]) {
      const rod = new THREE.Mesh(rodGeo, chrome);
      rod.position.set(rx, rodBottomY + rodHeight * 0.5, 0);
      stackGroup.add(rod);

      // Bottom rubber shock-absorber donut bumper
      const bumper = new THREE.Mesh(bumperGeo, blackRubber);
      bumper.position.set(rx, rodBottomY + 0.014, 0);
      stackGroup.add(bumper);

      // Upper rubber travel-limit stop
      const topStop = new THREE.Mesh(bumperGeo, blackRubber);
      topStop.position.set(rx, rodTopY - 0.02, 0);
      stackGroup.add(topStop);
    }

    // Build discrete cast-iron plates from bottom to top
    const numPlates = cfg.plates.length;
    const plateData = [];
    let currentY = rodBottomY + 0.028; // on top of bottom rubber bumpers
    const plateGap = 0.0022;

    // First compute heights from bottom plate (index N-1) up to top plate (index 0)
    const restBottomYs = new Array(numPlates);
    const thicknesses = cfg.plates.map((p) => (p.wide ? 0.034 : 0.025));

    for (let i = numPlates - 1; i >= 0; i--) {
      restBottomYs[i] = currentY;
      currentY += thicknesses[i] + plateGap;
    }

    const narrowGeo = new RoundedBoxGeometry(0.245, 0.025, 0.092, 2, 0.003);
    const wideGeo = new RoundedBoxGeometry(0.335, 0.034, 0.092, 2, 0.004);

    for (let i = 0; i < numPlates; i++) {
      const pSpec = cfg.plates[i];
      const h = thicknesses[i];
      const baseGeo = pSpec.wide ? wideGeo : narrowGeo;
      const frontMat = this.createPlateLabelMaterial(pSpec.label, i === 0);

      // Multi-material box: [+X, -X, +Y, -Y, +Z (front label), -Z]
      const mats = [
        weightPlateIron,
        weightPlateIron,
        weightPlateIron,
        weightPlateIron,
        frontMat,
        weightPlateIron,
      ];

      const plateGroup = new THREE.Group();
      plateGroup.name = `${stationId}_Plate_${i}_${pSpec.label}lbs`;
      const restCenterY = restBottomYs[i] + h * 0.5;
      plateGroup.position.set(0, restCenterY, 0);

      const plateMesh = new THREE.Mesh(baseGeo, mats);
      plateMesh.userData = {
        interactiveType: 'weightPlate',
        stationId,
        plateIndex: i,
        lbs: pSpec.lbs,
        label: pSpec.label,
      };
      this.interactiveObjects.push(plateMesh);
      plateGroup.add(plateMesh);

      // Top plate special details (IMG_2255): red guide-rod bushings, central threaded stem bolt,
      // and perforated selector stem hanging down inside the stack
      if (i === 0) {
        const bushingGeo = new THREE.CylinderGeometry(0.017, 0.019, 0.008, 16);
        for (const rx of [-rodOffset, rodOffset]) {
          const bushing = new THREE.Mesh(bushingGeo, redBushing);
          bushing.position.set(rx, h * 0.5 + 0.004, 0);
          plateGroup.add(bushing);
        }

        // Top threaded cable anchor stem + hex jam nut (IMG_2255)
        const stemCyl = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, 0.065, 16),
          chrome
        );
        stemCyl.position.set(0, h * 0.5 + 0.032, 0);
        plateGroup.add(stemCyl);

        const hexNut = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.022, 0.014, 6),
          chrome
        );
        hexNut.position.set(0, h * 0.5 + 0.016, 0);
        plateGroup.add(hexNut);

        // Internal perforated selector stem going down through the plates
        const totalStackHeight = restCenterY - restBottomYs[numPlates - 1];
        const internalRod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.011, 0.011, totalStackHeight, 12),
          chrome
        );
        internalRod.position.set(0, -totalStackHeight * 0.5, 0);
        plateGroup.add(internalRod);
      }

      stackGroup.add(plateGroup);
      plateData.push({
        index: i,
        lbs: pSpec.lbs,
        label: pSpec.label,
        thickness: h,
        restCenterY,
        group: plateGroup,
        mesh: plateMesh,
      });
    }

    // Selector Pin Mesh (inserted into the active plate)
    const pinGroup = new THREE.Group();
    pinGroup.name = `${stationId}_SelectorPin`;
    const pinShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0055, 0.0055, 0.11, 12),
      chrome
    );
    pinShaft.rotation.x = Math.PI / 2;
    pinShaft.position.z = 0.025;
    pinGroup.add(pinShaft);

    if (cfg.pinColor === 'yellow') {
      // Yellow L-shaped handle pin (matching East/West stacks in IMG_2251 & IMG_2254)
      const handleCollar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.013, 0.013, 0.032, 16),
        safetyYellow
      );
      handleCollar.rotation.x = Math.PI / 2;
      handleCollar.position.z = 0.068;
      pinGroup.add(handleCollar);

      const lDrop = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.048, 0.016),
        safetyYellow
      );
      lDrop.position.set(0, -0.018, 0.082);
      pinGroup.add(lDrop);
    } else {
      // Round black magnetic knob pin (matching South/North stacks in IMG_2255)
      const knob = new THREE.Mesh(
        new THREE.CylinderGeometry(0.019, 0.017, 0.018, 20),
        blackRubber
      );
      knob.rotation.x = Math.PI / 2;
      knob.position.z = 0.064;
      pinGroup.add(knob);

      const silverCenter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, 0.020, 14),
        chrome
      );
      silverCenter.rotation.x = Math.PI / 2;
      silverCenter.position.z = 0.065;
      pinGroup.add(silverCenter);
    }

    pinGroup.traverse((child) => {
      if (child.isMesh) {
        child.userData = {
          interactiveType: 'selectorPin',
          stationId,
        };
        this.interactiveObjects.push(child);
      }
    });
    stackGroup.add(pinGroup);

    // Optional +5 lb Rubber Add-On Increment Weight Donut sitting on top of Plate 0
    const addonGroup = new THREE.Group();
    addonGroup.name = `${stationId}_AddonWeightDonut`;
    const donutMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.088, 0.034, 24),
      blackRubber
    );
    const donutRecess = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 0.036, 18),
      weightPlateIron
    );
    addonGroup.add(donutMesh, donutRecess);
    addonGroup.visible = false;
    stackGroup.add(addonGroup);

    // For 2:1 station (North Adjustable Column), build the floating pulley block mounted directly
    // on top of the top weight plate stem (clearly visible in IMG_2249, IMG_2250, IMG_2251!)
    let floatingPulleySheave = null;
    if (cfg.ratio < 0.99) {
      const floatBracket = new THREE.Group();
      floatBracket.position.set(0, thicknesses[0] * 0.5 + 0.095, 0);

      for (const sx of [-0.022, 0.022]) {
        const sidePlate = new THREE.Mesh(
          new THREE.BoxGeometry(0.006, 0.11, 0.085),
          weightPlateIron
        );
        sidePlate.position.set(sx, 0, 0);
        floatBracket.add(sidePlate);
      }

      floatingPulleySheave = this.createPulleySheave(0.048, 0.024);
      floatingPulleySheave.position.set(0, 0.015, 0);
      floatBracket.add(floatingPulleySheave);

      plateData[0].group.add(floatBracket);
    }

    const topPlateRestY = plateData[0].restCenterY;
    const stemTopOffset = cfg.ratio < 0.99 ? 0.11 : 0.065;

    this.stations[stationId] = {
      id: stationId,
      config: cfg,
      stackGroup,
      plates: plateData,
      pinGroup,
      addonGroup,
      floatingPulleySheave,
      topPlateRestY,
      stemTopOffset,

      // Dynamic physical state
      pinIndex: cfg.defaultPinIndex,
      addonWeightActive: false,
      attachmentType: cfg.defaultAttachment,

      cablePull: 0.0, // meters of cable pulled past rest position (s >= 0)
      stackLift: 0.0, // meters of vertical weight stack lift (y_stack = ratio * s)
      stackVelocity: 0.0, // m/s vertical stack velocity
      cableTensionN: 0.0, // instantaneous cable tension in Newtons
      appliedForceN: 0.0, // user applied pulling force in Newtons
      isDraggingHandle: false,
      targetPullDistance: 0.0,
      pullDirection: cfg.pullAxisDefault.clone(),

      // Auto-rep workout generator state
      autoRepActive: false,
      autoRepPhase: 0.0,
      autoRepSpeed: 1.8, // rad/s
      autoRepTargetPull: 0.62, // meters
      repCount: 0,

      // References filled by station builders
      sheaves: [],
      swivelGroup: null,
      cableMesh: null,
      handleGroup: null,
      handleHitMesh: null,
      exitWorldPoint: new THREE.Vector3(),
      stackTopWorldPoint: new THREE.Vector3(),
    };
  }

  /**
   * Builds a detailed pulley sheave with outer groove, bearing hub, and spokes
   * so sheave rotation is clearly visible during cable travel.
   */
  createPulleySheave(radius = 0.055, thickness = 0.026, axis = 'x') {
    const { pulleyBlack, chrome, silverFrame } = this.materials;
    const group = new THREE.Group();

    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, thickness, 24),
      pulleyBlack
    );
    const groove = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.88, radius * 0.88, thickness * 1.04, 24),
      pulleyBlack
    );
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.26, radius * 0.26, thickness * 1.18, 16),
      chrome
    );

    // Radial indicator bolts/spokes so rotation is unmistakably visible
    const boltGeo = new THREE.CylinderGeometry(0.0045, 0.0045, thickness * 1.12, 8);
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2;
      const bolt = new THREE.Mesh(boltGeo, silverFrame);
      bolt.position.set(
        Math.cos(ang) * radius * 0.58,
        0,
        Math.sin(ang) * radius * 0.58
      );
      wheel.add(bolt);
    }

    wheel.add(groove, hub);
    if (axis === 'x') {
      wheel.rotation.z = Math.PI / 2;
    } else if (axis === 'z') {
      wheel.rotation.x = Math.PI / 2;
    }
    group.add(wheel);
    group.userData.wheelMesh = wheel;
    group.userData.radius = radius;
    group.userData.axis = axis;
    return group;
  }

  // ============================================================================
  // 3. Station 1: South High Pulley / Tricep Pushdown (+Z)
  // ============================================================================
  buildSouthHighPulleyStation() {
    const st = this.stations.southHighPulley;
    const { silverFrame } = this.materials;

    const group = new THREE.Group();
    group.name = 'Station_SouthHighPulley';
    this.root.add(group);

    // Overhead cantilevered pulley bracket projecting South (+Z) at y = 2.26m (IMG_2246, IMG_2253)
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.065, 0.44),
      silverFrame
    );
    beam.position.set(0, 2.26, 0.36);
    group.add(beam);

    // Flared side shroud plates
    for (const sx of [-0.048, 0.048]) {
      const shroud = new THREE.Mesh(
        new THREE.BoxGeometry(0.008, 0.14, 0.36),
        silverFrame
      );
      shroud.position.set(sx, 2.22, 0.39);
      group.add(shroud);
    }

    // Rear pulley directly over South stack stem (0, 2.23, 0.285)
    const rearSheave = this.createPulleySheave(0.054, 0.025, 'x');
    rearSheave.position.set(0, 2.23, 0.285);
    group.add(rearSheave);

    // Front swiveling high pulley housing at (0, 2.18, 0.52)
    const swivelGroup = new THREE.Group();
    swivelGroup.position.set(0, 2.18, 0.52);
    group.add(swivelGroup);

    const frontSheave = this.createPulleySheave(0.054, 0.025, 'x');
    swivelGroup.add(frontSheave);

    st.sheaves.push(
      { sheave: rearSheave, ratio: 1.0 },
      { sheave: frontSheave, ratio: 1.0 }
    );
    st.swivelGroup = swivelGroup;
    st.exitWorldPoint.set(0, 2.15, 0.54);
    st.internalWaypoints = [
      new THREE.Vector3(0, 2.23, 0.285),
      new THREE.Vector3(0, 2.20, 0.52),
    ];

    st.cableMesh = new THREE.Mesh(new DynamicCable(), this.materials.steelCable);
    this.root.add(st.cableMesh);

    st.handleGroup = this.createHandleAttachment(
      st.attachmentType,
      'southHighPulley'
    );
    this.root.add(st.handleGroup);
  }

  // ============================================================================
  // 4. Station 2: East Lat Pulldown (+X) — Overhead Boom, Seat & Thigh Rollers
  // ============================================================================
  buildEastLatPulldownStation() {
    const st = this.stations.eastLatPulldown;
    const { silverFrame, upholstery, blackRubber, chrome, safetyYellow } =
      this.materials;

    const group = new THREE.Group();
    group.name = 'Station_EastLatPulldown';
    this.root.add(group);

    // 1. Overhead Horizontal Lat Pulldown Boom extending East (+X) to x = +1.14m (IMG_2246 right)
    const boomGeo = new THREE.CylinderGeometry(0.034, 0.034, 1.08, 20);
    boomGeo.rotateZ(Math.PI / 2);
    const boom = new THREE.Mesh(boomGeo, silverFrame);
    boom.position.set(0.62, 2.28, 0);
    group.add(boom);

    // Diagonal triangular gusset under boom (IMG_2263 top-right)
    const gusset = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.11, 0.018),
      silverFrame
    );
    gusset.position.set(0.52, 2.21, 0);
    gusset.rotation.z = 0.25;
    group.add(gusset);

    // Distal pulley housing at tip of boom (x = +1.08m, y = 2.15m) with round black shroud (IMG_2246)
    const tipHousing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.072, 0.072, 0.048, 24),
      this.materials.pulleyBlack
    );
    tipHousing.rotation.x = Math.PI / 2;
    tipHousing.position.set(1.08, 2.15, 0);
    group.add(tipHousing);

    const innerSheave = this.createPulleySheave(0.054, 0.025, 'z');
    innerSheave.position.set(0.24, 2.24, 0);
    group.add(innerSheave);

    const tipSheave = this.createPulleySheave(0.058, 0.026, 'z');
    tipSheave.position.set(1.08, 2.15, 0);
    group.add(tipSheave);

    st.sheaves.push(
      { sheave: innerSheave, ratio: 1.0 },
      { sheave: tipSheave, ratio: 1.0 }
    );

    // 2. Lower Lat Pulldown Seat Frame & Adjustable Thigh Hold-Down Rollers (IMG_2246 right, IMG_2251 left)
    // U-shaped horizontal stabilizer loop from East columns (x=0.36, z=±0.42) to support post (x=0.76, z=0)
    const loopCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.36, 0.64, 0.42),
      new THREE.Vector3(0.68, 0.64, 0.34),
      new THREE.Vector3(0.76, 0.64, 0.0),
      new THREE.Vector3(0.68, 0.64, -0.34),
      new THREE.Vector3(0.36, 0.64, -0.42),
    ]);
    group.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(loopCurve, 28, 0.025, 14, false),
        silverFrame
      )
    );

    // Angled main support post for thigh rollers & seat (x = 0.78m on floor -> x = 0.72m at y = 0.74m)
    const postCurve = new THREE.LineCurve3(
      new THREE.Vector3(0.80, 0.02, 0.0),
      new THREE.Vector3(0.72, 0.74, 0.0)
    );
    group.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(postCurve, 8, 0.032, 16, false),
        silverFrame
      )
    );
    const postFoot = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.028, 0.14),
      blackRubber
    );
    postFoot.position.set(0.80, 0.014, 0.0);
    group.add(postFoot);

    // Lower horizontal strut from tower base to post
    const lowerStrut = new THREE.LineCurve3(
      new THREE.Vector3(0.36, 0.22, 0.0),
      new THREE.Vector3(0.78, 0.22, 0.0)
    );
    group.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(lowerStrut, 6, 0.025, 14, false),
        silverFrame
      )
    );

    // Angled seat cantilever beam supporting the Lat Pulldown seat pad (IMG_2246 right)
    const seatBeam = new THREE.LineCurve3(
      new THREE.Vector3(0.77, 0.26, 0.0),
      new THREE.Vector3(1.18, 0.46, 0.0)
    );
    group.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(seatBeam, 8, 0.028, 16, false),
        silverFrame
      )
    );

    // Contoured Black Lat Pulldown Seat Cushion (x = 1.15m, y = 0.48m)
    const seatPad = new THREE.Mesh(
      new RoundedBoxGeometry(0.42, 0.058, 0.31, 4, 0.022),
      upholstery
    );
    seatPad.position.set(1.15, 0.485, 0.0);
    group.add(seatPad);
    this.handleCollisionMeshes.push(seatPad);

    // Yellow spring-loaded pull-pin for thigh roller adjustment (IMG_2251 bottom-left)
    const yellowPinKnob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.038, 16),
      safetyYellow
    );
    yellowPinKnob.rotation.x = Math.PI / 2;
    yellowPinKnob.position.set(0.73, 0.62, -0.052);
    yellowPinKnob.userData = {
      interactiveType: 'thighPadPin',
      stationId: 'eastLatPulldown',
    };
    this.interactiveObjects.push(yellowPinKnob);
    group.add(yellowPinKnob);

    // Telescoping Thigh Hold-Down Roller Pad Assembly (adjustable height)
    this.thighPadGroup = new THREE.Group();
    this.thighPadGroup.name = 'AdjustableThighRollers';
    group.add(this.thighPadGroup);

    const teleStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.22, 16),
      chrome
    );
    teleStem.position.set(0.73, -0.05, 0.0);
    this.thighPadGroup.add(teleStem);

    const rollerArm = new THREE.LineCurve3(
      new THREE.Vector3(0.73, 0.03, 0.0),
      new THREE.Vector3(0.92, 0.01, 0.0)
    );
    this.thighPadGroup.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(rollerArm, 6, 0.022, 14, false),
        silverFrame
      )
    );

    const crossBarGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.44, 14);
    crossBarGeo.rotateX(Math.PI / 2);
    const crossBar = new THREE.Mesh(crossBarGeo, chrome);
    crossBar.position.set(0.92, 0.01, 0.0);
    this.thighPadGroup.add(crossBar);

    const rollerGeo = new THREE.CylinderGeometry(0.062, 0.062, 0.19, 24);
    rollerGeo.rotateX(Math.PI / 2);
    const capGeo = new THREE.CylinderGeometry(0.064, 0.056, 0.016, 24);
    capGeo.rotateX(Math.PI / 2);

    for (const rz of [-0.145, 0.145]) {
      const roller = new THREE.Mesh(rollerGeo, upholstery);
      roller.position.set(0.92, 0.01, rz);
      roller.userData = {
        interactiveType: 'thighPadPin',
        stationId: 'eastLatPulldown',
      };
      this.interactiveObjects.push(roller);
      this.thighPadGroup.add(roller);
      this.handleCollisionMeshes.push(roller);

      const endCap = new THREE.Mesh(capGeo, blackRubber);
      endCap.position.set(0.92, 0.01, rz + Math.sign(rz) * 0.098);
      this.thighPadGroup.add(endCap);
    }

    this.updateThighPadPosition();

    st.exitWorldPoint.set(1.08, 2.09, 0.0);
    st.internalWaypoints = [
      new THREE.Vector3(0.24, 2.25, 0.0),
      new THREE.Vector3(1.08, 2.16, 0.0),
    ];

    st.cableMesh = new THREE.Mesh(new DynamicCable(), this.materials.steelCable);
    this.root.add(st.cableMesh);

    st.handleGroup = this.createHandleAttachment(
      st.attachmentType,
      'eastLatPulldown'
    );
    this.root.add(st.handleGroup);
  }

  updateThighPadPosition() {
    if (!this.thighPadGroup) return;
    const t =
      this.thighPadHoleIndex / Math.max(1, this.thighPadHoleCount - 1);
    const y = this.thighPadMinY + t * (this.thighPadMaxY - this.thighPadMinY);
    this.thighPadGroup.position.set(0, y, 0);
  }

  // ============================================================================
  // 5. Station 3: West Seated Low Row (-X) — Triple Footplates & Long Bench
  // ============================================================================
  buildWestSeatedRowStation() {
    const st = this.stations.westSeatedRow;
    const {
      silverFrame,
      upholstery,
      blackRubber,
      studdedFootplate,
      pulleyBlack,
    } = this.materials;

    const group = new THREE.Group();
    group.name = 'Station_WestSeatedRow';
    this.root.add(group);

    // 1. U-Shaped Horizontal Stabilizer Loop at y = 0.65m (IMG_2246, IMG_2256, IMG_2262)
    const loopCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.36, 0.65, 0.42),
      new THREE.Vector3(-0.66, 0.65, 0.34),
      new THREE.Vector3(-0.74, 0.65, 0.0),
      new THREE.Vector3(-0.66, 0.65, -0.34),
      new THREE.Vector3(-0.36, 0.65, -0.42),
    ]);
    group.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(loopCurve, 28, 0.026, 14, false),
        silverFrame
      )
    );

    // 2. Sweeping Curved Row Riser & Long Horizontal Monorail Beam (IMG_2246, IMG_2256, IMG_2258)
    const riserCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.70, 0.89, 0.0),
      new THREE.Vector3(-0.75, 0.62, 0.0),
      new THREE.Vector3(-0.84, 0.34, 0.0),
      new THREE.Vector3(-0.98, 0.28, 0.0),
      new THREE.Vector3(-2.26, 0.28, 0.0),
    ]);
    const rowRiser = new THREE.Mesh(
      new THREE.TubeGeometry(riserCurve, 32, 0.032, 16, false), silverFrame
    );
    group.add(rowRiser);
    this.handleCollisionMeshes.push(rowRiser);

    // Black angled top cap on riser (IMG_2256)
    const riserCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.034, 0.034, 0.032, 16),
      blackRubber
    );
    riserCap.position.set(-0.695, 0.90, 0.0);
    riserCap.rotation.z = -0.18;
    group.add(riserCap);

    // Lower connecting tube from riser bottom curve into tower base frame
    const baseLink = new THREE.LineCurve3(
      new THREE.Vector3(-0.84, 0.30, 0.0),
      new THREE.Vector3(-0.36, 0.18, 0.0)
    );
    group.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(baseLink, 8, 0.026, 14, false),
        silverFrame
      )
    );

    // 3. Round Black Shrouded Pulley on Front of Riser (prominent in IMG_2256 & IMG_2257)
    const shroudPulley = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082, 0.082, 0.042, 28),
      pulleyBlack
    );
    shroudPulley.rotation.x = Math.PI / 2;
    shroudPulley.position.set(-0.82, 0.78, 0.0);
    group.add(shroudPulley);

    const shroudBracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.085, 0.058),
      silverFrame
    );
    shroudBracket.position.set(-0.76, 0.76, 0.0);
    shroudBracket.rotation.z = -0.18;
    group.add(shroudBracket);

    // 4. Low Row Working Pulley Bracket & Sheaves (IMG_2248, IMG_2262, IMG_2263)
    for (const sz of [-0.026, 0.026]) {
      const cheek = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.16, 0.008),
        silverFrame
      );
      cheek.position.set(-0.56, 0.52, sz);
      group.add(cheek);
    }

    const topWestSheave = this.createPulleySheave(0.052, 0.025, 'z');
    topWestSheave.position.set(-0.24, 2.22, 0.0);
    group.add(topWestSheave);

    const lowRowSheave = this.createPulleySheave(0.054, 0.025, 'z');
    lowRowSheave.position.set(-0.56, 0.54, 0.0);
    group.add(lowRowSheave);

    st.sheaves.push(
      { sheave: topWestSheave, ratio: 1.0 },
      { sheave: lowRowSheave, ratio: 1.0 }
    );

    // 5. Triple Diamond-Plate / Studded Footplates (IMG_2256, IMG_2262, IMG_2263)
    // Upper central angled studded footplate
    const upperFootplate = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.31, 0.30),
      studdedFootplate
    );
    upperFootplate.position.set(-0.86, 0.45, 0.0);
    upperFootplate.rotation.z = -0.62;
    group.add(upperFootplate);
    this.handleCollisionMeshes.push(upperFootplate);

    // Lower footplate horizontal support crossbar (IMG_2256)
    const footBarGeo = new THREE.CylinderGeometry(0.020, 0.020, 0.52, 16);
    footBarGeo.rotateX(Math.PI / 2);
    const footBar = new THREE.Mesh(footBarGeo, silverFrame);
    footBar.position.set(-1.02, 0.25, 0.0);
    group.add(footBar);
    this.handleCollisionMeshes.push(footBar);

    // Lower Left & Right Studded Footplates (IMG_2248, IMG_2262, IMG_2263)
    for (const fz of [-0.18, 0.18]) {
      const lowerFoot = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.28, 0.155),
        studdedFootplate
      );
      lowerFoot.position.set(-1.03, 0.27, fz);
      lowerFoot.rotation.z = -0.42;
      group.add(lowerFoot);
      this.handleCollisionMeshes.push(lowerFoot);
    }

    // Black anti-scuff grip wrap & horizontal bar rest (IMG_2256)
    const gripWrap = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.068, 0.068),
      blackRubber
    );
    gripWrap.position.set(-1.12, 0.28, 0.0);
    group.add(gripWrap);
    this.handleCollisionMeshes.push(gripWrap);

    const barCatch = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.012, 0.44),
      this.materials.weightPlateIron
    );
    barCatch.position.set(-1.10, 0.32, 0.0);
    group.add(barCatch);
    this.handleCollisionMeshes.push(barCatch);

    // 6. Rear Bench Pedestal Leg & Long Black Upholstered Seat Pad (IMG_2246, IMG_2258, IMG_2262)
    const rearLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.036, 0.42, 18),
      silverFrame
    );
    rearLeg.position.set(-2.20, 0.21, 0.0);
    group.add(rearLeg);

    const rearFoot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.092, 0.028, 20),
      blackRubber
    );
    rearFoot.position.set(-2.20, 0.014, 0.0);
    group.add(rearFoot);

    const rowBenchPad = new THREE.Mesh(
      new RoundedBoxGeometry(1.02, 0.065, 0.29, 4, 0.025),
      upholstery
    );
    rowBenchPad.position.set(-1.80, 0.45, 0.0);
    group.add(rowBenchPad);
    this.handleCollisionMeshes.push(rowBenchPad);

    st.exitWorldPoint.set(-0.88, 0.56, 0.0);
    st.internalWaypoints = [
      new THREE.Vector3(-0.24, 2.22, 0.0),
      new THREE.Vector3(-0.56, 0.54, 0.0),
      new THREE.Vector3(-0.88, 0.56, 0.0),
    ];

    st.cableMesh = new THREE.Mesh(new DynamicCable(), this.materials.steelCable);
    this.root.add(st.cableMesh);

    st.handleGroup = this.createHandleAttachment(
      st.attachmentType,
      'westSeatedRow'
    );
    this.root.add(st.handleGroup);
  }

  // ============================================================================
  // 6. Station 4: North Adjustable Hi/Low Cable Column (-Z) — 2:1 Compound Ratio
  // ============================================================================
  buildNorthAdjustableColumnStation() {
    const st = this.stations.northAdjustableColumn;
    const {
      silverFrame,
      chrome,
      blackRubber,
      cautionMat,
      steelCable,
    } = this.materials;

    const group = new THREE.Group();
    group.name = 'Station_NorthAdjustableColumn';
    this.root.add(group);

    // Position of the external vertical chrome guide column (IMG_2248, IMG_2249, IMG_2251)
    const colX = 0.20;
    const colZ = -0.58;

    // 1. Vertical Chrome Guide Column with 18 Laser-Marked Adjustment Holes (y = 0.04m..2.28m)
    const guideCol = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 2.24, 20),
      chrome
    );
    guideCol.position.set(colX, 1.16, colZ);
    group.add(guideCol);

    // 18 visual hole markers along the column
    const holeGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.046, 10);
    holeGeo.rotateZ(Math.PI / 2);
    for (let i = 0; i < this.carriageHoleCount; i++) {
      const hy =
        this.carriageMinY +
        (i / (this.carriageHoleCount - 1)) *
          (this.carriageMaxY - this.carriageMinY);
      const hole = new THREE.Mesh(holeGeo, blackRubber);
      hole.position.set(colX, hy, colZ);
      group.add(hole);
    }

    // Bottom curved silver triangular gusset bracket connecting chrome column to tower base (IMG_2249, IMG_2251)
    const gusset = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.22, 0.24),
      silverFrame
    );
    gusset.position.set(colX, 0.13, -0.47);
    group.add(gusset);

    const colFoot = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.024, 0.11),
      blackRubber
    );
    colFoot.position.set(colX, 0.012, colZ);
    group.add(colFoot);

    // Bottom return pulley at foot of chrome column
    const botColSheave = this.createPulleySheave(0.045, 0.022, 'x');
    botColSheave.position.set(colX, 0.10, colZ - 0.045);
    group.add(botColSheave);

    // Top column pulley bracket & short crossover header stub (IMG_2248, IMG_2249, IMG_2251)
    const headerStub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.65, 18),
      silverFrame
    );
    headerStub.rotation.x = Math.PI / 2;
    headerStub.position.set(colX, 2.28, -0.58);
    group.add(headerStub);

    // Pull-up bar grips with yellow caution tape on North side (IMG_2248, IMG_2256)
    for (const px of [-0.18, 0.18]) {
      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.26, 12),
        cautionMat
      );
      grip.rotation.z = px * 1.2;
      grip.position.set(colX + px, 2.24, -0.86);
      group.add(grip);
    }

    const topStackSheave = this.createPulleySheave(0.052, 0.024, 'x');
    topStackSheave.position.set(0.0, 2.22, -0.285);
    group.add(topStackSheave);

    const topColSheave = this.createPulleySheave(0.052, 0.024, 'x');
    topColSheave.position.set(colX, 2.20, colZ - 0.045);
    group.add(topColSheave);

    // Static vertical loop cable along the adjustable column (connects top & bottom sheaves)
    const staticLoopPts = [
      new THREE.Vector3(colX, 2.20, colZ - 0.03),
      new THREE.Vector3(colX, 0.10, colZ - 0.03),
    ];
    const staticLoopGeo = new THREE.TubeGeometry(
      new THREE.LineCurve3(staticLoopPts[0], staticLoopPts[1]),
      4,
      0.0032,
      8,
      false
    );
    group.add(new THREE.Mesh(staticLoopGeo, steelCable));

    // 2. Sliding Adjustable Pulley Carriage (rides along chrome column, IMG_2249 & IMG_2251)
    this.carriageGroup = new THREE.Group();
    this.carriageGroup.name = 'AdjustablePulleyCarriage';
    group.add(this.carriageGroup);

    // Sleeve wrapping the chrome guide tube
    const sleeve = new THREE.Mesh(
      new THREE.BoxGeometry(0.068, 0.15, 0.072),
      silverFrame
    );
    this.carriageGroup.add(sleeve);

    // Spring-loaded locking pull-pin handle on the side of the carriage (IMG_2249)
    const lockPinShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.055, 12),
      chrome
    );
    lockPinShaft.rotation.z = Math.PI / 2;
    lockPinShaft.position.set(0.05, 0, 0);
    const lockPinKnob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.020, 0.018, 0.028, 16),
      blackRubber
    );
    lockPinKnob.rotation.z = Math.PI / 2;
    lockPinKnob.position.set(0.078, 0, 0);
    this.carriageGroup.add(lockPinShaft, lockPinKnob);

    // Swiveling rounded-plate pulley shroud (characteristic Life Fitness shape in IMG_2249 & IMG_2251)
    const carriageSwivel = new THREE.Group();
    carriageSwivel.position.set(0, 0, -0.085);
    this.carriageGroup.add(carriageSwivel);

    for (const sx of [-0.022, 0.022]) {
      const cheekDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.082, 0.082, 0.006, 24),
        silverFrame
      );
      cheekDisc.rotation.z = Math.PI / 2;
      cheekDisc.position.set(sx, 0.02, -0.02);
      carriageSwivel.add(cheekDisc);
    }

    const carriageSheaveUpper = this.createPulleySheave(0.048, 0.024, 'x');
    carriageSheaveUpper.position.set(0, 0.042, -0.02);
    const carriageSheaveLower = this.createPulleySheave(0.048, 0.024, 'x');
    carriageSheaveLower.position.set(0, -0.015, -0.03);
    carriageSwivel.add(carriageSheaveUpper, carriageSheaveLower);

    this.carriageGroup.traverse((child) => {
      if (child.isMesh) {
        child.userData = {
          interactiveType: 'adjustableCarriage',
          stationId: 'northAdjustableColumn',
        };
        this.interactiveObjects.push(child);
      }
    });

    st.swivelGroup = carriageSwivel;
    st.sheaves.push(
      { sheave: topStackSheave, ratio: 0.5 },
      { sheave: topColSheave, ratio: 1.0 },
      { sheave: botColSheave, ratio: 0.5 },
      { sheave: carriageSheaveUpper, ratio: 1.0 },
      { sheave: carriageSheaveLower, ratio: 1.0 }
    );
    if (st.floatingPulleySheave) {
      st.sheaves.push({ sheave: st.floatingPulleySheave, ratio: 0.5 });
    }

    st.cableMesh = new THREE.Mesh(new DynamicCable(), steelCable);
    this.root.add(st.cableMesh);

    st.handleGroup = this.createHandleAttachment(
      st.attachmentType,
      'northAdjustableColumn'
    );
    this.root.add(st.handleGroup);

    this.updateCarriagePosition();
  }

  updateCarriagePosition() {
    const st = this.stations.northAdjustableColumn;
    if (!this.carriageGroup || !st) return;

    const colX = 0.20;
    const colZ = -0.58;
    const t =
      this.carriageHoleIndex / Math.max(1, this.carriageHoleCount - 1);
    const y = this.carriageMinY + t * (this.carriageMaxY - this.carriageMinY);

    this.carriageGroup.position.set(colX, y, colZ);
    st.exitWorldPoint.set(colX, y - 0.02, colZ - 0.125);
    st.internalWaypoints = [
      new THREE.Vector3(0.0, 2.22, -0.285),
      new THREE.Vector3(colX, 2.20, colZ - 0.045),
      new THREE.Vector3(colX, y + 0.02, colZ - 0.105),
    ];
  }

  // ============================================================================
  // 7. Cable Handle Attachments (Tricep Rope, Dual-D Row, Stirrup D-Handle, V-Bar, Lat Bar)
  // ============================================================================
  createHandleAttachment(type, stationId) {
    const { chrome, blackRubber, braidedRope } = this.materials;
    const group = new THREE.Group();
    group.name = `Attachment_${stationId}_${type}`;

    // Universal rubber ball cable stop + chrome swivel + carabiner snap hook
    const ballStop = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 16, 16),
      blackRubber
    );
    ballStop.position.set(0, 0, 0);
    group.add(ballStop);

    const carabiner = new THREE.Mesh(
      new THREE.TorusGeometry(0.018, 0.004, 10, 20),
      chrome
    );
    carabiner.scale.set(0.75, 1.35, 1.0);
    carabiner.position.set(0, -0.042, 0);
    group.add(carabiner);

    const attachRoot = new THREE.Group();
    attachRoot.position.set(0, -0.068, 0);
    group.add(attachRoot);

    if (type === 'tricepRope') {
      // Iconic Black & Red Braided Tricep Rope with flared black rubber ends (IMG_2249, IMG_2251)
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.022, 0.032, 14),
        blackRubber
      );
      attachRoot.add(cap);

      for (const side of [-1, 1]) {
        const ropeCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.008, -0.01, 0),
          new THREE.Vector3(side * 0.034, -0.14, 0.005 * side),
          new THREE.Vector3(side * 0.044, -0.29, 0),
        ]);
        const ropeGeo = new THREE.TubeGeometry(ropeCurve, 18, 0.013, 12, false);
        attachRoot.add(new THREE.Mesh(ropeGeo, braidedRope));

        const endStop = new THREE.Mesh(
          new THREE.CylinderGeometry(0.024, 0.034, 0.048, 18),
          blackRubber
        );
        endStop.position.set(side * 0.046, -0.31, 0);
        endStop.rotation.z = side * 0.14;
        attachRoot.add(endStop);
      }
    } else if (type === 'rowHandle') {
      // Close-Grip Dual-D Seated Row V-Handle (clearly visible in IMG_2256, IMG_2257, IMG_2262)
      for (const side of [-1, 1]) {
        const framePlate = new THREE.Mesh(
          new THREE.BoxGeometry(0.012, 0.14, 0.14),
          blackRubber
        );
        framePlate.position.set(side * 0.068, -0.075, 0);
        framePlate.rotation.z = side * 0.22;
        attachRoot.add(framePlate);

        const gripCyl = new THREE.Mesh(
          new THREE.CylinderGeometry(0.014, 0.014, 0.13, 14),
          blackRubber
        );
        gripCyl.position.set(side * 0.082, -0.11, 0.04);
        gripCyl.rotation.x = Math.PI / 2;
        attachRoot.add(gripCyl);
      }
      const bridge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.13, 12),
        chrome
      );
      bridge.rotation.z = Math.PI / 2;
      bridge.position.set(0, -0.02, 0);
      attachRoot.add(bridge);
    } else if (type === 'dHandle') {
      // Single D-Stirrup Handle (visible on East boom in IMG_2246 top-right)
      const strapCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-0.065, -0.11, 0),
        new THREE.Vector3(-0.065, -0.15, 0),
        new THREE.Vector3(0.065, -0.15, 0),
        new THREE.Vector3(0.065, -0.11, 0),
        new THREE.Vector3(0, 0, 0),
      ]);
      attachRoot.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(strapCurve, 24, 0.0055, 10, false),
          chrome
        )
      );
      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.13, 16),
        blackRubber
      );
      grip.rotation.z = Math.PI / 2;
      grip.position.set(0, -0.15, 0);
      attachRoot.add(grip);
    } else if (type === 'latBar') {
      // Wide Revolving Chrome Lat Pulldown Bar with angled ends (IMG_2246 & IMG_2253 floor)
      const barCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.54, -0.08, 0),
        new THREE.Vector3(-0.36, -0.02, 0),
        new THREE.Vector3(0.0, -0.02, 0),
        new THREE.Vector3(0.36, -0.02, 0),
        new THREE.Vector3(0.54, -0.08, 0),
      ]);
      attachRoot.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(barCurve, 28, 0.013, 14, false),
          chrome
        )
      );
      for (const sx of [-0.46, 0.46]) {
        const rubberGrip = new THREE.Mesh(
          new THREE.CylinderGeometry(0.016, 0.016, 0.19, 14),
          blackRubber
        );
        rubberGrip.rotation.z = Math.PI / 2 + Math.sign(sx) * 0.32;
        rubberGrip.position.set(sx, -0.052, 0);
        attachRoot.add(rubberGrip);
      }
    } else {
      // Default Chrome V-Bar / Tricep Pressdown Bar
      const vCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.16, -0.12, 0),
        new THREE.Vector3(-0.08, -0.04, 0),
        new THREE.Vector3(0.0, -0.01, 0),
        new THREE.Vector3(0.08, -0.04, 0),
        new THREE.Vector3(0.16, -0.12, 0),
      ]);
      attachRoot.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(vCurve, 20, 0.012, 12, false),
          chrome
        )
      );
      for (const sx of [-0.16, 0.16]) {
        const knob = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.022, 0.018, 16),
          blackRubber
        );
        knob.rotation.z = Math.PI / 2 - Math.sign(sx) * 0.65;
        knob.position.set(sx, -0.12, 0);
        attachRoot.add(knob);
      }
    }

    // Fit the collider to the visible attachment, before adding its deliberately
    // oversized pointer hit target. Bounds remain in attachment-local space.
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    group.traverse(child => {
      if (!child.isMesh) return;
      child.geometry.computeBoundingBox();
      bounds.union(child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld));
    });
    group.userData.collisionBounds = {
      min: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
      max: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z },
    };

    // Invisible larger hit-sphere around the handle so dragging in 3D is effortless
    const hitSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitSphere.position.set(0, -0.14, 0);
    hitSphere.userData = {
      interactiveType: 'cableHandle',
      stationId,
    };
    group.add(hitSphere);
    this.interactiveObjects.push(hitSphere);

    group.traverse((child) => {
      if (child.isMesh && child !== hitSphere) {
        child.userData = {
          interactiveType: 'cableHandle',
          stationId,
        };
        this.interactiveObjects.push(child);
      }
    });

    return group;
  }

  // ============================================================================
  // 8. Floor & Column Accessories (matching IMG_2246, IMG_2251, IMG_2255)
  // ============================================================================
  buildFloorAccessories() {
    const { blackRubber, chrome, weightPlateIron } = this.materials;
    const accGroup = new THREE.Group();
    accGroup.name = 'FloorAndColumnAccessories';
    this.root.add(accGroup);

    // 1. 5 lb Rubber Add-On Donut on SE Column Horn (visible in IMG_2251 at y=0.92m)
    this.columnDonutMesh = new THREE.Group();
    this.columnDonutMesh.position.set(0.36, 0.92, 0.48);
    this.columnDonutMesh.rotation.x = Math.PI / 2;
    const donutOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.088, 0.032, 24),
      blackRubber
    );
    const donutInner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.034, 0.034, 0.034, 16),
      weightPlateIron
    );
    this.columnDonutMesh.add(donutOuter, donutInner);
    this.columnDonutMesh.traverse((c) => {
      if (c.isMesh) {
        c.userData = { interactiveType: 'toggleAddonWeight' };
        this.interactiveObjects.push(c);
      }
    });
    accGroup.add(this.columnDonutMesh);

    // 2. Revolving Chrome Lat Bar resting on the floor in front of South face (IMG_2246, IMG_2253)
    const floorBarCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.22, 0.018, 0.88),
      new THREE.Vector3(0.08, 0.018, 0.94),
      new THREE.Vector3(0.38, 0.018, 0.98),
      new THREE.Vector3(0.55, 0.018, 1.06),
    ]);
    const floorBar = new THREE.Mesh(
      new THREE.TubeGeometry(floorBarCurve, 20, 0.013, 12, false),
      chrome
    );
    accGroup.add(floorBar);

    // 3. Second 5 lb Rubber Increment Donut & D-Handle on Floor (IMG_2255 bottom)
    const floorDonut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.088, 0.030, 24),
      blackRubber
    );
    floorDonut.position.set(0.14, 0.015, 0.64);
    floorDonut.userData = { interactiveType: 'toggleAddonWeight' };
    this.interactiveObjects.push(floorDonut);
    accGroup.add(floorDonut);
  }

  // ============================================================================
  // 9. Physics Simulation & Constraint Solver (per-frame update)
  // ============================================================================
  getSelectedWeightLbs(stationId) {
    const st = this.stations[stationId];
    if (!st) return 0;
    const baseLbs =
      st.pinIndex >= 0 && st.pinIndex < st.plates.length
        ? st.plates[st.pinIndex].lbs
        : st.plates[0].lbs;
    const addonLbs = st.addonWeightActive ? 5.0 * st.config.ratio : 0;
    return baseLbs + addonLbs;
  }

  getPhysicalStackMassKg(stationId) {
    const st = this.stations[stationId];
    if (!st) return 5;
    // Note: For a 2:1 station (ratio = 0.5), the printed plate label is the EFFECTIVE resistance
    // at the handle, so the actual physical mass of the plates lifted is (labelLbs / ratio) * LBS_TO_KG!
    const effectiveLbs = this.getSelectedWeightLbs(stationId);
    const physicalLbs = effectiveLbs / st.config.ratio;
    return physicalLbs * LBS_TO_KG;
  }

  setPinIndex(stationId, newPinIndex) {
    const st = this.stations[stationId];
    if (!st || !Number.isFinite(newPinIndex)) return { ok: false, reason: 'Invalid station or plate' };

    // Physical constraint: cannot change selector pin while the weight stack is lifted under tension!
    if (this.isStationLoaded(stationId)) {
      return {
        ok: false,
        reason: 'Pin locked under load — lower the weight stack first!',
      };
    }

    const clamped = Math.max(0, Math.min(st.plates.length - 1, Math.round(newPinIndex)));
    st.pinIndex = clamped;
    this.updateStationVisuals(stationId, 0);
    this.onStateChange?.(stationId);
    return { ok: true, pinIndex: clamped, lbs: this.getSelectedWeightLbs(stationId) };
  }

  setAddonWeight(stationId, active) {
    const st = this.stations[stationId];
    if (!st) return { ok: false };
    if (this.isStationLoaded(stationId)) {
      return {
        ok: false,
        reason: 'Cannot place/remove increment weight while stack is in motion!',
      };
    }
    st.addonWeightActive = Boolean(active);
    st.addonGroup.visible = st.addonWeightActive;
    this.updateStationVisuals(stationId, 0);
    this.onStateChange?.(stationId);
    return { ok: true, active: st.addonWeightActive };
  }

  setAttachment(stationId, attachmentType) {
    const st = this.stations[stationId];
    if (!st || !ATTACHMENT_PHYSICS[attachmentType]) return { ok: false, reason: 'Invalid attachment' };
    if (this.isStationLoaded(stationId)) return { ok: false, reason: 'Lower the stack and release the handle before changing attachments.' };
    if (st.handleGroup) {
      const oldMeshes = new Set();
      st.handleGroup.traverse(child => {
        oldMeshes.add(child);
        if (child.isMesh) {
          child.geometry.dispose();
          if (child.material.visible === false) child.material.dispose();
        }
      });
      this.interactiveObjects = this.interactiveObjects.filter(object => !oldMeshes.has(object));
      this.root.remove(st.handleGroup);
    }
    st.attachmentType = attachmentType;
    st.handleGroup = this.createHandleAttachment(attachmentType, stationId);
    this.root.add(st.handleGroup);
    st.physics.attachment = { ...ATTACHMENT_PHYSICS[attachmentType] };
    st.physics.collisionBounds = st.handleGroup.userData.collisionBounds;
    this.updateStationVisuals(stationId, 0);
    this.onStateChange?.(stationId);
    return { ok: true };
  }

  setCarriageHoleIndex(holeIndex) {
    if (!Number.isFinite(holeIndex)) return { ok: false, reason: 'Invalid carriage hole' };
    const st = this.stations.northAdjustableColumn;
    if (this.isStationLoaded('northAdjustableColumn')) {
      return {
        ok: false,
        reason: 'Cannot move pulley carriage while cable is under load!',
      };
    }
    this.carriageHoleIndex = Math.max(
      0,
      Math.min(this.carriageHoleCount - 1, Math.round(holeIndex))
    );
    const oldExit = st.exitWorldPoint.clone();
    this.updateCarriagePosition();
    for (const axis of ['x', 'y', 'z']) {
      st.physics.p[axis] += st.exitWorldPoint[axis] - oldExit[axis];
      st.physics.exit[axis] = st.exitWorldPoint[axis];
      st.physics.velocity[axis] = 0;
    }
    st.physics.resolveContacts();
    st.physics.advance(0.1);
    st.cablePull = st.physics.extension;
    st.stackLift = st.physics.lift;
    st.stackVelocity = st.physics.stackVelocity;
    this.updateStationVisuals('northAdjustableColumn', 0);
    this.onStateChange?.('northAdjustableColumn');
    return { ok: true, holeIndex: this.carriageHoleIndex };
  }

  setThighPadHoleIndex(holeIndex) {
    if (!Number.isFinite(holeIndex)) return { ok: false, reason: 'Invalid thigh pad hole' };
    this.thighPadHoleIndex = Math.max(
      0,
      Math.min(this.thighPadHoleCount - 1, Math.round(holeIndex))
    );
    this.updateThighPadPosition();
    this.refreshHandleColliders();
    this.onStateChange?.('eastLatPulldown');
    return { ok: true, holeIndex: this.thighPadHoleIndex };
  }

  setHandlePull(stationId, pullDistanceMeters, pullDir = null) {
    const st = this.stations[stationId];
    if (!st || !Number.isFinite(pullDistanceMeters)) return;
    const maxCablePull = st.config.maxStackTravel / st.config.ratio;
    st.targetPullDistance = Math.max(0, Math.min(maxCablePull, pullDistanceMeters));
    st.isDraggingHandle = true;
    st.autoRepActive = false;
    if (!pullDir) st.pullDirection.copy(st.config.pullAxisDefault);
    if (pullDir && Number.isFinite(pullDir.x + pullDir.y + pullDir.z) && Math.hypot(pullDir.x, pullDir.y, pullDir.z) > 1e-6) {
      st.pullDirection.copy(pullDir).normalize();
    }
  }

  releaseHandle(stationId) {
    const st = this.stations[stationId];
    if (!st) return;
    st.isDraggingHandle = false;
    st.autoRepActive = false;
    st.physics.target = null;
    st.targetPullDistance = 0.0;
  }

  refreshHandleColliders() {
    this.root.updateWorldMatrix(true, true);
    const rootInverse = this.root.matrixWorld.clone().invert();
    const obstacles = [];
    const addBox = (bounds, matrix, name) => {
      const center = bounds.getCenter(new THREE.Vector3()).applyMatrix4(matrix);
      const size = bounds.getSize(new THREE.Vector3()).multiplyScalar(0.5);
      const basis = [0, 1, 2].map(i => new THREE.Vector3().setFromMatrixColumn(matrix, i));
      obstacles.push({
        name, center: { x: center.x, y: center.y, z: center.z },
        halfSize: [size.x, size.y, size.z].map((half, i) => half * basis[i].length()),
        axes: basis.map(axis => { axis.normalize(); return { x: axis.x, y: axis.y, z: axis.z }; }),
      });
    };
    for (const mesh of this.handleCollisionMeshes) {
      const matrix = rootInverse.clone().multiply(mesh.matrixWorld);
      const parameters = mesh.geometry.parameters;
      if (mesh.geometry.type === 'TubeGeometry') {
        const points = parameters.path.getPoints(parameters.tubularSegments);
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1], b = points[i];
          const halfLength = a.distanceTo(b) * 0.5 + parameters.radius * 0.25;
          const local = new THREE.Matrix4().compose(
            a.clone().lerp(b, 0.5),
            new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()),
            new THREE.Vector3(1, 1, 1)
          );
          addBox(new THREE.Box3(
            new THREE.Vector3(-parameters.radius, -halfLength, -parameters.radius),
            new THREE.Vector3(parameters.radius, halfLength, parameters.radius)
          ), matrix.clone().multiply(local), 'Row support tube');
        }
      } else {
        mesh.geometry.computeBoundingBox();
        addBox(mesh.geometry.boundingBox, matrix, mesh.name || mesh.parent.name);
      }
    }
    this.handleObstacles = obstacles;
    for (const st of Object.values(this.stations)) if (st.physics) st.physics.obstacles = obstacles;
  }

  /** Configure the reduced-coordinate physics for each cable path. */
  initStationPhysics(stationId) {
    const st = this.stations[stationId];
    const barriers = {
      southHighPulley: [{ axis: 'z', min: 0.52 }],
      eastLatPulldown: [{ axis: 'x', min: 0.55 }],
      westSeatedRow: [{ axis: 'x', max: -0.88 }],
      northAdjustableColumn: [{ axis: 'z', max: -0.70 }],
    };
    st.physics = new CablePhysics({
      ratio: st.config.ratio, mass: this.getPhysicalStackMassKg(stationId),
      maxLift: st.config.maxStackTravel,
      lead: stationId === 'westSeatedRow' ? 0.14 : stationId === 'eastLatPulldown' ? 0.22 : 0.18,
      exit: st.exitWorldPoint, direction: st.config.restHandleDir,
      attachment: st.attachmentType, barriers: barriers[stationId],
      collisionBounds: st.handleGroup.userData.collisionBounds, obstacles: this.handleObstacles,
    });
    st.previousHandlePosition = new THREE.Vector3().copy(st.physics.p);
    st.repArmed = false;
  }

  isStationLoaded(stationId) {
    const st = this.stations[stationId];
    return st && (st.stackLift > 0.001 || Math.abs(st.stackVelocity) > 0.015 || st.isDraggingHandle || st.autoRepActive);
  }

  /** Advance each fixed-step solver; update geometry once per rendered frame. */
  update(dt) {
    let moved = false;
    for (const [stationId, st] of Object.entries(this.stations)) {
      const physics = st.physics;
      const previousLift = st.stackLift;
      physics.mass = this.getPhysicalStackMassKg(stationId);
      physics.advance(dt, (h) => {
        if (st.autoRepActive && !st.isDraggingHandle) {
          st.autoRepPhase += h * st.autoRepSpeed;
          const wave = 0.5 - 0.5 * Math.cos(st.autoRepPhase);
          const profile = st.autoRepProfile?.(st.autoRepPhase);
          st.targetPullDistance = Math.max(0, Math.min(st.config.maxStackTravel / st.config.ratio, profile?.distance ?? st.autoRepTargetPull * wave));
          st.pullDirection.copy(profile?.direction ?? st.config.pullAxisDefault);
        }
        if (st.autoRepActive || st.isDraggingHandle) {
          physics.target = st.exitWorldPoint.clone().addScaledVector(st.pullDirection, physics.lead + st.targetPullDistance);
          physics.target.y = Math.max(physics.floorHeight(st.pullDirection), physics.target.y);
        } else physics.target = null;
      });
      st.stackLift = physics.lift;
      st.stackVelocity = physics.stackVelocity;
      st.cablePull = physics.extension;
      st.cableTensionN = physics.tension;
      st.appliedForceN = physics.appliedForce;
      st.cableSlack = physics.slack;
      // Count completed physical excursions, including manual reps.
      if (st.stackLift > Math.min(0.25, st.autoRepTargetPull * st.config.ratio * 0.65)) st.repArmed = true;
      if (st.repArmed && st.stackLift < 0.035) { st.repCount++; st.repArmed = false; }
      if (Math.abs(st.stackLift - previousLift) > 1e-6 || st.previousHandlePosition.distanceToSquared(physics.p) > 1e-10 || st.isDraggingHandle || st.autoRepActive) {
        this.updateStationVisuals(stationId, (st.stackLift - previousLift) / st.config.ratio);
        st.previousHandlePosition.copy(physics.p);
        moved = true;
      }
    }
    return moved;
  }

  /**
   * Synchronizes all 3D transforms for a station:
   *  - Lifts plates 0..pinIndex by stackLift while keeping plates (pinIndex+1)..N-1 on the bumpers
   *  - Moves selector pin and optional +5 lb add-on donut with the lifted stack
   *  - Rotates every pulley sheave by Δθ = Δs_local / R_sheave
   *  - Orients swiveling pulley brackets toward the 3D pull vector
   *  - Rebuilds the continuous 3D steel cable tube from the top of the weight stack stem
   *    through all sheaves out to the handle attachment
   */
  updateStationVisuals(stationId, deltaCable = 0) {
    const st = this.stations[stationId];
    if (!st) return;

    const lift = st.stackLift;

    // 1. Update every weight plate's vertical position along the guide rods
    for (let i = 0; i < st.plates.length; i++) {
      const p = st.plates[i];
      const isCoupledToStem = i <= st.pinIndex;
      p.group.position.y = p.restCenterY + (isCoupledToStem ? lift : 0.0);
    }

    // 2. Position the selector pin inside the selected plate's center hole
    const activePlate = st.plates[st.pinIndex] || st.plates[0];
    st.pinGroup.position.set(0, activePlate.group.position.y, 0);

    // 3. Position the +5 lb add-on rubber donut on top of Plate 0
    const topPlateY = st.plates[0].group.position.y;
    st.addonGroup.position.set(
      0,
      topPlateY + st.plates[0].thickness * 0.5 + 0.018,
      0
    );

    // 4. Rotate all pulley sheaves along the active cable path (no-slip rolling constraint)
    if (Math.abs(deltaCable) > 1e-6) {
      for (const item of st.sheaves) {
        const wheel = item.sheave.userData.wheelMesh;
        const r = item.sheave.userData.radius || 0.05;
        const dTheta = (deltaCable * item.ratio) / r;
        wheel.rotation.y += dTheta;
      }
    }

    // 5. Swivel pulley housings toward off-axis pull direction
    if (st.swivelGroup) {
      const dir = st.physics.direction;
      if (stationId === 'southHighPulley') {
        const yaw = Math.atan2(dir.x, Math.max(0.15, dir.z));
        st.swivelGroup.rotation.y = THREE.MathUtils.clamp(yaw, -0.85, 0.85);
      } else if (stationId === 'northAdjustableColumn') {
        const yaw = Math.atan2(dir.x, Math.max(0.15, -dir.z));
        st.swivelGroup.rotation.y = THREE.MathUtils.clamp(-yaw, -0.95, 0.95);
      }
    }

    // 6. Compute world-space handle position & rebuild the 3D steel cable geometry
    const stemLocalY = topPlateY + st.stemTopOffset;
    const stemWorld = new THREE.Vector3(
      st.config.stackCenter.x,
      stemLocalY,
      st.config.stackCenter.z
    );

    const handlePos = new THREE.Vector3().copy(st.physics.p);
    const pullDir = new THREE.Vector3().copy(st.physics.direction);

    // Position and orient the 3D handle attachment along the cable pull vector
    if (st.handleGroup) {
      st.handleGroup.position.copy(handlePos);
      const targetQuat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, -1, 0),
        pullDir.clone().normalize()
      );
      st.handleGroup.quaternion.copy(targetQuat);
    }

    // Build smooth multi-segment cable path from stack stem -> internal sheaves -> exit sheave -> handle
    let cablePts;
    if (stationId === 'northAdjustableColumn') {
      // 2:1 compound pulley double-strand routing around floating stack pulley (IMG_2249 & IMG_2251)
      cablePts = [
        new THREE.Vector3(0.0, 2.22, -0.315),
        new THREE.Vector3(0.0, stemLocalY + 0.01, -0.31),
        new THREE.Vector3(0.0, stemLocalY - 0.025, -0.285),
        new THREE.Vector3(0.0, stemLocalY + 0.01, -0.26),
        ...st.internalWaypoints,
        st.exitWorldPoint.clone(),
        handlePos,
      ];
    } else {
      cablePts = [
        stemWorld,
        ...st.internalWaypoints,
        st.exitWorldPoint.clone(),
        handlePos,
      ];
    }

    // Last two points are the exit and handle; keep the internal runs straight.
    st.cableMesh.geometry.update(cablePts.slice(0, -2), st.exitWorldPoint, handlePos, st.physics.slack);
  }
}
