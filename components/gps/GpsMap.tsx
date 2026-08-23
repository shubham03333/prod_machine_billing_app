'use client'

import { useEffect, useRef, useState } from 'react'
import type { GpsSample } from '@/lib/gps/geo'
import type { CircleMarker, LatLngExpression, Map as LeafletMap, Polygon, Polyline, TileLayer } from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Props = {
  points: GpsSample[]
  here?: GpsSample | null
  satellite: boolean
  className?: string
}

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

export default function GpsMap({ points, here, satellite, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const layerRef = useRef<TileLayer | null>(null)
  const lineRef = useRef<Polyline | null>(null)
  const polyRef = useRef<Polygon | null>(null)
  const hereRef = useRef<CircleMarker | null>(null)
  const centeredRef = useRef(false)
  const startHereRef = useRef(here)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false
    const start = startHereRef.current
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
      }).setView(
        start ? [start.latitude, start.longitude] : [20.5937, 78.9629],
        start ? 18 : 5,
      )
      if (start) centeredRef.current = true
      mapRef.current = map
      const tiles = L.tileLayer(OSM_URL, {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 22,
        maxNativeZoom: 19,
        crossOrigin: true,
      })
      tiles.addTo(map)
      layerRef.current = tiles
      window.setTimeout(() => map.invalidateSize(), 150)
      setMapReady(true)
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      layerRef.current = null
      lineRef.current = null
      polyRef.current = null
      hereRef.current = null
      centeredRef.current = false
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
      hereRef.current?.bringToFront()
    })()
    return () => {
      cancelled = true
    }
  }, [satellite, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !here) return
    let cancelled = false
    ;(async () => {
      const L = await import('leaflet')
      if (cancelled || !mapRef.current) return
      const latlng = L.latLng(here.latitude, here.longitude)
      if (!hereRef.current) {
        hereRef.current = L.circleMarker(latlng, {
          radius: 9,
          color: '#ffffff',
          weight: 3,
          fillColor: '#2563eb',
          fillOpacity: 1,
        }).addTo(map)
      } else {
        hereRef.current.setLatLng(latlng)
      }
      hereRef.current.bringToFront()
      if (!centeredRef.current) {
        map.setView(latlng, 18, { animate: false })
        centeredRef.current = true
      } else {
        map.panTo(latlng, { animate: false })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [here, mapReady])

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
      if (latlngs.length === 0) return

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
      hereRef.current?.bringToFront()
    })()
    return () => {
      cancelled = true
    }
  }, [points, mapReady, satellite])

  return (
    <div
      data-gps-map
      className={`gps-map-wrap w-full h-full min-h-0 rounded-xl overflow-hidden border border-gray-200 ${className}`}
    >
      <div ref={containerRef} className="w-full h-full min-h-0" />
    </div>
  )
}
