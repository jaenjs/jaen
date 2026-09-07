/**
 * A car's picture, or the silhouette of its class.
 *
 * okf/architecture/media.md: a car keeps its picture on the storage gateway
 * and the row carries the two URLs the upload answered. Everywhere the
 * picture appears (the fleet card and its form, the driver picker, the
 * customer's booking detail and the ride card on the map) it appears through
 * this one component, so a car without a picture always falls back the same
 * way instead of leaving a hole in a layout.
 *
 * The thumbnail is what a list, a picker and a card show; the full file is
 * asked for only where the picture is the point, which today is the vehicle
 * form's preview. Both are public URLs on the gateway, so the browser caches
 * them across screens.
 */
import {Box, Icon, Image} from '@chakra-ui/react'
import {FaCar} from '@react-icons/all-files/fa/FaCar'
import {FaCarAlt} from '@react-icons/all-files/fa/FaCarAlt'
import {FaCarSide} from '@react-icons/all-files/fa/FaCarSide'
import {FaShuttleVan} from '@react-icons/all-files/fa/FaShuttleVan'

/** What this component needs of a car, whichever hook the row came from. */
export interface CarPicture {
  licensePlate?: string | null
  carClass?: string | null
  imageUrl?: string | null
  imageThumbUrl?: string | null
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
  const src = full
    ? (car?.imageUrl ?? car?.imageThumbUrl ?? undefined)
    : (car?.imageThumbUrl ?? car?.imageUrl ?? undefined)
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
