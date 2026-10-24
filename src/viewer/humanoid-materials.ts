import { Mesh, MeshStandardMaterial, type Object3D } from 'three'

/** Cool graphite anatomy on a muted silver base, matching the gym's steel and upholstery. */
export function styleHumanoid(root: Object3D) {
  root.traverse(object => {
    if (!(object instanceof Mesh)) return
    const muscle = Boolean(object.userData.muscle)
    const source = object.material as MeshStandardMaterial
    const material = source.clone()
    material.color.set(muscle ? '#657b83' : '#a1aaac')
    material.map = null
    material.vertexColors = false
    material.metalness = muscle ? .14 : .08
    material.roughness = muscle ? .57 : .68
    material.emissive.set(0)
    object.material = material
  })
}
