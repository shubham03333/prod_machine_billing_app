'use client'

import { useEffect, useRef, useState } from 'react'
import type { Feature } from 'geojson'
import type { GeoJsonPolygon } from '@/lib/copilot/types'
import type { GpsSample } from '@/lib/gps/geo'
import type { CircleMarker, GeoJSON, Map as LeafletMap, TileLayer } from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Props = {
  here: GpsSample | null
  coverage: GeoJsonPolygon | null
  satellite: boolean
}

const OSM = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

export default function CopilotMap({ here, coverage, satellite }: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const tilesRef = useRef<TileLayer | null>(null)
  const hereRef = useRef<CircleMarker | null>(null)
  const coverRef = useRef<GeoJSON | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!boxRef.current || mapRef.current) return
    let cancelled = false
    const start = here
    void (async () => {
      const L = await import('leaflet')
      if (cancelled || !boxRef.current) return
      const map = L.map(boxRef.current, { zoomControl: true, attributionControl: true }).setView(
        start ? [start.latitude, start.longitude] : [20.59, 78.96],
        start ? 18 : 5,
      )
      mapRef.current = map
      tilesRef.current = L.tileLayer(OSM, { maxZoom: 22, maxNativeZoom: 19, crossOrigin: true }).addTo(map)
      window.setTimeout(() => map.invalidateSize(), 120)
      setReady(true)
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    void (async () => {
      const L = await import('leaflet')
      if (tilesRef.current) map.removeLayer(tilesRef.current)
      tilesRef.current = L.tileLayer(satellite ? SAT : OSM, {
        maxZoom: 22,
        maxNativeZoom: 19,
        crossOrigin: true,
      }).addTo(map)
      coverRef.current?.bringToFront()
      hereRef.current?.bringToFront()
    })()
  }, [satellite, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !here) return
    void (async () => {
      const L = await import('leaflet')
      const latlng = L.latLng(here.latitude, here.longitude)
      if (!hereRef.current) {
        hereRef.current = L.circleMarker(latlng, {
          radius: 8,
          color: '#fff',
          weight: 3,
          fillColor: '#2563eb',
          fillOpacity: 1,
        }).addTo(map)
        map.setView(latlng, 18, { animate: false })
      } else {
        hereRef.current.setLatLng(latlng)
        map.panTo(latlng, { animate: false })
      }
      hereRef.current.bringToFront()
    })()
  }, [here, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    void (async () => {
      const L = await import('leaflet')
      if (coverRef.current) {
        map.removeLayer(coverRef.current)
        coverRef.current = null
      }
      if (!coverage) return
      const feature: Feature = { type: 'Feature', properties: {}, geometry: coverage as Feature['geometry'] }
      coverRef.current = L.geoJSON(feature, {
        style: { color: '#16a34a', weight: 2, fillColor: '#4ade80', fillOpacity: 0.35 },
      }).addTo(map)
      hereRef.current?.bringToFront()
    })()
  }, [coverage, ready])

  return (
    <div className="w-full h-full min-h-0 rounded-xl overflow-hidden border border-gray-200">
      <div ref={boxRef} className="w-full h-full min-h-0" />
    </div>
  )
}
