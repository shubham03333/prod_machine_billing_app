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

export function mapsLinkForPoints(points: GpsSample[]): string {
  if (points.length === 0) return ''
  const last = points[points.length - 1]
  return `https://www.google.com/maps?q=${last.latitude},${last.longitude}`
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
  const map = mapsLinkForPoints(input.points)
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
    map ? `Map: ${map}` : '',
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
