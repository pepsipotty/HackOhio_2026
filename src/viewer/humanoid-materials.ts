import { Mesh, MeshStandardMaterial, type Object3D } from 'three'

/** Cool graphite anatomy on a muted silver base, matching the gym's steel and upholstery. */
export function styleHumanoid(root: Object3D) {
  root.traverse(object => {
    if (!(object instanceof Mesh)) return
    // Skinned bounds are computed once, in whatever pose the first frame had. Once the figure sits down the
    // stale spheres no longer cover the posed patches, and close-up views culled whole muscle groups.
    object.frustumCulled = false
    const muscle = Boolean(object.userData.muscle)
    const source = object.material as MeshStandardMaterial
    const material = source.clone()
    material.color.set(muscle ? '#657b83' : '#a1aaac')
    material.map = null
    material.vertexColors = false
    material.metalness = muscle ? .14 : .08
    material.roughness = muscle ? .57 : .68
    material.emissive.set(0)
    if (muscle) {
      // Patches sit 1–3 mm above the skin but a few edge vertices sit flush. A constant (not slope-scaled)
      // depth bias wins those ties against the skin while keeping the order between overlapping muscles.
      material.polygonOffset = true
      material.polygonOffsetFactor = 0
      material.polygonOffsetUnits = -8
    }
    object.material = material
  })
}
