/**
 * A car's picture, or the silhouette of its class.
 *
 * okf/architecture/media.md: a car keeps its pictures on the storage gateway
 * as rows of their own, the first one the cover. Everywhere one picture fits
 * (the fleet card and its form, the driver picker, the customer's locations
 * card and the ride card on the map) the cover appears through this one
 * component, so a car without a picture always falls back the same way
 * instead of leaving a hole in a layout. Where the customer looks at the car
 * the whole gallery is drawn instead, by CarGallery beside this.
 *
 * The thumbnail is what a list, a picker and a card show; the full file is
 * asked for only where the picture is the point, which today is the vehicle
 * form's preview.
 *
 * Neither is a public URL any more. The gateway is private
 * (okf/architecture/media.md, "Private storage") and the bytes are drawn
 * through `StorageImage` beside this, with the signed-in person's token where
 * there is one and as the pylon's signed link where there is not. Until the
 * bytes arrive the silhouette stands in, which is the same fallback a car
 * with no picture gets, so a card never holds a broken image.
 */
import {Box, Icon, Image} from '@chakra-ui/react'

import {useStorageSrc} from './StorageImage'
import {FaCar} from '@react-icons/all-files/fa/FaCar'
import {FaCarAlt} from '@react-icons/all-files/fa/FaCarAlt'
import {FaCarSide} from '@react-icons/all-files/fa/FaCarSide'
import {FaShuttleVan} from '@react-icons/all-files/fa/FaShuttleVan'

/** One picture of a car's gallery, whichever hook the row came from. */
export interface CarPictureImage {
  id?: string | null
  url?: string | null
  thumbUrl?: string | null
  width?: number | null
  height?: number | null
}

/** What this component needs of a car, whichever hook the row came from. */
export interface CarPicture {
  licensePlate?: string | null
  carClass?: string | null
  /**
   * The whole gallery in its order, the first one the cover
   * (okf/architecture/media.md, "Many pictures per car"). A read that asks
   * only for the cover's two URLs leaves it absent, and the two fields
   * below are then what is drawn.
   */
  images?: CarPictureImage[] | null
  imageUrl?: string | null
  imageThumbUrl?: string | null
}

/**
 * The cover, the one picture every place that fits one shows: the first of
 * the gallery, or the cover fields a narrower read answered. Both are the
 * same picture, so a screen that has either draws it.
 */
export const carCover = (car: CarPicture | null | undefined): CarPictureImage | null => {
  const first = car?.images?.[0]
  if (first?.url || first?.thumbUrl) return first
  if (car?.imageUrl || car?.imageThumbUrl) {
    return {url: car.imageUrl ?? null, thumbUrl: car.imageThumbUrl ?? null}
  }
  return null
}

/**
 * The silhouette of a class. A van is a van and an electric car has its own
 * outline; the two saloon classes share one, because they are one shape.
 */
const silhouette = (carClass?: string | null) => {
  switch (String(carClass ?? '').toUpperCase()) {
    case 'BUSINESS_VAN':
      return FaShuttleVan
    case 'ELECTRIC_CLASS':
      return FaCarAlt
    case 'BUSINESS_CLASS':
    case 'FIRST_CLASS':
      return FaCarSide
    default:
      return FaCar
  }
}

export interface CarImageProps {
  car: CarPicture | null | undefined
  /**
   * The box the picture fills. A number is a square of that many pixels,
   * "banner" is a full width 16 by 9 strip.
   */
  size?: number | 'banner'
  /** The full file instead of the thumbnail, where the picture is the point. */
  full?: boolean
  /** The alt text, usually the plate. An empty string marks it decorative. */
  alt?: string
}

export function CarImage({car, size = 40, full = false, alt}: CarImageProps) {
  const cover = carCover(car)
  const wanted = full
    ? (cover?.url ?? cover?.thumbUrl ?? undefined)
    : (cover?.thumbUrl ?? cover?.url ?? undefined)
  const src = useStorageSrc(wanted)
  const banner = size === 'banner'
  const Fallback = silhouette(car?.carClass)

  return (
    <Box
      flexShrink={0}
      overflow="hidden"
      rounded={banner ? 'surface' : 'control'}
      borderWidth="1px"
      borderColor="border.default"
      bg="bg.muted"
      position="relative"
      w={banner ? 'full' : `${size}px`}
      h={banner ? undefined : `${size}px`}
      aspectRatio={banner ? 16 / 9 : undefined}
      display="flex"
      alignItems="center"
      justifyContent="center"
      data-car-image={src ? 'picture' : 'silhouette'}>
      {src ? (
        <Image
          src={src}
          alt={alt ?? car?.licensePlate ?? ''}
          w="full"
          h="full"
          objectFit="cover"
          loading="lazy"
          draggable={false}
        />
      ) : (
        <Icon
          as={Fallback}
          color="fg.subtle"
          boxSize={banner ? '10' : `${Math.max(12, Math.round(size * 0.5))}px`}
          aria-hidden
        />
      )}
    </Box>
  )
}
