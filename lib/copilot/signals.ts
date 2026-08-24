import { haversineMeters } from '@/lib/gps/geo'
import type { CopilotSettings, FilteredSample } from './types'

function headingDelta(a: number, b: number): number {
  let d = Math.abs(a - b) % 360
  if (d > 180) d = 360 - d
  return d
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  const v = values.reduce((s, x) => s + (x - m) * (x - m), 0) / (values.length - 1)
  return Math.sqrt(v)
}

function windowSamples(samples: FilteredSample[], max = 36): FilteredSample[] {
  return samples.length <= max ? samples : samples.slice(samples.length - max)
}

function countUTurns(samples: FilteredSample[], settings: CopilotSettings): number {
  let n = 0
  for (let i = 1; i < samples.length; i += 1) {
    const d = headingDelta(samples[i - 1].headingDeg, samples[i].headingDeg)
    if (d >= settings.headingTurnMinDeg && d <= settings.headingTurnMaxDeg) n += 1
  }
  return n
}

function parallelPassHits(samples: FilteredSample[], settings: CopilotSettings): number {
  if (samples.length < 8) return 0
  const passes: { heading: number; lat: number; lng: number }[] = []
  let runHeading = samples[0].headingDeg
  let runLat = samples[0].latitude
  let runLng = samples[0].longitude
  let runN = 1
  for (let i = 1; i < samples.length; i += 1) {
    const d = headingDelta(runHeading / runN, samples[i].headingDeg)
    if (d < 28) {
      runHeading += samples[i].headingDeg
      runLat += samples[i].latitude
      runLng += samples[i].longitude
      runN += 1
    } else {
      if (runN >= 3) {
        passes.push({ heading: runHeading / runN, lat: runLat / runN, lng: runLng / runN })
      }
      runHeading = samples[i].headingDeg
      runLat = samples[i].latitude
      runLng = samples[i].longitude
      runN = 1
    }
  }
  if (runN >= 3) passes.push({ heading: runHeading / runN, lat: runLat / runN, lng: runLng / runN })

  let hits = 0
  const target = settings.effectiveWidthM
  for (let i = 0; i < passes.length; i += 1) {
    for (let j = i + 1; j < passes.length; j += 1) {
      const hd = headingDelta(passes[i].heading, passes[j].heading)
      const parallel = hd < 18 || Math.abs(hd - 180) < 18
      if (!parallel) continue
      const dist = haversineMeters(
        { latitude: passes[i].lat, longitude: passes[i].lng, accuracy: 0, timestamp: 0 },
        { latitude: passes[j].lat, longitude: passes[j].lng, accuracy: 0, timestamp: 0 },
      )
      if (Math.abs(dist - target) <= settings.parallelPassToleranceM + 0.6) hits += 1
    }
  }
  return hits
}

export type MotionSignals = {
  avgSpeedKmh: number
  headingStd: number
  straightness: number
  displacementM: number
  uTurns: number
  parallelHits: number
  localized: boolean
}

export function computeMotionSignals(samples: FilteredSample[], settings: CopilotSettings): MotionSignals {
  const w = windowSamples(samples)
  if (w.length < 2) {
    return {
      avgSpeedKmh: w[0]?.speedKmh ?? 0,
      headingStd: 0,
      straightness: 0,
      displacementM: 0,
      uTurns: 0,
      parallelHits: 0,
      localized: false,
    }
  }
  const speeds = w.map((s) => s.speedKmh)
  const headings = w.map((s) => s.headingDeg)
  let path = 0
  for (let i = 1; i < w.length; i += 1) {
    path += haversineMeters(
      { latitude: w[i - 1].latitude, longitude: w[i - 1].longitude, accuracy: 0, timestamp: 0 },
      { latitude: w[i].latitude, longitude: w[i].longitude, accuracy: 0, timestamp: 0 },
    )
  }
  const first = w[0]
  const last = w[w.length - 1]
  const displacementM = haversineMeters(
    { latitude: first.latitude, longitude: first.longitude, accuracy: 0, timestamp: 0 },
    { latitude: last.latitude, longitude: last.longitude, accuracy: 0, timestamp: 0 },
  )
  const lats = w.map((s) => s.latitude)
  const lngs = w.map((s) => s.longitude)
  const spanM = haversineMeters(
    { latitude: Math.min(...lats), longitude: Math.min(...lngs), accuracy: 0, timestamp: 0 },
    { latitude: Math.max(...lats), longitude: Math.max(...lngs), accuracy: 0, timestamp: 0 },
  )
  return {
    avgSpeedKmh: mean(speeds),
    headingStd: stddev(headings),
    straightness: path > 1 ? Math.min(1, displacementM / path) : 0,
    displacementM,
    uTurns: countUTurns(w, settings),
    parallelHits: parallelPassHits(w, settings),
    localized: spanM < 420,
  }
}

export function travelConfidence(sig: MotionSignals, settings: CopilotSettings): number {
  const speed = sig.avgSpeedKmh > settings.travelSpeedKmh ? 1 : sig.avgSpeedKmh / Math.max(settings.travelSpeedKmh, 0.1)
  const fewTurns = sig.uTurns === 0 ? 1 : Math.max(0, 1 - sig.uTurns / 4)
  const noParallel = sig.parallelHits === 0 ? 1 : Math.max(0, 1 - sig.parallelHits / 3)
  const longMove = Math.min(1, sig.displacementM / 80)
  return Math.max(0, Math.min(1, 0.28 * speed + 0.22 * sig.straightness + 0.18 * fewTurns + 0.16 * noParallel + 0.16 * longMove))
}

export function harvestConfidence(sig: MotionSignals, settings: CopilotSettings): number {
  const inBand =
    sig.avgSpeedKmh >= settings.minHarvestKmh && sig.avgSpeedKmh <= settings.maxHarvestKmh
      ? 1
      : sig.avgSpeedKmh > 0 && sig.avgSpeedKmh < settings.minHarvestKmh
        ? 0.35
        : 0.1
  const turns = Math.min(1, sig.uTurns / 3)
  const parallel = Math.min(1, sig.parallelHits / 2)
  const local = sig.localized ? 1 : 0.2
  const notStraight = 1 - Math.min(1, sig.straightness)
  return Math.max(0, Math.min(1, 0.3 * inBand + 0.22 * turns + 0.26 * parallel + 0.12 * local + 0.1 * notStraight))
}
