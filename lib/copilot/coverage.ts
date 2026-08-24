import { area as turfArea } from '@turf/area'
import { bbox } from '@turf/bbox'
import buffer from '@turf/buffer'
import { convex } from '@turf/convex'
import { featureCollection, lineString, point } from '@turf/helpers'
import union from '@turf/union'
import type { Feature, MultiPolygon, Polygon } from 'geojson'
import type { CoverageResult, FilteredSample, GeoJsonPolygon } from './types'
import { EMPTY_COVERAGE } from './types'

type PolyFeat = Feature<Polygon | MultiPolygon>

function asPoly(feat: Feature | null | undefined): PolyFeat | null {
  if (!feat || (feat.geometry.type !== 'Polygon' && feat.geometry.type !== 'MultiPolygon')) return null
  return feat as PolyFeat
}

function mergeUnion(features: PolyFeat[]): PolyFeat | null {
  if (features.length === 0) return null
  let acc: PolyFeat | null = features[0]
  for (let i = 1; i < features.length; i += 1) {
    if (!acc) {
      acc = features[i]
      continue
    }
    try {
      const merged = union(featureCollection([acc, features[i]]))
      const poly = asPoly(merged)
      if (poly) acc = poly
    } catch {
      // keep accumulator if a strip fails to union
    }
  }
  return acc
}

export function buildCoverage(harvestSamples: FilteredSample[], widthM: number): CoverageResult {
  if (harvestSamples.length < 2) return EMPTY_COVERAGE
  const strips: PolyFeat[] = []
  const step = Math.max(1, Math.floor(harvestSamples.length / 80))
  for (let i = 0; i < harvestSamples.length - 1; i += step) {
    const a = harvestSamples[i]
    const b = harvestSamples[Math.min(i + step, harvestSamples.length - 1)]
    if (a.latitude === b.latitude && a.longitude === b.longitude) continue
    const line = lineString([
      [a.longitude, a.latitude],
      [b.longitude, b.latitude],
    ])
    const strip = buffer(line, Math.max(widthM, 0.5) / 2, { units: 'meters' })
    const poly = asPoly(strip)
    if (poly) strips.push(poly)
  }
  const merged = mergeUnion(strips)
  if (!merged) return EMPTY_COVERAGE
  const areaSqm = turfArea(merged)
  let remainingSqm = 0
  try {
    const hull = convex(
      featureCollection(harvestSamples.map((s) => point([s.longitude, s.latitude]))),
    )
    if (hull) {
      remainingSqm = Math.max(0, turfArea(hull) - areaSqm)
    } else {
      const box = bbox(merged)
      const spanLat = Math.abs(box[3] - box[1]) * 111_320
      const spanLng = Math.abs(box[2] - box[0]) * 111_320 * Math.cos(((box[1] + box[3]) / 2) * (Math.PI / 180))
      remainingSqm = Math.max(0, spanLat * spanLng * 0.15)
    }
  } catch {
    remainingSqm = 0
  }
  return {
    geoJson: merged.geometry as GeoJsonPolygon,
    areaSqm,
    remainingSqm,
  }
}
