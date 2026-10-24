import { Group, Vector3 } from 'three'
export class CableStackApparatus {
  root: Group
  stations: Record<string, any>
  update(dt: number): boolean
  updateStationVisuals(id: string, deltaCable?: number): void
  setHandlePull(id: string, distance: number, direction?: Vector3): void
  releaseHandle(id: string): void
}
