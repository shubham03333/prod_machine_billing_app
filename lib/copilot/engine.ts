import { haversineMeters } from '@/lib/gps/geo'
import { buildCoverage } from './coverage'
import { filterGpsFix } from './gps-filter'
import { computeMotionSignals, harvestConfidence, travelConfidence } from './signals'
import {
  EMPTY_COVERAGE,
  emptySnapshot,
  type CopilotSettings,
  type CopilotSnapshot,
  type CopilotStateName,
  type FilteredSample,
  type RawGpsFix,
} from './types'

const MAX_SAMPLES = 400
const MAX_HARVEST = 1200

function meanCoord(samples: FilteredSample[], key: 'latitude' | 'longitude'): number {
  return samples.reduce((sum, p) => sum + p[key], 0) / samples.length
}

function leftHarvestRegion(
  harvestSamples: FilteredSample[],
  current: FilteredSample,
  travel: number,
  settings: CopilotSettings,
): boolean {
  if (harvestSamples.length < 10) return false
  if (travel < settings.travelConfidenceThreshold) return false
  const lat = meanCoord(harvestSamples, 'latitude')
  const lng = meanCoord(harvestSamples, 'longitude')
  const dist = haversineMeters(
    { latitude: lat, longitude: lng, accuracy: 0, timestamp: 0 },
    { latitude: current.latitude, longitude: current.longitude, accuracy: 0, timestamp: 0 },
  )
  return dist > 80
}

function nextState(
  current: CopilotStateName,
  travel: number,
  harvest: number,
  settings: CopilotSettings,
  now: number,
  possibleFieldAt: number,
  exitWatchAt: number,
  lastHarvestLikeAt: number,
  leftRegion: boolean,
): CopilotStateName {
  const tTh = settings.travelConfidenceThreshold
  const hTh = settings.harvestConfidenceThreshold

  switch (current) {
    case 'IDLE':
      if (harvest >= hTh * 0.85) return 'POSSIBLE_FIELD'
      if (travel >= tTh) return 'TRAVELLING'
      return 'IDLE'
    case 'TRAVELLING':
      if (harvest >= hTh * 0.8) return 'POSSIBLE_FIELD'
      if (travel < tTh * 0.55 && harvest < 0.35) return 'IDLE'
      return 'TRAVELLING'
    case 'POSSIBLE_FIELD':
      if (harvest >= hTh) return 'HARVESTING'
      if (travel >= tTh && harvest < 0.4) return 'TRAVELLING'
      if (possibleFieldAt > 0 && now - possibleFieldAt > settings.possibleFieldHoldMs && harvest < hTh * 0.7) {
        return 'TRAVELLING'
      }
      return 'POSSIBLE_FIELD'
    case 'HARVESTING':
      if (leftRegion) return 'POSSIBLE_EXIT'
      if (lastHarvestLikeAt > 0 && now - lastHarvestLikeAt >= settings.autoStopDelayMs) return 'POSSIBLE_EXIT'
      if (travel >= tTh && harvest < hTh * 0.75) return 'POSSIBLE_EXIT'
      return 'HARVESTING'
    case 'POSSIBLE_EXIT':
      if (harvest >= hTh && !leftRegion) return 'HARVESTING'
      if (leftRegion && travel >= tTh) return 'HARVEST_COMPLETED'
      if (exitWatchAt > 0 && now - exitWatchAt >= settings.autoStopDelayMs) return 'HARVEST_COMPLETED'
      if (lastHarvestLikeAt > 0 && now - lastHarvestLikeAt >= settings.autoStopDelayMs) return 'HARVEST_COMPLETED'
      if (travel >= tTh + 0.12) return 'HARVEST_COMPLETED'
      return 'POSSIBLE_EXIT'
    case 'HARVEST_COMPLETED':
      if (travel >= tTh * 0.7) return 'TRAVELLING'
      if (harvest >= hTh) return 'POSSIBLE_FIELD'
      return 'HARVEST_COMPLETED'
    default:
      return current
  }
}

