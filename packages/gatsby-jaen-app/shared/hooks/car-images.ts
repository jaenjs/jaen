/**
 * The fleet's pictures, read for the Fahrzeuge folder of jaen's Media tree
 * (okf/architecture/media.md, "One gallery, jaen's" and "Many pictures per
 * car").
 *
 * A car has a gallery, not a picture: `CarImage` rows ordered by `position`,
 * the first one the cover. This module is the read of that gallery for the
 * media folders. The writes of the vehicle form (adding several files at
 * once, reordering, the cover) live with the fleet; the one write here is
 * `removeCarImage`, because the gallery's delete button is the folder's
 * `onDelete` and has nowhere else to go.
 *
 * The read is its own beside `useFleet` for one reason: `carImages` is new
 * on `Car` and a site is built and deployed before the pylon that carries
 * it, so a query that asks for a field the deployed schema does not have
 * would fail the whole read and empty the folder. The read asks for it
 * once, and a schema that refuses it is answered with the plain car fields
 * and no pictures, which is exactly what the folder shows for a fleet
 * nobody has photographed yet.
 *
 * The key sits under `['fleet', ...]`, so the fleet screen's own
 * invalidation after a car write reaches this list too and the tree never
 * shows a picture the fleet has already replaced.
 */
import {queryClient, useAppQuery} from './query'
import {gql, mutate} from './users'
import {isUnknownField} from './offers'

/** One picture of a car. The field names are the contract of media.md. */
export interface CarImage {
  /** `carimage:<uuid>`, the id removeCarImage takes. */
  id: string
  /** What the storage gateway answered for the file. */
  fileId: string
  /** The full file on the gateway, public and permanent. */
  url: string
  /** The gateway's thumbnail where the driver gives one. */
  thumbUrl?: string
  width?: number
  height?: number
  /** Ascending, the first one the cover. */
  position: number
  createdAt: string
}

/** What the folder needs of a car. */
export interface CarWithImages {
  id: string
  licensePlate: string
  carName?: string
  carClass?: string
  images: CarImage[]
}

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length ? v : undefined

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined

export const mapCarImage = (node: any, index: number): CarImage => ({
  id: String(node?.id ?? ''),
  fileId: str(node?.fileId) ?? '',
  url: str(node?.url) ?? '',
  thumbUrl: str(node?.thumbUrl),
  width: num(node?.width),
  height: num(node?.height),
  position: num(node?.position) ?? index,
  createdAt: str(node?.createdAt) ?? ''
})

const mapCar = (node: any): CarWithImages => ({
  id: String(node?.id ?? ''),
  licensePlate: String(node?.licensePlate ?? ''),
  carName: str(node?.carName),
  carClass: str(node?.carClass),
  images: (Array.isArray(node?.carImages) ? node.carImages : [])
    .map(mapCarImage)
    .filter((image: CarImage) => image.id && image.url)
    .sort((a: CarImage, b: CarImage) => a.position - b.position)
})

const BASE_FIELDS = 'id licensePlate carName carClass'
const IMAGE_FIELDS =
  'carImages { id fileId url thumbUrl width height position createdAt }'

const EMPTY: CarWithImages[] = []

const readCars = async (fields: string): Promise<CarWithImages[]> => {
  const conn = await gql(
    'cars',
    {args: {first: 100}},
    `{ edges { node { ${fields} } } }`
  )
  return (Array.isArray(conn?.edges) ? conn.edges : [])
    .map((e: any) => e?.node)
    .filter(Boolean)
    .map(mapCar)
}

const readCarImages = async (): Promise<CarWithImages[]> => {
  let rows: CarWithImages[]
  try {
    rows = await readCars(`${BASE_FIELDS} ${IMAGE_FIELDS}`)
  } catch (err) {
    // The pylon from before a car carried a gallery. The fleet is listed
    // without pictures rather than the folder failing, and this is the one
    // thing the catch hides, see okf/decisions/hard-rules.md on swallowing.
    if (!isUnknownField(err)) throw err
    rows = await readCars(BASE_FIELDS)
  }
  rows.sort((a, b) => a.licensePlate.localeCompare(b.licensePlate))
  return rows
}

export interface CarImagesArgs {
  /** False for a caller who may not read the fleet, a driver or a customer. */
  enabled?: boolean
}

export function useCarImages(args: CarImagesArgs = {}) {
  const {
    query: q,
    isLoading,
    error,
    isFetching,
    refetch
  } = useAppQuery({
    queryKey: ['fleet', 'images'] as const,
    queryFn: readCarImages,
    enabled: args.enabled !== false
  })

  const cars = q.data ?? EMPTY

  return {cars, isLoading, error, isFetching, refetch}
}

/**
 * Takes one picture off a car. A pylon that does not know the mutation says
 * so, and the gallery shows the refusal rather than pretending the picture
 * is gone.
 */
export async function removeCarImage(imageId: string): Promise<void> {
  await mutate('removeCarImage', {args: {id: imageId}}, '{ __typename id }')
  // The fleet screen, its pickers and this read all sit under ['fleet'],
  // and a transfer row carries the car, so both are a picture behind.
  await Promise.all(
    [['fleet'], ['transfers']].map(queryKey =>
      queryClient.invalidateQueries({queryKey})
    )
  )
}
