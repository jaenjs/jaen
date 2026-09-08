/**
 * The address of a request, as the app reads what the pylon worked out.
 * okf/architecture/dispatch.md section 14.2.
 *
 * A ride carries free text, "Hotel Sacher", "Flughafen", "vor dem
 * Haupteingang", and the pylon resolves it once, at creation and whenever it
 * changes: the geocoder first, and a language model where that answers
 * nothing or answers ambiguously. What the row then carries is a canonical
 * address, a pair of coordinates and how it got there, and the text the
 * dispatcher typed stays exactly as it was typed.
 *
 * Everything here is pure, so the board, the detail, the maps and the papers
 * read one rule rather than four spellings of it.
 */

/** How sure the pylon is about the address behind the free text. */
export type AddressResolution = 'RESOLVED' | 'GUESSED' | 'UNRESOLVED'

/** Who worked it out. */
export type AddressSource = 'GEOCODER' | 'MODEL' | 'DISPATCHER'

/** The two sides of a ride, as the mutation names them. */
export type AddressSide = 'PICKUP' | 'DROPOFF'

/** One side of one ride, flattened out of the row. */
export interface ResolvedAddress {
  side: AddressSide
  /** What the dispatcher typed. Shown wherever the address is shown. */
  text: string
  /** What the pylon made of it, undefined while nothing was made of it. */
  address?: string
  lat?: number | null
  lng?: number | null
  resolution?: AddressResolution
  resolvedBy?: string
}

/** The shape this module needs of a transfer row, so it depends on no hook. */
export interface AddressBearing {
  pickup?: string
  dropoff?: string
  pickupAddress?: string
  pickupLat?: number | null
  pickupLng?: number | null
  pickupResolution?: string
  pickupResolvedBy?: string
  dropoffAddress?: string
  dropoffLat?: number | null
  dropoffLng?: number | null
  dropoffResolution?: string
  dropoffResolvedBy?: string
}

export const asResolution = (raw: unknown): AddressResolution | undefined => {
  const value = String(raw ?? '').toUpperCase()
  return value === 'RESOLVED' || value === 'GUESSED' || value === 'UNRESOLVED'
    ? (value as AddressResolution)
    : undefined
}

/**
 * Whether this side is worth a warning. GUESSED and UNRESOLVED are, the
 * owner's sentence: "wenn die Adresse nicht festgestellt werden konnte, dann
 * soll im Transfer eine Warnung aufscheinen". A side nothing has worked out
 * yet (undefined, the seconds between the booking and the resolution, and
 * every row written before the columns existed) draws no warning: an absence
 * is not a doubt, and a board full of warnings on old rides teaches a
 * dispatcher to ignore the one that matters.
 */
export const needsCheck = (resolution?: string | null): boolean => {
  const value = asResolution(resolution)
  return value === 'GUESSED' || value === 'UNRESOLVED'
}

export const addressOf = (
  row: AddressBearing,
  side: AddressSide
): ResolvedAddress =>
  side === 'PICKUP'
    ? {
        side,
        text: row.pickup ?? '',
        address: row.pickupAddress,
        lat: row.pickupLat ?? null,
        lng: row.pickupLng ?? null,
        resolution: asResolution(row.pickupResolution),
        resolvedBy: row.pickupResolvedBy
      }
    : {
        side,
        text: row.dropoff ?? '',
        address: row.dropoffAddress,
        lat: row.dropoffLat ?? null,
        lng: row.dropoffLng ?? null,
        resolution: asResolution(row.dropoffResolution),
        resolvedBy: row.dropoffResolvedBy
      }

/** The sides of one ride that carry a doubt, in reading order. */
export const doubtfulSides = (row: AddressBearing): ResolvedAddress[] =>
  (['PICKUP', 'DROPOFF'] as AddressSide[])
    .map(side => addressOf(row, side))
    .filter(a => a.text.trim().length > 0 && needsCheck(a.resolution))

/** Whether the row draws the warning at all. */
export const hasAddressDoubt = (row: AddressBearing): boolean =>
  doubtfulSides(row).length > 0

/**
 * The point a map draws for one side, or null. This is the whole point of
 * section 14.2 on the reading end: a map that has the pylon's coordinates
 * draws its pin without a geocoder call, and only a side that was never
 * worked out falls back to geocoding the free text the way the app always
 * did. An UNRESOLVED side has no coordinates and is not geocoded again
 * either, because the pylon already tried harder than the map can.
 */
export const storedPoint = (
  row: AddressBearing,
  side: AddressSide
): {lng: number; lat: number} | null => {
  const a = addressOf(row, side)
  const lat = typeof a.lat === 'number' ? a.lat : null
  const lng = typeof a.lng === 'number' ? a.lng : null
  if (lat === null || lng === null) return null
  return {lng, lat}
}

/**
 * The address a paper, a mail or a map link should print for one side: the
 * canonical one where a person or a geocoder stands behind it, the typed
 * text otherwise. A GUESSED address is deliberately NOT printed on a paper:
 * a customer's confirmation must not carry a machine's reading of "vor dem
 * Haupteingang" as though the office had written it.
 */
export const printableAddress = (
  row: AddressBearing,
  side: AddressSide
): string => {
  const a = addressOf(row, side)
  if (a.resolution === 'RESOLVED' && a.address && a.address.trim())
    return a.address.trim()
  return a.text
}

/** The address to offer the dispatcher as the guess, when there is one. */
export const guessFor = (a: ResolvedAddress): string | undefined =>
  a.address && a.address.trim() ? a.address.trim() : undefined
