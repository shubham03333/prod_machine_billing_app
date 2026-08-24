import { haversineMeters } from '@/lib/gps/geo'
import type { CopilotSettings, FilteredSample, RawGpsFix } from './types'

function headingBetween(a: { latitude: number; longitude: number }, b: RawGpsFix): number {
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180
  const lat1 = (a.latitude * Math.PI) / 180
  const lat2 = (b.latitude * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

export function filterGpsFix(
  prev: FilteredSample | null,
  fix: RawGpsFix,
  settings: CopilotSettings,
): FilteredSample | null {
  if (!Number.isFinite(fix.latitude) || !Number.isFinite(fix.longitude)) return null
  if (fix.accuracy > settings.minGpsAccuracyM) return null

  if (!prev) {
    return {
      latitude: fix.latitude,
      longitude: fix.longitude,
      accuracy: fix.accuracy,
      speedKmh: fix.speedMps != null ? Math.max(0, fix.speedMps * 3.6) : 0,
      headingDeg: fix.headingDeg ?? 0,
      timestamp: fix.timestamp,
    }
  }

  const dist = haversineMeters(
    { latitude: prev.latitude, longitude: prev.longitude, accuracy: prev.accuracy, timestamp: prev.timestamp },
    { latitude: fix.latitude, longitude: fix.longitude, accuracy: fix.accuracy, timestamp: fix.timestamp },
  )
  if (dist < 0.25) return null
  if (dist < settings.minMoveM && (fix.speedMps == null || fix.speedMps < 0.3)) return null
  if (dist > settings.maxJumpM) return null

  const dt = (fix.timestamp - prev.timestamp) / 1000
  if (dt <= 0) return null
  const speedMps = fix.speedMps != null && fix.speedMps >= 0 ? fix.speedMps : dist / dt
  if (speedMps > settings.maxSpeedMps) return null

  return {
    latitude: fix.latitude,
    longitude: fix.longitude,
    accuracy: fix.accuracy,
    speedKmh: Math.max(0, speedMps * 3.6),
    headingDeg: fix.headingDeg != null ? fix.headingDeg : headingBetween(prev, fix),
    timestamp: fix.timestamp,
  }
}