function nextHarvestSamples(
  snapshot: CopilotSnapshot,
  state: CopilotStateName,
  sample: FilteredSample,
): FilteredSample[] {
  if (state === 'HARVESTING' || state === 'POSSIBLE_EXIT') {
    return [...snapshot.harvestSamples, sample].slice(-MAX_HARVEST)
  }
  if (state === 'POSSIBLE_FIELD') {
    return [...snapshot.harvestSamples, sample].slice(-120)
  }
  if (state === 'HARVEST_COMPLETED') {
    return snapshot.harvestSamples
  }
  return []
}

function nextCoverage(
  snapshot: CopilotSnapshot,
  state: CopilotStateName,
  harvestSamples: FilteredSample[],
  widthM: number,
): CopilotSnapshot['coverage'] {
  if (state === 'HARVESTING' || state === 'POSSIBLE_EXIT' || state === 'HARVEST_COMPLETED') {
    if (harvestSamples.length < 2) return snapshot.coverage
    const rebuild = harvestSamples.length < 16 || harvestSamples.length % 3 === 0 || state === 'HARVEST_COMPLETED'
    if (!rebuild) return snapshot.coverage
    return buildCoverage(harvestSamples, widthM)
  }
  if (snapshot.coverage.areaSqm > 0 && (snapshot.state === 'HARVEST_COMPLETED' || state === 'TRAVELLING')) {
    return snapshot.coverage
  }
  return EMPTY_COVERAGE
}

export function applyGpsFix(
  snapshot: CopilotSnapshot,
  fix: RawGpsFix,
  settings: CopilotSettings,
): CopilotSnapshot {
  const last = snapshot.samples[snapshot.samples.length - 1] ?? null
  const sample = filterGpsFix(last, fix, settings)
  if (!sample) {
    return { ...snapshot, speedKmh: last?.speedKmh ?? snapshot.speedKmh, accuracyM: fix.accuracy }
  }

  const samples = [...snapshot.samples, sample].slice(-MAX_SAMPLES)
  const sig = computeMotionSignals(samples, settings)
  const travel = travelConfidence(sig, settings)
  const harvest = harvestConfidence(sig, settings)
  const now = sample.timestamp

  const lastHarvestLikeAt = harvest >= settings.harvestConfidenceThreshold * 0.75 ? now : snapshot.lastHarvestLikeAt
  const leftRegion = leftHarvestRegion(snapshot.harvestSamples, sample, travel, settings)

  const state = nextState(
    snapshot.state,
    travel,
    harvest,
    settings,
    now,
    snapshot.possibleFieldAt,
    snapshot.exitWatchAt,
    lastHarvestLikeAt,
    leftRegion,
  )

  const possibleFieldAt =
    state === 'POSSIBLE_FIELD' ? (snapshot.state === 'POSSIBLE_FIELD' ? snapshot.possibleFieldAt || now : now) : 0
  const exitWatchAt =
    state === 'POSSIBLE_EXIT' ? (snapshot.state === 'POSSIBLE_EXIT' ? snapshot.exitWatchAt || now : now) : 0

  const harvestSamples = nextHarvestSamples(snapshot, state, sample)
  const sessionActive = state === 'HARVESTING' || state === 'POSSIBLE_EXIT'
  const coverage = nextCoverage(snapshot, state, harvestSamples, settings.effectiveWidthM)

  return {
    state,
    travelConfidence: travel,
    harvestConfidence: harvest,
    speedKmh: sample.speedKmh,
    accuracyM: sample.accuracy,
    samples,
    harvestSamples,
    coverage,
    sessionActive,
    lastAcceptAt: now,
    possibleFieldAt,
    exitWatchAt,
    lastHarvestLikeAt,
  }
}

export { emptySnapshot }
