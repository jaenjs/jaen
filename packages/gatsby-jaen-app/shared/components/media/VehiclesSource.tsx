/**
 * The Fahrzeuge source of jaen's Media tab: every car of the fleet that has
 * a picture, the plate and the name under it
 * (okf/architecture/media.md, "Sources").
 *
 * A car's picture is a page image in every way that matters: it is uploaded
 * with jaen's `uploadFile` to the storage gateway and the row keeps the two
 * public URLs the gateway answered, `imageThumbUrl` for a list and
 * `imageUrl` for the full file. So this grid shows the thumbnails, and it
 * is the only thing in the Media tab that is a real picture rather than a
 * row of a private store.
 *
 * The read is this source's own query rather than the fleet screen's
 * `useFleet`: the two image fields are read here and nowhere else yet, and
 * a pylon that does not carry them must not break this tab, so the query
 * asks for them once and falls back to the plain car fields when the schema
 * refuses them. When the fleet's own hook grows the fields, this read stays
 * correct and simply asks for what it already knows.
 *
 * Opening a car is the fleet's vehicle form, which is where a picture is
 * uploaded, replaced and removed; remove here clears the picture through
 * `clearCarImage`. Both come in as props from the source registration, see
 * MediaSourceListProps in gatsby-plugin-jaen.
 */
import {useState} from 'react'
import {
  Box,
  Button,
  HStack,
  Icon,
  Image,
  SimpleGrid,
  Skeleton,
  Stack,
  Text
} from '@chakra-ui/react'
import {FaCar} from '@react-icons/all-files/fa/FaCar'
import type {MediaSourceListProps} from 'gatsby-plugin-jaen'
import {useI18nCode} from '../../i18n'
import {fill, getI18nMediaSources} from '../../locales/i18nMediaSources'
import {useCarImages, type CarWithImage} from '../../hooks/car-images'
import {ConfirmDialog} from '../ConfirmDialog'
import {ErrorBanner} from '../ErrorBanner'
import {toaster} from '../toaster'

export function VehiclesSource({onOpen, onRemove}: MediaSourceListProps) {
  const code = useI18nCode()
  const {strings: s} = getI18nMediaSources(code)

  const {cars, withImage, isLoading, error, refetch} = useCarImages()
  const [pending, setPending] = useState<CarWithImage | null>(null)
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    if (!pending) return
    setBusy(true)
    try {
      await onRemove?.(pending.id)
      setPending(null)
      await refetch()
    } catch (err) {
      toaster.error({
        title: s.RemoveImageFailed,
        description: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack gap="4" data-testid="vehicles-source">
      {error && <ErrorBanner title={s.LoadFailed} message={error} />}

      {isLoading ? (
        <SimpleGrid columns={{base: 2, sm: 3, md: 4, lg: 5}} gap="3">
          {Array.from({length: 8}, (_, i) => (
            <Skeleton key={i} h="40" borderRadius="surface" />
          ))}
        </SimpleGrid>
      ) : withImage.length === 0 ? (
        <Stack gap="1" data-testid="vehicles-empty">
          <Text fontWeight="medium">{s.EmptyVehicles}</Text>
          <Text color="fg.muted" textStyle="sm">
            {s.EmptyVehiclesHint}
          </Text>
        </Stack>
      ) : (
        <SimpleGrid columns={{base: 2, sm: 3, md: 4, lg: 5}} gap="3">
          {withImage.map(car => (
            <Stack
              key={car.id}
              gap="2"
              p="3"
              borderWidth="1px"
              borderColor="border.emphasized"
              borderRadius="surface"
              bg="bg.surface"
              data-testid="vehicle-card"
              data-car-id={car.id}>
              <Box
                pos="relative"
                w="full"
                aspectRatio="4 / 3"
                borderRadius="control"
                overflow="hidden"
                bg="bg.muted">
                {car.imageThumbUrl || car.imageUrl ? (
                  <Image
                    src={car.imageThumbUrl || car.imageUrl || ''}
                    alt={car.licensePlate}
                    w="full"
                    h="full"
                    objectFit="cover"
                    data-testid="vehicle-image"
                  />
                ) : (
                  <HStack h="full" justify="center">
                    <Icon color="fg.muted" boxSize="6">
                      <FaCar />
                    </Icon>
                  </HStack>
                )}
              </Box>

              <Stack gap="0.5">
                <Text fontWeight="semibold" truncate>
                  {car.licensePlate}
                </Text>
                <Text textStyle="xs" color="fg.muted" truncate>
                  {car.carName || s.NoImage}
                </Text>
              </Stack>

              <HStack gap="2" flexWrap="wrap">
                <Button
                  size="xs"
                  variant="outline"
                  minH={{base: '44px', md: '8'}}
                  onClick={() => void onOpen?.(car.id)}
                  data-testid="vehicle-open">
                  {s.OpenVehicle}
                </Button>
                {onRemove && (
                  <Button
                    size="xs"
                    variant="outline"
                    colorPalette="red"
                    minH={{base: '44px', md: '8'}}
                    onClick={() => setPending(car)}
                    data-testid="vehicle-remove">
                    {s.Remove}
                  </Button>
                )}
              </HStack>
            </Stack>
          ))}
        </SimpleGrid>
      )}

      {!isLoading && cars.length > 0 && (
        <Text textStyle="xs" color="fg.muted" data-testid="vehicles-count">
          {fill(s.CountVehicles, {
            count: cars.length,
            withImage: withImage.length
          })}
        </Text>
      )}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={remove}
        loading={busy}
        destructive
        title={s.RemoveImageTitle}
        body={fill(s.RemoveImageBody, {plate: pending?.licensePlate ?? ''})}
        confirmLabel={s.Remove}
      />
    </Stack>
  )
}
