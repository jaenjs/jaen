/**
 * Where the driver is: the read for the customer and the dispatcher, and
 * the write from the driver's phone.
 *
 * The read is `transferTracking(args: {transferId})`, one query that carries
 * the driver, the car and the last position, scoped in the resolver: an
 * admin any transfer, a customer their own booking, a driver their own ride.
 * It carries no phone number and no price, so the same shape is safe on
 * every screen. The position is only present while the ride is live, that
 * is ASSIGNED, ON_THE_WAY, AT_PICKUP or ONGOING, and the hook polls only
 * then.
 *
 * The write is `setDriverLocation`, and the rules are the decided ones: only
 * while the driver has a ride in one of those four states, at most every
 * fifteen seconds, and only when the phone moved more than twenty five
 * metres or a minute passed. Sharing is on unless the driver switched it off
 * on the Me page, the switch is persisted in localStorage under
 * `limosen:shareLocationEnabled`. Nothing is ever sent that the device did
 * not measure: if geolocation fails there is a reason and no send. See
 * okf/architecture/location-tracking.md.
 *
 * The sender is one engine per tab, not one per mounted hook. Every
 * `useDriverPositionSender()` subscribes to the same status, so the Me page
 * and the driver's ride screen can both be mounted and there is still one
 * GPS watch and one send loop. The integrator mounts `DriverPositionSender`
 * once in the shell and that is enough for the loop to run on every screen.
 *
 * The reads are queries of the one client in ./query.ts: `['tracking',
 * transferId]`, polled by the client while the ride is live, `['geocode',
 * address]` and `['driverColors', ids]` (colors.ts). See okf/architecture/data-layer.md.
 */
import {useCallback, useEffect, useState} from 'react'
import {useCaller} from '../auth'
import {isOnline} from '../offline'
import {gql} from './bookings'
import {keys, useAppQuery} from './query'
import {readPosition, readReason, type GeoPosition, type GeolocationReason} from './use-geolocation'

// --------------- The live states ---------------

/** The states in which a driver is on the job and their position matters. */
export const TRACKED_STATES = ['ASSIGNED', 'ON_THE_WAY', 'AT_PICKUP', 'ONGOING'] as const

export const isTracked = (state: string | null | undefined): boolean =>
  (TRACKED_STATES as readonly string[]).includes(String(state ?? '').toUpperCase())

// --------------- The read ---------------

export interface TrackingDriver {
  id: string
  name: string
  /** The driver's own hex, silver when they never chose. */
  color?: string | null
}

export interface TrackingCar {
  licensePlate?: string | null
  carName?: string | null
  carClass?: string | null
  color?: string | null
}

export interface TrackingLocation {
  lat: number
  lng: number
  accuracy?: number | null
  /** ISO, the device clock at the fix. */
  recordedAt?: string | null
}

export interface TransferTracking {
  transferId: string
  state: string
  pickupDateTime?: string | null
  pickupLocation?: string | null
  driver: TrackingDriver | null
  car: TrackingCar | null
  /** Present only while the state is one of TRACKED_STATES. */
  location: TrackingLocation | null
}

const TRACKING_SELECTION =
  '{ transferId state pickupDateTime pickupLocation ' +
  'driver { id name color } ' +
  'car { licensePlate carName carClass color } ' +
  'location { lat lng accuracy recordedAt } }'

const text = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim().length ? v : undefined

const number = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined

export const mapTracking = (node: any): TransferTracking | null => {
  if (!node) return null
  const location = node.location
  const lat = number(location?.lat)
  const lng = number(location?.lng)
  return {
    transferId: String(node.transferId ?? ''),
    state: String(node.state ?? ''),
    pickupDateTime: text(node.pickupDateTime) ?? null,
    pickupLocation: text(node.pickupLocation) ?? null,
    driver: node.driver
      ? {
          id: String(node.driver.id ?? ''),
          name: text(node.driver.name) ?? '',
          color: text(node.driver.color) ?? null
        }
      : null,
    car: node.car
      ? {
          licensePlate: text(node.car.licensePlate) ?? null,
          carName: text(node.car.carName) ?? null,
          carClass: text(node.car.carClass) ?? null,
          color: text(node.car.color) ?? null
        }
      : null,
    location:
      lat !== undefined && lng !== undefined
        ? {
            lat,
            lng,
            accuracy: number(location?.accuracy) ?? null,
            recordedAt: text(location?.recordedAt) ?? null
          }
        : null
  }
}

