import {
  GPS_ACCURACY_MAX_M,
  GPS_MAX_SPEED_MPS,
  GPS_MIN_MOVE_M,
} from './constants'

export type GpsSample = {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

export function haversineMeters(a: GpsSample, b: GpsSample): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function shouldAcceptGpsPoint(
  prev: GpsSample | null,
  next: GpsSample,
  opts?: {
    accuracyMaxM?: number
    minMoveM?: number
    maxSpeedMps?: number
  },
): boolean {
  const accuracyMaxM = opts?.accuracyMaxM ?? GPS_ACCURACY_MAX_M
  const minMoveM = opts?.minMoveM ?? GPS_MIN_MOVE_M
  const maxSpeedMps = opts?.maxSpeedMps ?? GPS_MAX_SPEED_MPS

  if (!Number.isFinite(next.latitude) || !Number.isFinite(next.longitude)) return false
  if (!prev) return true
  if (next.accuracy > accuracyMaxM) return false

  const distance = haversineMeters(prev, next)
  if (distance < minMoveM) return false

  const dtSec = (next.timestamp - prev.timestamp) / 1000
  if (dtSec <= 0) return false
  if (distance / dtSec > maxSpeedMps) return false

  return true
}

export function pathDistanceMeters(points: GpsSample[]): number {
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    total += haversineMeters(points[i - 1], points[i])
  }
  return total
}
