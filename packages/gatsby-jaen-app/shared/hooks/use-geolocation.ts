/**
 * The device's position, as a React value.
 *
 * A watch on navigator.geolocation while mounted and `enabled`, nothing
 * else: no backend call, and no substitute position. The hook used to put a
 * fixed coordinate into state when the permission was refused, which is a
 * fabricated whereabouts the moment anything sends it. Now a refusal is a
 * reason and the position stays null, and the screen says why in its own
 * language: the reason is a code, never a sentence, because the browser's
 * message is in the browser's language and the app has four of its own.
 */
import {useEffect, useState} from 'react'

export type GeolocationReason = 'unsupported' | 'denied' | 'unavailable' | 'timeout'

export interface GeoPosition {
  latitude: number
  longitude: number
  /** Metres, when the device says. */
  accuracy?: number
  heading?: number
  speed?: number
  /** The device clock at the fix, epoch milliseconds. */
  timestamp: number
}

export interface GeolocationError {
  reason: GeolocationReason
  /** The browser's own text, for a log, not for a screen. */
  message: string
}

export interface GeolocationOptions {
  /** False keeps the watch off without unmounting the caller. Default true. */
  enabled?: boolean
  enableHighAccuracy?: boolean
  timeoutMs?: number
  maximumAgeMs?: number
}

const finite = (n: number | null | undefined): number | undefined =>
  typeof n === 'number' && Number.isFinite(n) ? n : undefined

export const readPosition = (pos: GeolocationPosition): GeoPosition => ({
  latitude: pos.coords.latitude,
  longitude: pos.coords.longitude,
  accuracy: finite(pos.coords.accuracy),
  heading: finite(pos.coords.heading),
  speed: finite(pos.coords.speed),
  timestamp: pos.timestamp
})

export const readReason = (err: GeolocationPositionError): GeolocationReason => {
  if (err.code === err.PERMISSION_DENIED) return 'denied'
  if (err.code === err.TIMEOUT) return 'timeout'
  return 'unavailable'
}

export function useGeolocation(options: GeolocationOptions = {}) {
  const {enabled = true, enableHighAccuracy = true, timeoutMs = 15_000, maximumAgeMs = 10_000} = options
  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [error, setError] = useState<GeolocationError | null>(null)
  const [loading, setLoading] = useState(enabled)
  const supported = typeof navigator !== 'undefined' && !!navigator.geolocation

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    if (!supported) {
      setError({reason: 'unsupported', message: 'navigator.geolocation is missing'})
      setLoading(false)
      return
    }

    setLoading(true)
    const watcher = navigator.geolocation.watchPosition(
      pos => {
        setPosition(readPosition(pos))
        setError(null)
        setLoading(false)
      },
      err => {
        // The last good fix stays, a timeout does not make it wrong. Only the
        // error is recorded, and nothing is invented in its place.
        setError({reason: readReason(err), message: err.message})
        setLoading(false)
      },
      {enableHighAccuracy, timeout: timeoutMs, maximumAge: maximumAgeMs}
    )

    return () => navigator.geolocation.clearWatch(watcher)
  }, [enabled, supported, enableHighAccuracy, timeoutMs, maximumAgeMs])

  return {position, error, loading, supported}
}
