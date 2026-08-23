import { NextRequest, NextResponse } from 'next/server'
import { requireFieldOperator } from '@/lib/field-auth'
import { villageNameFromNominatim, type NominatimReverse } from '@/lib/gps/reverseGeocode'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireFieldOperator(request)
  if ('error' in auth) return auth.error

  const lat = Number(request.nextUrl.searchParams.get('lat'))
  const lng = Number(request.nextUrl.searchParams.get('lng'))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
  }

    try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('lat', String(lat))
    url.searchParams.set('lon', String(lng))
    url.searchParams.set('zoom', '14')
    url.searchParams.set('addressdetails', '1')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'RentraFieldGPS/1.0 (machine billing village lookup)',
          'Accept-Language': 'mr,en',
        },
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!res.ok) {
        return NextResponse.json({ village: '' })
      }
      const data = (await res.json()) as NominatimReverse
      return NextResponse.json({ village: villageNameFromNominatim(data) })
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return NextResponse.json({ village: '' })
  }
}
