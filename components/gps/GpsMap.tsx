'use client'

import { useEffect, useRef } from 'react'
import type { GpsSample } from '@/lib/gps/geo'
import 'leaflet/dist/leaflet.css'

type Props = {
  points: GpsSample[]
  satellite: boolean
}

export default function GpsMap({ points, satellite }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const layerRef = useRef<import('leaflet').TileLayer | null>(null)
  const lineRef = useRef<import('leaflet').Polyline | null>(null)
  const polyRef = useRef<import('leaflet').Polygon | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false
    ;(async () => {
      const L = await import('leaflet')
      if (cancelled || !containerRef.current) return
      const map = L.map(containerRef.current, { zoomControl: true }).setView([20.5937, 78.9629], 5)
      mapRef.current = map
      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      })
      tiles.addTo(map)
      layerRef.current = tiles
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let cancelled = false
    ;(async () => {
      const L = await import('leaflet')
      if (cancelled || !mapRef.current) return
      if (layerRef.current) map.removeLayer(layerRef.current)
      const url = satellite
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      const tiles = L.tileLayer(url, { attribution: satellite ? 'Esri' : '&copy; OpenStreetMap' })
      tiles.addTo(map)
      layerRef.current = tiles
    })()
    return () => {
      cancelled = true
    }
  }, [satellite])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let cancelled = false
    ;(async () => {
      const L = await import('leaflet')
      if (cancelled || !mapRef.current) return
      const latlngs = points.map((p) => L.latLng(p.latitude, p.longitude))
      if (lineRef.current) map.removeLayer(lineRef.current)
      if (polyRef.current) map.removeLayer(polyRef.current)
      if (latlngs.length === 0) return
      lineRef.current = L.polyline(latlngs, { color: '#2563eb', weight: 3 }).addTo(map)
      if (latlngs.length >= 3) {
        polyRef.current = L.polygon(latlngs, {
          color: '#16a34a',
          weight: 2,
          fillOpacity: 0.2,
        }).addTo(map)
      }
      map.fitBounds(L.latLngBounds(latlngs).pad(0.2))
    })()
    return () => {
      cancelled = true
    }
  }, [points])

  return <div ref={containerRef} className="w-full h-full min-h-[320px] rounded-2xl overflow-hidden border border-gray-200" />
}
