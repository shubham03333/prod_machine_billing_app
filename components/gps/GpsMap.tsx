'use client'

import { useEffect, useRef, useState } from 'react'
import type { GpsSample } from '@/lib/gps/geo'
import type { CircleMarker, LatLngBounds, LatLngExpression, Map as LeafletMap, Polygon, Polyline, TileLayer } from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Props = {
  points: GpsSample[]
  here?: GpsSample | null
  satellite: boolean
  className?: string
  fitToRoute?: boolean
}

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

function readLatLng(p: GpsSample | Record<string, unknown>): [number, number] | null {
  const raw = p as Record<string, unknown>
  const lat = Number(raw.latitude ?? raw.lat)
  const lng = Number(raw.longitude ?? raw.lng ?? raw.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return [lat, lng]
}

export default function GpsMap({ points, here, satellite, className = '', fitToRoute = false }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const layerRef = useRef<TileLayer | null>(null)
  const lineRef = useRef<Polyline | null>(null)
  const polyRef = useRef<Polygon | null>(null)
  const hereRef = useRef<CircleMarker | null>(null)
  const centeredRef = useRef(false)
  const boundsRef = useRef<LatLngBounds | null>(null)
  const startHereRef = useRef(here)
  const pointsRef = useRef(points)
  pointsRef.current = points
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false
    const start = startHereRef.current
    const firstPoint = readLatLng((start || pointsRef.current[0]) as GpsSample)
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
      }).setView(firstPoint || [20.5937, 78.9629], firstPoint ? 18 : 5)
      if (firstPoint) centeredRef.current = true
      mapRef.current = map
      const tiles = L.tileLayer(OSM_URL, {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 22,
        maxNativeZoom: 19,
        crossOrigin: true,
      })
      tiles.addTo(map)
      layerRef.current = tiles
      const sizeUp = () => {
        if (cancelled || !mapRef.current) return
        map.invalidateSize()
      }
      window.setTimeout(sizeUp, 50)
      window.setTimeout(sizeUp, 200)
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
      boundsRef.current = null
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
      const pair = readLatLng(here)
      if (!pair) return
      const latlng = L.latLng(pair[0], pair[1])
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
      if (fitToRoute) return
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
  }, [here, mapReady, fitToRoute])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    let cancelled = false
    ;(async () => {
      const L = await import('leaflet')
      if (cancelled || !mapRef.current) return
      const latlngs: LatLngExpression[] = []
      for (const p of points) {
        const pair = readLatLng(p)
        if (pair) latlngs.push(pair)
      }
      if (lineRef.current) {
        map.removeLayer(lineRef.current)
        lineRef.current = null
      }
      if (polyRef.current) {
        map.removeLayer(polyRef.current)
        polyRef.current = null
      }
      boundsRef.current = null
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

      const bounds = L.latLngBounds(latlngs)
      if (!bounds.isValid()) return
      boundsRef.current = bounds

      const applyFit = () => {
        if (cancelled || !mapRef.current || !boundsRef.current) return
        map.invalidateSize()
        if (fitToRoute) {
          map.fitBounds(boundsRef.current, { padding: [36, 36], maxZoom: 19, animate: false })
          centeredRef.current = true
        }
      }
      applyFit()
      window.setTimeout(applyFit, 80)
      window.setTimeout(applyFit, 280)
    })()
    return () => {
      cancelled = true
    }
  }, [points, mapReady, satellite, fitToRoute])

  useEffect(() => {
    const el = containerRef.current
    const map = mapRef.current
    if (!el || !map || !mapReady) return
    const applyFit = () => {
      map.invalidateSize()
      if (fitToRoute && boundsRef.current?.isValid()) {
        map.fitBounds(boundsRef.current, { padding: [36, 36], maxZoom: 19, animate: false })
        centeredRef.current = true
      }
    }
    const ro = new ResizeObserver(() => applyFit())
    ro.observe(el)
    applyFit()
    return () => ro.disconnect()
  }, [mapReady, fitToRoute, points])

  return (
    <div
      data-gps-map
      className={`gps-map-wrap w-full h-full min-h-0 rounded-xl overflow-hidden border border-gray-200 ${className}`}
    >
      <div ref={containerRef} className="w-full h-full min-h-0" />
    </div>
  )
}
