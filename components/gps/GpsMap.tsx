'use client'

import { useEffect, useRef, useState } from 'react'
import type { GpsSample } from '@/lib/gps/geo'
import type { LatLngExpression, Map as LeafletMap, Polygon, Polyline, TileLayer } from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Props = {
  points: GpsSample[]
  satellite: boolean
}

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

export default function GpsMap({ points, satellite }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const layerRef = useRef<TileLayer | null>(null)
  const lineRef = useRef<Polyline | null>(null)
  const polyRef = useRef<Polygon | null>(null)
  const fittedRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false
    ;(async () => {
      const L = await import('leaflet')
      if (cancelled || !containerRef.current) return
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        bounceAtZoomLimits: false,
        zoomSnap: 0,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 80,
        inertia: true,
      }).setView([20.5937, 78.9629], 5)
      mapRef.current = map
      const tiles = L.tileLayer(OSM_URL, {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 22,
        maxNativeZoom: 19,
        crossOrigin: true,
      })
      tiles.addTo(map)
      layerRef.current = tiles
      setMapReady(true)
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      layerRef.current = null
      lineRef.current = null
      polyRef.current = null
      fittedRef.current = false
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    let cancelled = false
    ;(async () => {
      const L = await import('leaflet')
      if (cancelled || !mapRef.current) return
      if (layerRef.current) map.removeLayer(layerRef.current)
      const tiles = L.tileLayer(satellite ? SAT_URL : OSM_URL, {
        attribution: satellite ? 'Esri' : '&copy; OpenStreetMap',
        maxZoom: 22,
        maxNativeZoom: 19,
        crossOrigin: true,
      })
      tiles.addTo(map)
      layerRef.current = tiles
      lineRef.current?.bringToFront()
      polyRef.current?.bringToFront()
    })()
    return () => {
      cancelled = true
    }
  }, [satellite, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    let cancelled = false
    ;(async () => {
      const L = await import('leaflet')
      if (cancelled || !mapRef.current) return
      const latlngs: LatLngExpression[] = points.map((p) => [p.latitude, p.longitude])
      if (lineRef.current) {
        map.removeLayer(lineRef.current)
        lineRef.current = null
      }
      if (polyRef.current) {
        map.removeLayer(polyRef.current)
        polyRef.current = null
      }
      if (latlngs.length === 0) {
        fittedRef.current = false
        return
      }

      const lineColor = satellite ? '#facc15' : '#2563eb'
      const fillColor = satellite ? '#fde047' : '#16a34a'
      lineRef.current = L.polyline(latlngs, {
        color: lineColor,
        weight: 4,
        opacity: 0.95,
      }).addTo(map)
      if (latlngs.length >= 3) {
        polyRef.current = L.polygon(latlngs, {
          color: fillColor,
          weight: 2,
          fillColor,
          fillOpacity: satellite ? 0.28 : 0.22,
        }).addTo(map)
      }
      lineRef.current.bringToFront()
      if (!fittedRef.current) {
        map.fitBounds(L.latLngBounds(latlngs).pad(0.25), { animate: false })
        fittedRef.current = true
      }
    })()
    return () => {
      cancelled = true
    }
  }, [points, mapReady, satellite])

  return (
    <div
      data-gps-map
      className="gps-map-wrap w-full h-full min-h-[320px] rounded-2xl overflow-hidden border border-gray-200"
    >
      <div ref={containerRef} className="w-full h-full min-h-[320px]" />
    </div>
  )
}
