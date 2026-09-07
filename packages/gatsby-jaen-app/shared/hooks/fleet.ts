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
import {hasCarField} from './transfers'

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
  /**
   * The car's gallery on the storage gateway, in its order, the first one
   * the cover (okf/architecture/media.md, "Many pictures per car"). Empty
   * for a car nobody has photographed, which shows the silhouette of its
   * class instead.
   */
  images: CarPicture[]
  /**
   * The cover's own values, which the backend answers from the first
   * picture. Every place that fits one picture reads these.
   */
  imageFileId?: string
  imageUrl?: string
  imageThumbUrl?: string
  imageWidth?: number
  imageHeight?: number
}

/** One picture of a car, as the fleet reads it back. */
export interface CarPicture {
  id: string
  fileId: string
  url: string
  /** The gateway's thumbnail, or the full file where it made none. */
  thumbUrl: string
  width?: number
  height?: number
}

const mapPicture = (n: any): CarPicture => ({
  id: String(n?.id ?? ''),
  fileId: String(n?.fileId ?? ''),
  url: String(n?.url ?? ''),
  thumbUrl: String(n?.thumbUrl ?? '') || String(n?.url ?? ''),
  width: typeof n?.width === 'number' ? n.width : undefined,
  height: typeof n?.height === 'number' ? n.height : undefined
})

const NO_PICTURES: CarPicture[] = []

const mapCar = (n: any): FleetCar => ({
  id: String(n?.id ?? ''),
  licensePlate: String(n?.licensePlate ?? ''),
  carName: n?.carName ?? undefined,
  carClass: asCarClass(n?.carClass),
  color: typeof n?.color === 'string' && n.color ? n.color : '#000000',
  driverId: n?.driverId ?? undefined,
  driverName: n?.driverName ?? undefined,
  updatedAt: n?.updatedAt ?? undefined,
  images: Array.isArray(n?.carImages) ? n.carImages.map(mapPicture) : NO_PICTURES,
  imageFileId: n?.imageFileId ?? undefined,
  imageUrl: n?.imageUrl ?? undefined,
  imageThumbUrl: n?.imageThumbUrl ?? undefined,
  imageWidth: typeof n?.imageWidth === 'number' ? n.imageWidth : undefined,
  imageHeight: typeof n?.imageHeight === 'number' ? n.imageHeight : undefined
})

const EMPTY_CARS: FleetCar[] = []

const readFleet = async (): Promise<FleetCar[]> => {
  const conn = await gql(
    'cars',
    {args: {first: 100}},
    '{ edges { node { id licensePlate carName carClass color driverId driverName updatedAt ' +
      // A site is built and deployed before the pylon that carries the
      // gallery, so the fields are asked for only where the schema has
      // them. A fleet read that fails outright would blank the screen.
      `${(await hasCarField('carImages')) ? 'carImages { id fileId url thumbUrl width height } ' : ''}` +
      `${(await hasCarField('imageThumbUrl')) ? 'imageFileId imageUrl imageThumbUrl imageWidth imageHeight ' : ''}} } }`
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

/**
 * The fleet and the pickers under its key, the transfer lists that show a
 * car, and the bookings, whose "Ihr Fahrzeug" card draws the same gallery.
 */
const invalidateFleet = async () => {
  await Promise.all(
    [['fleet'], ['transfers'], ['bookings']].map(queryKey =>
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

/**
 * `createCar` writes no picture: the backend's create takes the plate, the
 * name, the class, the colour and the driver, and the pictures are their own
 * rows written by `addCarImagesMutation` afterwards.
 */
export async function createCarMutation(
  input: CarInput
): Promise<string | undefined> {
  const result = await mutate('createCar', {args: carArgs(input)}, CAR_SELECTION)
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

/** The picture the gateway answered, as `addCarImages` takes it. */
export interface NewCarPicture {
  fileId: string
  url: string
  /** The gateway's thumbnail, absent where it made none. */
  thumbUrl?: string
  width?: number
  height?: number
}

const GALLERY_SELECTION =
  '{ __typename id carImages { id fileId url thumbUrl width height } }'

const readGallery = (car: any): CarPicture[] =>
  Array.isArray(car?.carImages) ? car.carImages.map(mapPicture) : NO_PICTURES

/**
 * `addCarImages(args:{carId, images})`. The pictures the vehicle form has
 * just uploaded to the storage gateway, appended in the order they were
 * given. The car's whole gallery comes back, which is how the form learns
 * the ids of the rows it has just made and can then order them.
 */
export async function addCarImagesMutation(
  carId: string,
  images: NewCarPicture[]
): Promise<CarPicture[]> {
  const car = await mutate(
    'addCarImages',
    {
      args: {
        carId,
        images: images.map(i => ({
          fileId: i.fileId,
          url: i.url,
          thumbUrl: i.thumbUrl || undefined,
          width: i.width,
          height: i.height
        }))
      }
    },
    GALLERY_SELECTION
  )
  await invalidateFleet()
  return readGallery(car)
}

/**
 * `reorderCarImages(args:{carId, ids})`, the gallery in the order the form
 * dragged it into and the first id the new cover. The backend refuses a
 * list that does not name every picture of the car exactly once, so a form
 * that is a write behind is told rather than half applied.
 */
export async function reorderCarImagesMutation(
  carId: string,
  ids: string[]
): Promise<CarPicture[]> {
  const car = await mutate(
    'reorderCarImages',
    {args: {carId, ids}},
    GALLERY_SELECTION
  )
  await invalidateFleet()
  return readGallery(car)
}

/** `removeCarImage(args:{id})`. One picture goes and the rest close the gap. */
export async function removeCarImageMutation(imageId: string): Promise<void> {
  await mutate('removeCarImage', {args: {id: imageId}}, GALLERY_SELECTION)
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
