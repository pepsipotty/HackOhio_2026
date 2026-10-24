import { Euler, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import { loadRig, JOINT_NAMES } from './rig'
import { createCableRowComposite } from './cable-row-composite'
import { createMuscleInteraction } from './muscle-interaction'
import motion from '../data/poses/seated-cable-row'
import { ROW_REFERENCE, referenceRowAmount } from '../data/row-reference'
import { samplePose } from '../lib/tween'
import { createRowGrip, orientRowHandle } from './row-grip'

/** Add the same assembly to the original GymRoomSimulator without replacing its controls. */
export async function mountGymHumanoid(sim: any, url: string) {
  const rig = await loadRig(url, new MeshStandardMaterial({ color: '#b4aa96' }))
  if (rig.placeholder) throw new Error('Muscle humanoid failed to load')
  const composite = createCableRowComposite(rig, sim.cableStack)
  sim.simulatorGroup.add(composite.root)
  const muscles = createMuscleInteraction(rig.root, sim.camera, sim.renderer.domElement, () => sim.invalidate())
  const euler = new Euler(), q = new Quaternion()
  const grip = createRowGrip(rig)
  const station = sim.cableStack.stations.westSeatedRow
  station.autoRepProfile = (phase: number) => {
    const distance = ROW_REFERENCE.minPull + (ROW_REFERENCE.maxPull - ROW_REFERENCE.minPull) * referenceRowAmount(phase / (2 * Math.PI))
    const lead = station.physics.lead + distance
    const height = .34
    return { distance, direction: new Vector3(-Math.sqrt(Math.max(.001, lead * lead - height * height)), height, 0).normalize() }
  }
  let smoothedPull: number | null = null
  const update = (dt = 1 / 60) => {
    grip.restore()
    const st = sim.cableStack.stations.westSeatedRow
    const u = Math.max(0, Math.min(1, (st.cablePull - ROW_REFERENCE.minPull) / (ROW_REFERENCE.maxPull - ROW_REFERENCE.minPull)))
    smoothedPull = smoothedPull === null ? u : smoothedPull + (u - smoothedPull) * (1 - Math.exp(-Math.min(dt, .1) / .14))
    const pose = samplePose(motion.rep!.keys, smoothedPull * ROW_REFERENCE.pullEnd, true)
    for (const name of JOINT_NAMES) {
      const angles = pose.joints[name] ?? [0, 0, 0]
      rig.joints[name].quaternion.copy(rig.rest[name]).multiply(q.setFromEuler(euler.set(...angles.map(v => v * Math.PI / 180) as [number, number, number])))
    }
    rig.joints.pelvis.position.set(...pose.root!.position)
    rig.update?.()
    orientRowHandle(st.handleGroup, new Vector3().copy(st.physics.direction))
    if (st.attachmentType === 'rowHandle') grip.solve(st.handleGroup)
    else grip.curl(0)
    return true
  }
  sim.cableStack.setHandlePull('westSeatedRow', .42)
  const unsubscribe = sim.onUpdate(update, { continuous: false })
  update()
  sim.invalidateShadows()
  return { rig, composite, muscles, dispose() { unsubscribe(); muscles.dispose(); composite.root.remove(rig.root) } }
}
