import { area } from '@turf/area'
import { lineString, polygon } from '@turf/helpers'
import { length } from '@turf/length'
import { GUNTHA_PER_ACRE, SQM_PER_ACRE, SQM_PER_HECTARE } from './constants'
import type { GpsSample } from './geo'

export type AreaBreakdown = {
  squareMeters: number
  acres: number
  guntha: number
  hectares: number
  pathMeters: number
}

export function emptyArea(): AreaBreakdown {
  return { squareMeters: 0, acres: 0, guntha: 0, hectares: 0, pathMeters: 0 }
}

function ringFromPoints(points: GpsSample[]): number[][] {
  const coords = points.map((p) => [p.longitude, p.latitude])
  const first = coords[0]
  const last = coords[coords.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push([first[0], first[1]])
  }
  return coords
}

export function computeMeasurementGeometry(points: GpsSample[]): AreaBreakdown {
  if (points.length < 2) return emptyArea()

  const line = lineString(points.map((p) => [p.longitude, p.latitude]))
  const pathMeters = length(line, { units: 'kilometers' }) * 1000

  if (points.length < 3) {
    return { ...emptyArea(), pathMeters }
  }

  const sqm = area(polygon([ringFromPoints(points)]))
  const acres = sqm / SQM_PER_ACRE
  return {
    squareMeters: sqm,
    acres,
    guntha: acres * GUNTHA_PER_ACRE,
    hectares: sqm / SQM_PER_HECTARE,
    pathMeters,
  }
}
