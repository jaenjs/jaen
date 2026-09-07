/**
 * The fleet's pictures, for the Fahrzeuge source of jaen's Media tab
 * (okf/architecture/media.md, "Sources" and "Where the car's picture
 * appears").
 *
 * This is a read of its own beside `useFleet` for one reason: the two image
 * URLs are new on `Car` and a site is built and deployed before the pylon
 * that carries them, so a query that asks for a field the deployed schema
 * does not have would fail the whole read and blank the tab. The read asks
 * for the image fields once, and a schema that refuses them is answered
 * with the plain car fields and no picture, which is exactly what the tab
 * shows for a fleet nobody has photographed yet. The moment the pylon has
 * them the same code asks for them and gets them.
 *
 * The key sits under `['fleet', ...]`, so the fleet screen's own
 * invalidation after a car write reaches this list too and the tab never
 * shows a picture the fleet has already replaced.
 */
import {useMemo} from 'react'
import {queryClient, useAppQuery} from './query'
import {gql, mutate} from './users'
import {isUnknownField} from './offers'

/** What the source needs of a car. The field names are the contract of media.md. */
export interface CarWithImage {
  id: string
  licensePlate: string
  carName?: string
  carClass?: string
  /** The full file on the storage gateway, public and permanent. */
  imageUrl?: string
  /** The thumbnail, what a list and a picker show. */
  imageThumbUrl?: string
}

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length ? v : undefined

const mapCar = (node: any): CarWithImage => ({
  id: String(node?.id ?? ''),
  licensePlate: String(node?.licensePlate ?? ''),
  carName: str(node?.carName),
  carClass: str(node?.carClass),
  imageUrl: str(node?.imageUrl),
  imageThumbUrl: str(node?.imageThumbUrl)
})

const BASE_FIELDS = 'id licensePlate carName carClass'
const IMAGE_FIELDS = 'imageUrl imageThumbUrl'

const EMPTY: CarWithImage[] = []

const readCars = async (fields: string): Promise<CarWithImage[]> => {
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

const readCarImages = async (): Promise<CarWithImage[]> => {
  let rows: CarWithImage[]
  try {
    rows = await readCars(`${BASE_FIELDS} ${IMAGE_FIELDS}`)
  } catch (err) {
    // The pylon from before a car carried a picture. The fleet is listed
    // without pictures rather than the tab failing, and this is the one
    // thing the catch hides, see okf/decisions/hard-rules.md on swallowing.
    if (!isUnknownField(err)) throw err
    rows = await readCars(BASE_FIELDS)
  }
  rows.sort((a, b) => a.licensePlate.localeCompare(b.licensePlate))
  return rows
}

export function useCarImages() {
  const {
    query: q,
    isLoading,
    error,
    isFetching,
    refetch
  } = useAppQuery({
    queryKey: ['fleet', 'images'] as const,
    queryFn: readCarImages
  })

  const cars = q.data ?? EMPTY
  const withImage = useMemo(
    () => cars.filter(car => car.imageThumbUrl || car.imageUrl),
    [cars]
  )

  return {cars, withImage, isLoading, error, isFetching, refetch}
}

/**
 * Takes the picture off a car: `clearCarImage(args:{carId})` empties the
 * five columns together, and the car falls back to the silhouette of its
 * class. A pylon that does not know the mutation says so, and the source
 * shows the refusal rather than pretending the picture is gone.
 */
export async function clearCarImageMutation(carId: string): Promise<void> {
  await mutate('clearCarImage', {args: {carId}}, '{ __typename id }')
  // The fleet screen, its pickers and this source all sit under ['fleet'],
  // and a transfer row carries the car, so both are a picture behind.
  await Promise.all(
    [['fleet'], ['transfers']].map(queryKey =>
      queryClient.invalidateQueries({queryKey})
    )
  )
}
