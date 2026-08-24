export type CopilotStateName =
  | 'IDLE'
  | 'TRAVELLING'
  | 'POSSIBLE_FIELD'
  | 'HARVESTING'
  | 'POSSIBLE_EXIT'
  | 'HARVEST_COMPLETED'

export type CopilotSettings = {
  machineName: string
  cutterWidthM: number
  effectiveWidthM: number
  minHarvestKmh: number
  maxHarvestKmh: number
  travelSpeedKmh: number
  minGpsAccuracyM: number
  minMoveM: number
  maxJumpM: number
  maxSpeedMps: number
  parallelPassToleranceM: number
  headingTurnMinDeg: number
  headingTurnMaxDeg: number
  autoStopDelayMs: number
  travelConfidenceThreshold: number
  harvestConfidenceThreshold: number
  possibleFieldHoldMs: number
}

export const DEFAULT_COPILOT_SETTINGS: CopilotSettings = {
  machineName: 'Panesar G60',
  cutterWidthM: 2.6,
  effectiveWidthM: 2.4,
  minHarvestKmh: 2,
  maxHarvestKmh: 7,
  travelSpeedKmh: 10,
  minGpsAccuracyM: 25,
  minMoveM: 0.8,
  maxJumpM: 40,
  maxSpeedMps: 22,
  parallelPassToleranceM: 0.8,
  headingTurnMinDeg: 150,
  headingTurnMaxDeg: 210,
  autoStopDelayMs: 90_000,
  travelConfidenceThreshold: 0.62,
  harvestConfidenceThreshold: 0.68,
  possibleFieldHoldMs: 12_000,
}

export type RawGpsFix = {
  latitude: number
  longitude: number
  accuracy: number
  speedMps: number | null
  headingDeg: number | null
  timestamp: number
}

export type FilteredSample = {
  latitude: number
  longitude: number
  accuracy: number
  speedKmh: number
  headingDeg: number
  timestamp: number
}

export type CoverageResult = {
  geoJson: GeoJsonPolygon | null
  areaSqm: number
  remainingSqm: number
}

export type GeoJsonPolygon = {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][] | number[][][][]
}

export type CopilotSnapshot = {
  state: CopilotStateName
  travelConfidence: number
  harvestConfidence: number
  speedKmh: number
  accuracyM: number
  samples: FilteredSample[]
  harvestSamples: FilteredSample[]
  coverage: CoverageResult
  sessionActive: boolean
  lastAcceptAt: number
  possibleFieldAt: number
  exitWatchAt: number
  lastHarvestLikeAt: number
}

export const EMPTY_COVERAGE: CoverageResult = {
  geoJson: null,
  areaSqm: 0,
  remainingSqm: 0,
}

export function emptySnapshot(): CopilotSnapshot {
  return {
    state: 'IDLE',
    travelConfidence: 0,
    harvestConfidence: 0,
    speedKmh: 0,
    accuracyM: 0,
    samples: [],
    harvestSamples: [],
    coverage: EMPTY_COVERAGE,
    sessionActive: false,
    lastAcceptAt: 0,
    possibleFieldAt: 0,
    exitWatchAt: 0,
    lastHarvestLikeAt: 0,
  }
}
