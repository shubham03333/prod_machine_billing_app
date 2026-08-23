'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GPS_UI_THROTTLE_MS } from '@/lib/gps/constants'
import { shouldAcceptGpsPoint, type GpsSample } from '@/lib/gps/geo'
import { computeMeasurementGeometry, emptyArea, type AreaBreakdown } from '@/lib/gps/area'

export type GpsStatus = 'idle' | 'requesting' | 'live' | 'paused' | 'denied' | 'unavailable' | 'weak'

export function useGpsTracking() {
  const watchIdRef = useRef<number | null>(null)
  const pointsRef = useRef<GpsSample[]>([])
  const lastAcceptedRef = useRef<GpsSample | null>(null)
  const lastUiRef = useRef(0)
  const [points, setPoints] = useState<GpsSample[]>([])
  const [lastAccuracy, setLastAccuracy] = useState<number | null>(null)
  const [status, setStatus] = useState<GpsStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [geometry, setGeometry] = useState<AreaBreakdown>(emptyArea())

  const publish = useCallback((force = false) => {
    const now = Date.now()
    if (!force && now - lastUiRef.current < GPS_UI_THROTTLE_MS) return
    lastUiRef.current = now
    const snapshot = pointsRef.current.slice()
    setPoints(snapshot)
    setGeometry(computeMeasurementGeometry(snapshot))
  }, [])

  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const onPosition = useCallback(
    (pos: GeolocationPosition) => {
      const sample: GpsSample = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp || Date.now(),
      }
      setLastAccuracy(sample.accuracy)
      if (!shouldAcceptGpsPoint(lastAcceptedRef.current, sample)) {
        setStatus((prev) => (prev === 'paused' ? 'paused' : sample.accuracy > 12 ? 'weak' : 'live'))
        return
      }
      lastAcceptedRef.current = sample
      pointsRef.current = [...pointsRef.current, sample]
      setStatus('live')
      publish()
    },
    [publish],
  )

  const onError = useCallback((err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) {
      setStatus('denied')
      setErrorMessage('Location permission denied')
      return
    }
    setStatus('unavailable')
    setErrorMessage(err.message || 'GPS unavailable')
  }, [])

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable')
      setErrorMessage('Geolocation is not supported')
      return
    }
    setStatus('requesting')
    setErrorMessage('')
    stopWatch()
    watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 15000,
    })
  }, [onError, onPosition, stopWatch])

  const pause = useCallback(() => {
    stopWatch()
    setStatus('paused')
    publish(true)
  }, [publish, stopWatch])

  const resume = useCallback(() => {
    start()
  }, [start])

  const reset = useCallback(() => {
    stopWatch()
    pointsRef.current = []
    lastAcceptedRef.current = null
    setPoints([])
    setGeometry(emptyArea())
    setLastAccuracy(null)
    setStatus('idle')
    setErrorMessage('')
  }, [stopWatch])

  const restorePoints = useCallback((saved: GpsSample[]) => {
    pointsRef.current = saved
    lastAcceptedRef.current = saved[saved.length - 1] || null
    setPoints(saved)
    setGeometry(computeMeasurementGeometry(saved))
  }, [])

  useEffect(() => () => stopWatch(), [stopWatch])

  return {
    points,
    pointsRef,
    geometry,
    lastAccuracy,
    status,
    errorMessage,
    start,
    pause,
    resume,
    reset,
    restorePoints,
    publish,
  }
}
