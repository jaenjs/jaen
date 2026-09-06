/**
 * The fleet screen's reads and writes: the cars, and the admin mutations
 * that create, edit and hand a car to a driver.
 *
 * `cars` is admin and driver on the backend, the mutations admin only. A car
 * carries a plate and a driver, which is why the public `fleet` query the
 * booking form reads is a different, plateless field and is not used here.
 *
 * The read is the query `['fleet']` of the one client in ./query.ts, and
 * every mutation invalidates it, the pickers under it and the transfer
 * lists that show a car. See okf/architecture/data-layer.md.
 */
import {keys, queryClient, useAppQuery} from './query'
import {gql, mutate} from './users'

/** The Prisma enum CarClass, one entry each, so a class the backend knows has a word on screen. */
export const CAR_CLASSES = [
  'BUSINESS_CLASS',
  'ELECTRIC_CLASS',
  'FIRST_CLASS',
  'BUSINESS_VAN'
] as const

export type CarClass = (typeof CAR_CLASSES)[number]

export const asCarClass = (value: unknown): CarClass | undefined =>
  CAR_CLASSES.find(c => c === String(value ?? '').toUpperCase())

export interface FleetCar {
  id: string
  licensePlate: string
  carName?: string
  carClass?: CarClass
  /** #RRGGBB */
  color: string
  driverId?: string
  driverName?: string
  updatedAt?: string
}

const mapCar = (n: any): FleetCar => ({
  id: String(n?.id ?? ''),
  licensePlate: String(n?.licensePlate ?? ''),
  carName: n?.carName ?? undefined,
  carClass: asCarClass(n?.carClass),
  color: typeof n?.color === 'string' && n.color ? n.color : '#000000',
  driverId: n?.driverId ?? undefined,
  driverName: n?.driverName ?? undefined,
  updatedAt: n?.updatedAt ?? undefined
})

const EMPTY_CARS: FleetCar[] = []

const readFleet = async (): Promise<FleetCar[]> => {
  const conn = await gql(
    'cars',
    {args: {first: 100}},
    '{ edges { node { id licensePlate carName carClass color driverId driverName updatedAt } } }'
  )
  const rows = (Array.isArray(conn?.edges) ? conn.edges : [])
    .map((e: any) => e?.node)
    .filter(Boolean)
    .map(mapCar)
  rows.sort((a: FleetCar, b: FleetCar) =>
    a.licensePlate.localeCompare(b.licensePlate)
  )
  return rows
}

export function useFleet() {
  const {
    query: q,
    isLoading,
    error,
    isFetching,
    refetch
  } = useAppQuery({
    queryKey: keys.fleet(),
    queryFn: readFleet
  })
  return {cars: q.data ?? EMPTY_CARS, isLoading, error, isFetching, refetch}
}

/** The fleet and the pickers under its key, and the transfer lists that show a car. */
const invalidateFleet = async () => {
  await Promise.all(
    [['fleet'], ['transfers']].map(queryKey =>
      queryClient.invalidateQueries({queryKey})
    )
  )
}

export interface CarInput {
  licensePlate: string
  carName?: string
  carClass?: CarClass
  color: string
  /** A driver's id, null to take the car away from its driver, undefined to leave it alone. */
  driverId?: string | null
}

const CAR_SELECTION = '{ __typename id }'

/**
 * The argument shape the shared decisions fix: createCar(args:{licensePlate,
 * carName, carClass, color, driverId?}). carClass is a String argument on the
 * backend (pylon/src/fleet/cars.ts parses it against the enum), so it is sent
 * quoted, not as a bare enum literal. An empty driverId is how updateCar is
 * told to take the car away from its driver, undefined leaves it alone.
 */
const carArgs = (input: Partial<CarInput>) => ({
  licensePlate: input.licensePlate?.trim() || undefined,
  carName: input.carName?.trim() || undefined,
  carClass: input.carClass ?? undefined,
  color: input.color || undefined,
  driverId: input.driverId === null ? '' : input.driverId || undefined
})

export async function createCarMutation(
  input: CarInput
): Promise<string | undefined> {
  const result = await mutate(
    'createCar',
    {args: carArgs(input)},
    CAR_SELECTION
  )
  await invalidateFleet()
  return typeof result?.id === 'string' ? result.id : undefined
}

/** `updateCar(args:{carId, ...})`. Only the fields given are sent, an absent field is left alone. */
export async function updateCarMutation(
  carId: string,
  input: Partial<CarInput>
): Promise<void> {
  await mutate('updateCar', {args: {carId, ...carArgs(input)}}, CAR_SELECTION)
  await invalidateFleet()
}

/**
 * Handing a car to a driver, or taking it back with `null`.
 * `assignCarToDriver(args:{carId, driverId?})`, without a driverId the car
 * becomes unassigned.
 */
export async function assignCarToDriverMutation(
  carId: string,
  driverId: string | null
): Promise<void> {
  await mutate(
    'assignCarToDriver',
    {args: {carId, driverId: driverId || undefined}},
    CAR_SELECTION
  )
  await invalidateFleet()
}
