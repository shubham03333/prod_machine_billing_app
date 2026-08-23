import html2canvas from 'html2canvas'
import { GUNTHA_PER_ACRE } from '@/lib/gps/constants'
import type { GpsSample } from '@/lib/gps/geo'
import { renderTracedFieldPng } from '@/lib/gps/renderMapPng'

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

function coord(p: GpsSample): string {
  return `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`
}

export function mapsLinkForPoints(points: GpsSample[]): string {
  const clean = cleanPoints(points)
  if (clean.length === 0) return ''
  if (clean.length === 1) {
    const p = clean[0]
    return `https://www.google.com/maps/?api=1&query=${coord(p)}&zoom=19`
  }

  const closed = clean.length >= 3 ? [...clean, clean[0]] : clean
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
  const rate = input.ratePerAcre
  const date = input.dateLabel
  const route = mapsLinkForPoints(input.points)
  return [
    'JD Agro — GPS Field Measurement',
    `Farmer: ${input.farmer}`,
    `Village: ${input.village || '—'}`,
    `Machine: ${input.machine}`,
    `Operator: ${input.operator}`,
    `Area: ${input.acres.toFixed(3)} acre`,
    `Guntha: ${input.guntha.toFixed(2)} (1 acre = ${GUNTHA_PER_ACRE} guntha)`,
    `Rate: ₹${rate} / acre`,
    `Amount: ₹${input.amount.toFixed(2)}`,
    `Date: ${date}`,
    route ? `Traced route: ${route}` : '',
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
      allowTaint: false,
      backgroundColor: '#ffffff',
      scale: Math.min(2, window.devicePixelRatio || 1),
      logging: false,
    })
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) return null
    return new File([blob], 'gps-field-map.jpg', { type: 'image/jpeg' })
  } catch {
    return null
  }
}

export async function buildTracedMapFile(input: {
  points: GpsSample[]
  satellite?: boolean
  acres?: number
  guntha?: number
  village?: string
}): Promise<File | null> {
  const drawn = await renderTracedFieldPng(input)
  if (drawn) return drawn
  return captureMapPng(document)
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function shareMeasurement(opts: {
  text: string
  file: File | null
}): Promise<void> {
  if (opts.file && typeof navigator.share === 'function') {
    const payload: ShareData = {
      title: 'GPS Field Measurement',
      text: opts.text,
      files: [opts.file],
    }
    const canFiles = typeof navigator.canShare !== 'function' || navigator.canShare({ files: [opts.file] })
    if (canFiles) {
      try {
        await navigator.share(payload)
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    try {
      await navigator.share({ title: 'GPS Field Measurement', text: opts.text, files: [opts.file] })
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }

  if (opts.file) downloadFile(opts.file)
  window.open(whatsappUrl(FIELD_WHATSAPP_NUMBER, opts.text), '_blank', 'noopener,noreferrer')
}
