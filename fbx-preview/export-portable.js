// Export the complete model without a harness page, scene, or animation dependency.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildAnatomy, defaults } from './back-anatomy.js';
import { buildBodyMuscles, bodyRegions } from './body-muscles.js';
export async function exportPortableHumanoid() {
  const model = await new FBXLoader().loadAsync('/Defeated_NoAnimation.fbx');
  let body;
  model.traverse(o => { if (o.isSkinnedMesh) body = o; });
  body.material = new THREE.MeshStandardMaterial({ color: '#b4aa96', roughness: .9 });
  body.userData.role = 'body';
  const back = buildAnatomy(body);
  const muscles = buildBodyMuscles(body, back.fiberTexture);
  const config = { ...defaults(), ...Object.fromEntries(bodyRegions.map(r => [r.id, {volume: 1, width: 1, shift: 0, upper: 1, lower: 1}])) };
  back.update(config, 'anatomy', 'superficial', '');
  muscles.update(config, 'anatomy', '', true);
  for (const p of back.patches) {
    p.mesh.userData.anatomyLayer = p.region.layer;
    p.mesh.userData.defaultVisible = p.mesh.visible;
    p.mesh.visible = true; // Include the deep muscles for selection in the destination.
  }
  for (const p of muscles.patches) p.mesh.userData.anatomyLayer = 'body';
  const bounds = new THREE.Box3().setFromObject(model);
  model.scale.multiplyScalar(2 / (bounds.max.y - bounds.min.y));
  model.updateMatrixWorld(true);
  model.position.y -= new THREE.Box3().setFromObject(model).min.y;
  model.userData = {asset: 'Defeated muscle humanoid', restPose: 'T-pose', axes: 'Y-up, +Z-forward', animations: false};
  model.updateMatrixWorld(true);
  return new GLTFExporter().parseAsync(model, {binary: true, onlyVisible: true});
}