export const fetchTransferTracking = async (transferId: string): Promise<TransferTracking | null> =>
  mapTracking(await gql('transferTracking', {args: {transferId}}, TRACKING_SELECTION))

/** True when the deployed schema has no transferTracking field yet. */
const isMissingField = (err: unknown): boolean =>
  err instanceof Error && /Cannot query field "transferTracking"/.test(err.message)

export const DEFAULT_TRACKING_POLL_MS = 10_000

export interface UseTransferTrackingOptions {
  /** False holds the read back entirely, for a screen that knows there is nothing to track. */
  enabled?: boolean
}

/**
 * One transfer's tracking, polled every `pollMs` while the ride is live and
 * the tab is visible, read once and left alone otherwise. The client does
 * the polling: `refetchInterval` while live, paused while the tab is hidden,
 * and a read at once when the tab comes back, because the read is never
 * fresh.
 */
export function useTransferTracking(
  transferId: string | undefined,
  pollMs: number = DEFAULT_TRACKING_POLL_MS,
  options: UseTransferTrackingOptions = {}
) {
  const enabled = options.enabled ?? true
  const id = transferId ?? ''

  const {query: q, isLoading, error: message, refetch} = useAppQuery({
    queryKey: keys.tracking(id),
    queryFn: () => fetchTransferTracking(id),
    enabled: !!transferId && enabled,
    refetchInterval: query => {
      const held = query.state.data
      return held && isTracked(held.state) && !!transferId && enabled ? Math.max(2_000, pollMs) : false
    },
    refetchIntervalInBackground: false
  })

  const tracking = q.data ?? null
  /** The deployment does not know the field. Nothing to poll. */
  const unavailable = isMissingField(q.error)
  const error = unavailable ? null : message
  const fetchedAt = q.dataUpdatedAt || null
  const live = !!tracking && isTracked(tracking.state) && !unavailable && enabled

  return {tracking, isLoading, error, unavailable, fetchedAt, live, refetch}
}

// --------------- Geocoding the pickup ---------------

export interface LngLat {
  lng: number
  lat: number
}

/**
 * The pickup address as a point, through Mapbox's forward geocoder with the
 * same public token the map uses. Vienna is the proximity hint, the fleet's
 * home, so "Stephansplatz" finds the one in Vienna. Null when nothing was
 * found or the token is empty, and the caller draws the map without a pin.
 * The same address is one query `['geocode', address]` of the client, asked
 * once and kept.
 */
export const geocodeAddress = async (address: string, token: string): Promise<LngLat | null> => {
  const key = address.trim().toLowerCase()
  if (!key || !token) return null
  const url =
    'https://api.mapbox.com/search/geocode/v6/forward' +
    `?q=${encodeURIComponent(address.trim())}` +
    '&limit=1&proximity=16.3738,48.2082' +
    `&access_token=${encodeURIComponent(token)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Geocoding answered ${res.status}`)
  const body: any = await res.json()
  const coords = body?.features?.[0]?.geometry?.coordinates
  const lng = number(coords?.[0])
  const lat = number(coords?.[1])
  return lng !== undefined && lat !== undefined ? {lng, lat} : null
}

export function useGeocode(address: string | null | undefined, token: string) {
  const key = (address ?? '').trim().toLowerCase()
  const {query: q, isLoading, error} = useAppQuery({
    queryKey: keys.geocode(key),
    queryFn: () => geocodeAddress(address ?? '', token),
    enabled: !!key && !!token
  })
  return {point: q.data ?? null, error, isLoading}
}

// --------------- Driver colours for the dispatcher's map ---------------

/**
 * The colours of the drivers on the map, by user id, one query for the
 * whole list (`['driverColors', ids]`, see ./colors.ts), no colour for the
 * silver default and for any failure, and the map draws those grey: see
 * markerColorFor in components/locations/mapbox-token. Lives in colors.ts
 * with the other readers, re-exported here for the map's import.
 */
