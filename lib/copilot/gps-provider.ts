import type { RawGpsFix } from './types'

export type GpsFixHandler = (fix: RawGpsFix) => void
export type GpsErrorHandler = (message: string) => void

export interface GpsProvider {
  start(onFix: GpsFixHandler, onError: GpsErrorHandler): void
  stop(): void
}

/** Browser GNSS. Swap this class for Bluetooth / RTK later; harvest logic stays the same. */
export class BrowserGeolocationProvider implements GpsProvider {
  private watchId: number | null = null

  start(onFix: GpsFixHandler, onError: GpsErrorHandler): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      onError('Geolocation is not available')
      return
    }
    this.stop()
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        onFix({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 99,
          speedMps: pos.coords.speed != null && Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
          headingDeg: pos.coords.heading != null && Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
          timestamp: pos.timestamp || Date.now(),
        })
      },
      (err) => onError(err.message || 'GPS error'),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 12000,
      },
    )
  }

  stop(): void {
    if (this.watchId != null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }
  }
}
