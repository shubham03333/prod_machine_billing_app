function haversineMeters(a, b) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function shouldAcceptGpsPoint(prev, next, opts = {}) {
  const accuracyMaxM = opts.accuracyMaxM ?? 50
  const minMoveM = opts.minMoveM ?? 1
  const maxSpeedMps = opts.maxSpeedMps ?? 25
  if (!prev) return true
  if (next.accuracy > accuracyMaxM) return false
  const distance = haversineMeters(prev, next)
  if (distance < minMoveM) return false
  const dtSec = (next.timestamp - prev.timestamp) / 1000
  if (dtSec <= 0) return false
  if (distance / dtSec > maxSpeedMps) return false
  return true
}

const a = { latitude: 18.52, longitude: 73.85, accuracy: 3, timestamp: 1000 }
const poor = { latitude: 18.521, longitude: 73.851, accuracy: 80, timestamp: 2000 }
const jump = { latitude: 19.0, longitude: 74.0, accuracy: 3, timestamp: 1100 }
if (shouldAcceptGpsPoint(null, a) !== true) throw new Error('first point')
if (shouldAcceptGpsPoint(a, poor) !== false) throw new Error('poor accuracy')
if (shouldAcceptGpsPoint(a, jump) !== false) throw new Error('impossible jump')
console.log('gps geo checks passed')