export {useDriverColors} from './colors'

// --------------- The driver's sender ---------------

export const SHARE_LOCATION_KEY = 'limosen:shareLocationEnabled'

/** On unless the driver switched it off. Absent is on, that is the opt-out. */
export const readShareEnabled = (): boolean => {
  try {
    return window.localStorage.getItem(SHARE_LOCATION_KEY) !== 'false'
  } catch {
    return true
  }
}

export const writeShareEnabled = (on: boolean) => {
  try {
    window.localStorage.setItem(SHARE_LOCATION_KEY, on ? 'true' : 'false')
  } catch {
    // Private mode or a full quota: the switch still works for this visit.
  }
}

/** The decided limits. */
export const SEND_MIN_INTERVAL_MS = 15_000
export const SEND_MIN_DISTANCE_M = 25
export const SEND_MAX_SILENCE_MS = 60_000
/** How often the phone asks the backend whether it still has a live ride. */
export const RIDE_CHECK_INTERVAL_MS = 60_000

export interface SenderStatus {
  /** navigator.geolocation exists. */
  supported: boolean
  /** The switch on the Me page. */
  enabled: boolean
  /** The caller holds the driver role, from useCaller. */
  isDriver: boolean
  /** A ride in one of TRACKED_STATES was found at the last check. */
  active: boolean
  activeTransferId?: string
  activeState?: string
  /** The GPS watch is running: driver, enabled and active. */
  running: boolean
  /** The last fix the device gave, sent or not. */
  lastFix?: GeoPosition
  lastSentAt?: number
  sending: boolean
  /** Why no position is coming, or null. */
  reason: GeolocationReason | null
  /** The backend's answer to the last failed send, or null. */
  sendError: string | null
  /** The last ride check failed with this message. */
  checkError: string | null
  /** When the ride was last checked, epoch milliseconds. */
  checkedAt?: number
}

const initialStatus = (): SenderStatus => ({
  supported: typeof navigator !== 'undefined' && !!navigator.geolocation,
  enabled: typeof window !== 'undefined' ? readShareEnabled() : true,
  isDriver: false,
  active: false,
  running: false,
  sending: false,
  reason: null,
  sendError: null,
  checkError: null
})

