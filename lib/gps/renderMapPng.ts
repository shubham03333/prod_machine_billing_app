import type { GpsSample } from '@/lib/gps/geo'

type Pt = { latitude: number; longitude: number }

function readLatLng(p: GpsSample | Record<string, unknown>): Pt | null {
  const raw = p as Record<string, unknown>
  const latitude = Number(raw.latitude ?? raw.lat)
  const longitude = Number(raw.longitude ?? raw.lng ?? raw.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return { latitude, longitude }
}

function cleanPoints(points: GpsSample[]): Pt[] {
  const out: Pt[] = []
  for (const p of points) {
    const n = readLatLng(p)
    if (n) out.push(n)
  }
  return out
}

function mercator(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom
  const sin = Math.sin((lat * Math.PI) / 180)
  const x = ((lng + 180) / 360) * n
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * n
  return { x, y }
}

function wrapTile(t: number, n: number) {
  return ((t % n) + n) % n
}

function loadTile(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timer = window.setTimeout(() => {
      img.src = ''
      resolve(null)
    }, 2500)
    img.onload = () => {
      window.clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      resolve(null)
    }
    img.src = url
  })
}

function tileUrl(z: number, x: number, y: number, satellite: boolean) {
  const n = 2 ** z
  const tx = wrapTile(x, n)
  const ty = Math.min(n - 1, Math.max(0, y))
  if (satellite) {
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${tx}`
  }
  return `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${tx}/${ty}.png`
}

export async function renderTracedFieldPng(input: {
  points: GpsSample[]
  satellite?: boolean
  acres?: number
  guntha?: number
  village?: string
}): Promise<File | null> {
  if (typeof document === 'undefined') return null
  const pts = cleanPoints(input.points)
  if (pts.length === 0) return null

  const width = 900
  const height = 900
  const pad = 56
  const tileSize = 256
  const satellite = Boolean(input.satellite)

  let minLat = pts[0].latitude
  let maxLat = pts[0].latitude
  let minLng = pts[0].longitude
  let maxLng = pts[0].longitude
  for (const p of pts) {
    minLat = Math.min(minLat, p.latitude)
    maxLat = Math.max(maxLat, p.latitude)
    minLng = Math.min(minLng, p.longitude)
    maxLng = Math.max(maxLng, p.longitude)
  }
  const latPad = Math.max((maxLat - minLat) * 0.12, 0.00018)
  const lngPad = Math.max((maxLng - minLng) * 0.12, 0.00018)
  minLat -= latPad
  maxLat += latPad
  minLng -= lngPad
  maxLng += lngPad

  let zoom = 18
  for (let z = 19; z >= 12; z -= 1) {
    const a = mercator(maxLat, minLng, z)
    const b = mercator(minLat, maxLng, z)
    const w = Math.abs(b.x - a.x) * tileSize
    const h = Math.abs(b.y - a.y) * tileSize
    if (w <= width - pad * 2 && h <= height - pad * 2) {
      zoom = z
      break
    }
    zoom = z
  }

  const a = mercator(maxLat, minLng, zoom)
  const b = mercator(minLat, maxLng, zoom)
  const cx = (a.x + b.x) / 2
  const cy = (a.y + b.y) / 2
  const originX = cx * tileSize - width / 2
  const originY = cy * tileSize - height / 2

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = satellite ? '#1a2330' : '#e8f0e3'
  ctx.fillRect(0, 0, width, height)

  const minTx = Math.floor(originX / tileSize)
  const maxTx = Math.floor((originX + width) / tileSize)
  const minTy = Math.floor(originY / tileSize)
  const maxTy = Math.floor((originY + height) / tileSize)
  const jobs: Promise<void>[] = []
  for (let tx = minTx; tx <= maxTx; tx += 1) {
    for (let ty = minTy; ty <= maxTy; ty += 1) {
      jobs.push(
        loadTile(tileUrl(zoom, tx, ty, satellite)).then((img) => {
          if (!img) return
          ctx.drawImage(img, tx * tileSize - originX, ty * tileSize - originY, tileSize, tileSize)
        }),
      )
    }
  }
  await Promise.all(jobs)

  const toPx = (p: Pt) => {
    const m = mercator(p.latitude, p.longitude, zoom)
    return { x: m.x * tileSize - originX, y: m.y * tileSize - originY }
  }

  const ring = pts.length >= 3 ? [...pts, pts[0]] : pts
  const pixels = ring.map(toPx)

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (pts.length >= 3) {
    ctx.beginPath()
    pixels.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)))
    ctx.closePath()
    ctx.fillStyle = satellite ? 'rgba(250, 204, 21, 0.32)' : 'rgba(22, 163, 74, 0.28)'
    ctx.fill()
  }

  ctx.beginPath()
  pixels.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)))
  ctx.strokeStyle = satellite ? '#facc15' : '#166534'
  ctx.lineWidth = 5
  ctx.stroke()

  const start = toPx(pts[0])
  ctx.beginPath()
  ctx.arc(start.x, start.y, 8, 0, Math.PI * 2)
  ctx.fillStyle = '#2563eb'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()

  ctx.fillStyle = 'rgba(15, 23, 42, 0.82)'
  ctx.fillRect(0, 0, width, 52)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText('JD Agro — traced field', 16, 34)
  const acres = input.acres
  const guntha = input.guntha
  if (acres != null && guntha != null) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)'
    ctx.fillRect(0, height - 48, width, 48)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 20px sans-serif'
    const village = input.village ? ` · ${input.village}` : ''
    ctx.fillText(`${acres.toFixed(2)} acre · ${guntha.toFixed(1)} guntha${village}`, 16, height - 18)
  }

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
  if (!blob) return null
  return new File([blob], 'gps-traced-field.jpg', { type: 'image/jpeg' })
}
