import html2canvas from 'html2canvas'
import { GUNTHA_PER_ACRE } from '@/lib/gps/constants'
import type { GpsSample } from '@/lib/gps/geo'

/** Always send GPS measurement WhatsApp shares to this number. */
export const FIELD_WHATSAPP_NUMBER = '7558379411'

export function normalizeWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  return digits
}

function readLatLng(p: GpsSample | Record<string, unknown>): GpsSample | null {
  const raw = p as Record<string, unknown>
  const latitude = Number(raw.latitude ?? raw.lat)
  const longitude = Number(raw.longitude ?? raw.lng ?? raw.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return {
    latitude,
    longitude,
    accuracy: Number(raw.accuracy) || 0,
    timestamp: Number(raw.timestamp) || 0,
  }
}

function cleanPoints(points: GpsSample[]): GpsSample[] {
  const out: GpsSample[] = []
  for (const p of points) {
    const n = readLatLng(p)
    if (n) out.push(n)
  }
  return out
}

function samplePath(points: GpsSample[], maxPoints: number): GpsSample[] {
  if (points.length <= maxPoints) return points
  const sampled: GpsSample[] = []
  const last = maxPoints - 1
  for (let i = 0; i < maxPoints; i += 1) {
    const idx = Math.round((i * (points.length - 1)) / last)
    sampled.push(points[idx])
  }
  return sampled
}

function zoomForSpan(points: GpsSample[]): number {
  const lats = points.map((p) => p.latitude)
  const lngs = points.map((p) => p.longitude)
  const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs), 0.00025)
  if (span < 0.0015) return 18
  if (span < 0.004) return 17
  if (span < 0.01) return 16
  if (span < 0.025) return 15
  if (span < 0.06) return 14
  return 13
}

function coord(p: GpsSample): string {
  return `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`
}

/** Google Maps walking route through sampled GPS points (query form, not a single pin). */
export function mapsLinkForPoints(points: GpsSample[]): string {
  const clean = cleanPoints(points)
  if (clean.length === 0) return ''
  if (clean.length === 1) {
    const p = clean[0]
    return `https://www.google.com/maps/?api=1&query=${coord(p)}&zoom=19`
  }

  const closed = clean.length >= 3 ? [...clean, clean[0]] : clean
  // Maps URLs allow origin + destination + 9 waypoints.
  const sampled = samplePath(closed, 11)
  const origin = sampled[0]
  const destination = sampled[sampled.length - 1]
  const mids = sampled.slice(1, -1)
  const params = new URLSearchParams({
    api: '1',
    origin: coord(origin),
    destination: coord(destination),
    travelmode: 'walking',
  })
  if (mids.length) params.set('waypoints', mids.map(coord).join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/** Static image of the traced outline — WhatsApp can preview this instead of a start pin. */
export function tracedMapImageLink(points: GpsSample[]): string {
  const clean = cleanPoints(points)
  if (clean.length === 0) return ''
  const sampled = samplePath(clean.length >= 3 ? [...clean, clean[0]] : clean, 40)
  const mid = sampled[Math.floor(sampled.length / 2)]
  const zoom = zoomForSpan(sampled)
  const path = sampled.map((p) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`).join('|')
  const q = new URLSearchParams({
    center: `${mid.latitude.toFixed(5)},${mid.longitude.toFixed(5)}`,
    zoom: String(zoom),
    size: '600x400',
    maptype: 'mapnik',
  })
  return `https://staticmap.openstreetmap.de/staticmap.php?${q.toString()}&path=weight:5|color:0x16a34aff|${path}`
}

export function buildMeasurementShareText(input: {
  farmer: string
  village: string
  machine: string
  operator: string
  acres: number
  guntha: number
  amount: number
  ratePerAcre: number
  dateLabel: string
  points: GpsSample[]
}): string {
  const route = mapsLinkForPoints(input.points)
  const outline = tracedMapImageLink(input.points)
  return [
    'JD Agro — GPS Field Measurement',
    `Farmer: ${input.farmer}`,
    `Village: ${input.village || '—'}`,
    `Machine: ${input.machine}`,
    `Operator: ${input.operator}`,
    `Area: ${input.acres.toFixed(3)} acre`,
    `Guntha: ${input.guntha.toFixed(2)} (1 acre = ${GUNTHA_PER_ACRE} guntha)`,
    `Rate: ₹${input.ratePerAcre} / acre`,
    `Amount: ₹${input.amount.toFixed(2)}`,
    `Date: ${input.dateLabel}`,
    route ? `Traced route: ${route}` : '',
    outline ? `Traced outline: ${outline}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function whatsappUrl(phone: string, text: string): string {
  return `https://wa.me/${normalizeWhatsAppNumber(phone)}?text=${encodeURIComponent(text)}`
}

export async function captureMapPng(root?: ParentNode | null): Promise<File | null> {
  const el = (root || document).querySelector('[data-gps-map]') as HTMLElement | null
  if (!el) return null
  try {
    const canvas = await html2canvas(el, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      scale: Math.min(2, window.devicePixelRatio || 1),
    })
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return null
    return new File([blob], 'gps-field-map.png', { type: 'image/png' })
  } catch {
    return null
  }
}

export async function shareMeasurement(opts: {
  text: string
  file: File | null
}): Promise<void> {
  window.open(whatsappUrl(FIELD_WHATSAPP_NUMBER, opts.text), '_blank', 'noopener,noreferrer')

  if (opts.file && navigator.share && navigator.canShare?.({ files: [opts.file] })) {
    try {
      await navigator.share({
        title: 'GPS Field Measurement',
        text: opts.text,
        files: [opts.file],
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }
}