/** Metres between two fixes, haversine. */
export const distanceMetres = (a: {latitude: number; longitude: number}, b: {latitude: number; longitude: number}): number => {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

/**
 * Whether a fix is worth sending now. The first one always is. After that,
 * never within fifteen seconds of the last send, and then only when the
 * phone moved more than twenty five metres or a minute has passed.
 */
export const shouldSend = (
  fix: GeoPosition,
  last: {at: number; fix: GeoPosition} | undefined,
  now: number
): boolean => {
  if (!last) return true
  const since = now - last.at
  if (since < SEND_MIN_INTERVAL_MS) return false
  if (distanceMetres(last.fix, fix) > SEND_MIN_DISTANCE_M) return true
  return since >= SEND_MAX_SILENCE_MS
}

const sendPosition = async (fix: GeoPosition): Promise<void> => {
  const args: Record<string, unknown> = {
    latitude: fix.latitude,
    longitude: fix.longitude,
    accuracy: fix.accuracy,
    heading: fix.heading,
    speed: fix.speed,
    recordedAtISO: new Date(fix.timestamp).toISOString()
  }
  await gql('setDriverLocation', {args}, '{ id updatedAt }', 'mutation')
}

/**
 * The driver's live ride, if any: the newest transfer in a tracked state.
 * The read is scoped by the token, a driver only ever sees their own rows,
 * so no driverId is sent. Rides older than a day and a half are not looked
 * at, a ride ONGOING for longer than that is a row somebody forgot.
 */
const findActiveRide = async (driverId: string | undefined): Promise<{id: string; state: string} | null> => {
  const fromISO = new Date(Date.now() - 36 * 3_600_000).toISOString()
  const result = await gql(
    'transfers',
    {args: {first: 100, fromISO}},
    '{ edges { node { id state driverId pickupDateTime } } }'
  )
  const rows: Array<{id: string; state: string; pickupDateTime?: string}> = (
    Array.isArray(result?.edges) ? result.edges : []
  )
    .map((e: any) => e?.node)
    // The scope already limits a driver to their own rows. A dispatcher who
    // also drives reads everything, and only their own ride counts here.
    .filter((n: any) => n && isTracked(n.state) && (!driverId || n.driverId === driverId))
    .map((n: any) => ({id: String(n.id), state: String(n.state), pickupDateTime: text(n.pickupDateTime)}))
  if (rows.length === 0) return null
  // The one that is furthest along wins, then the earliest pickup.
  const rank = (s: string) => (TRACKED_STATES as readonly string[]).indexOf(s)
  rows.sort((a, b) => rank(b.state) - rank(a.state) || String(a.pickupDateTime).localeCompare(String(b.pickupDateTime)))
  const first = rows[0]
  return first ? {id: first.id, state: first.state} : null
}

/**
 * One engine per tab. It holds the status every subscriber renders, the
 * ride check, the GPS watch and the send loop, and it runs only while at
 * least one hook is mounted and the caller is a driver.
 */
class SenderEngine {
  status: SenderStatus = initialStatus()
  private listeners = new Set<(s: SenderStatus) => void>()
  private subscribers = 0
  private checkTimer: number | undefined
  private tickTimer: number | undefined
  private watchId: number | undefined
  private last: {at: number; fix: GeoPosition} | undefined
  private inFlight = false
  private checking = false

  subscribe(listener: (s: SenderStatus) => void): () => void {
    this.listeners.add(listener)
    this.subscribers += 1
    this.reconcile()
    return () => {
      this.listeners.delete(listener)
      this.subscribers -= 1
      this.reconcile()
    }
  }

  private set(patch: Partial<SenderStatus>) {
    this.status = {...this.status, ...patch}
    this.listeners.forEach(l => l(this.status))
  }

  private driverId: string | undefined

  setDriver(isDriver: boolean, driverId: string | undefined) {
    if (this.status.isDriver === isDriver && this.driverId === driverId) return
    this.driverId = driverId
    this.set({isDriver})
    this.reconcile()
  }

  setEnabled(enabled: boolean) {
    writeShareEnabled(enabled)
    this.set({enabled, sendError: null, reason: null})
    this.reconcile()
  }

  /**
   * A screen that knows the ride's state says so, and the engine does not
   * wait for the next check. The driver's slider calls this on every stop.
   */
  hint(transferId: string, state: string) {
    if (isTracked(state)) {
      this.set({active: true, activeTransferId: transferId, activeState: state, checkedAt: Date.now()})
    } else if (this.status.activeTransferId === transferId) {
      this.set({active: false, activeTransferId: undefined, activeState: undefined, checkedAt: Date.now()})
    }
    this.reconcile()
  }

  /** Ask the backend now whether there is a live ride. */
  async recheck(): Promise<void> {
    if (this.checking || !this.status.isDriver) return
    this.checking = true
    try {
      const ride = await findActiveRide(this.driverId)
      this.set({
        active: !!ride,
        activeTransferId: ride?.id,
        activeState: ride?.state,
        checkError: null,
        checkedAt: Date.now()
      })
    } catch (err) {
      // The ride stays what it was: a failed check must not stop a live
      // send loop over a flaky connection, and must not start one either.
      this.set({checkError: err instanceof Error ? err.message : String(err), checkedAt: Date.now()})
    } finally {
      this.checking = false
      this.reconcile()
    }
  }

  private reconcile() {
    const wantChecks = this.subscribers > 0 && this.status.isDriver && this.status.enabled
    if (wantChecks && this.checkTimer === undefined) {
      void this.recheck()
      this.checkTimer = window.setInterval(() => void this.recheck(), RIDE_CHECK_INTERVAL_MS)
    } else if (!wantChecks && this.checkTimer !== undefined) {
      window.clearInterval(this.checkTimer)
      this.checkTimer = undefined
    }

    const wantWatch = wantChecks && this.status.active && this.status.supported
    if (wantWatch && this.watchId === undefined) this.startWatch()
    else if (!wantWatch && this.watchId !== undefined) this.stopWatch()

    if (wantChecks && !this.status.supported && this.status.reason !== 'unsupported') {
      this.set({reason: 'unsupported'})
    }
    if (this.status.running !== wantWatch) this.set({running: wantWatch})
  }

  private startWatch() {
    this.watchId = navigator.geolocation.watchPosition(
      pos => {
        const fix = readPosition(pos)
        this.set({lastFix: fix, reason: null})
        this.consider(fix)
      },
      err => {
        // Nothing is sent in place of a fix. The reason is shown on the Me
        // page in the driver's language, the browser's text is not.
        this.set({reason: readReason(err)})
      },
      {enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000}
    )
    // A phone that does not move gets no new fix from watchPosition, and a
    // minute of silence still owes the office one position. The tick asks
    // the device for a fresh fix then, and sends that, never the old one.
    this.tickTimer = window.setInterval(() => this.tick(), 5_000)
  }

  private stopWatch() {
    if (this.watchId !== undefined) navigator.geolocation.clearWatch(this.watchId)
    if (this.tickTimer !== undefined) window.clearInterval(this.tickTimer)
    this.watchId = undefined
    this.tickTimer = undefined
    this.last = undefined
  }

  private tick() {
    const last = this.last
    if (!last || this.inFlight) return
    if (Date.now() - last.at < SEND_MAX_SILENCE_MS) return
    navigator.geolocation.getCurrentPosition(
      pos => {
        const fix = readPosition(pos)
        this.set({lastFix: fix, reason: null})
        this.consider(fix)
      },
      err => this.set({reason: readReason(err)}),
      {enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000}
    )
  }

  private consider(fix: GeoPosition) {
    if (this.watchId === undefined || this.inFlight) return
    // Without a connection nothing is sent and nothing is queued: a position
    // is only ever the one the device measured just now, see offline.md.
    if (!isOnline()) return
    const now = Date.now()
    if (!shouldSend(fix, this.last, now)) return
    this.inFlight = true
    this.set({sending: true})
    sendPosition(fix)
      .then(() => {
        this.last = {at: Date.now(), fix}
        this.set({lastSentAt: this.last.at, sendError: null})
      })
      .catch((err: unknown) => {
        // The send failed and the fix is dropped. The next fix tries again,
        // and the minimum interval still applies from the last success.
        this.set({sendError: err instanceof Error ? err.message : String(err)})
      })
      .finally(() => {
        this.inFlight = false
        this.set({sending: false})
      })
  }
}

let engine: SenderEngine | undefined

const getEngine = (): SenderEngine => {
  if (!engine) engine = new SenderEngine()
  return engine
}

export interface UseDriverPositionSenderOptions {
  /** A ride this screen is showing, so the loop starts without waiting for the check. */
  ride?: {transferId: string; state: string}
}

/**
 * The driver's sender, as a React value. Every mount shares one engine, see
 * the file comment. For anybody who is not a driver it renders the idle
 * status and starts nothing.
 */
export function useDriverPositionSender(options: UseDriverPositionSenderOptions = {}) {
  const caller = useCaller()
  const [status, setStatus] = useState<SenderStatus>(() =>
    typeof window === 'undefined' ? initialStatus() : getEngine().status
  )

  useEffect(() => {
    const e = getEngine()
    setStatus(e.status)
    return e.subscribe(setStatus)
  }, [])

  useEffect(() => {
    if (caller.loading) return
    getEngine().setDriver(caller.isDriver, caller.userId)
  }, [caller.loading, caller.isDriver, caller.userId])

  const rideId = options.ride?.transferId
  const rideState = options.ride?.state
  useEffect(() => {
    if (rideId && rideState) getEngine().hint(rideId, rideState)
  }, [rideId, rideState])

  const setEnabled = useCallback((on: boolean) => getEngine().setEnabled(on), [])
  const recheck = useCallback(() => getEngine().recheck(), [])

  return {...status, setEnabled, recheck}
}

/**
 * Renders nothing, runs the loop. The integrator mounts this once inside the
 * shell for every /app page so a driver's phone sends while they are on any
 * screen, not only on the Me page.
 */
export function DriverPositionSender(): null {
  useDriverPositionSender()
  return null
}
