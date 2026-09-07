/**
 * The car's gallery as the customer sees it: a swipeable strip, the cover
 * first.
 *
 * okf/architecture/media.md, "Many pictures per car": where one picture
 * fits, the cover is drawn by `CarImage`; where the customer looks at the
 * car, which is the booking detail and the public ride page, the whole
 * gallery is drawn as this strip. It scrolls sideways with the thumb, snaps
 * to a picture, and carries dots under it from the second picture on so the
 * reader knows there is more than one. A car with one picture is one
 * picture and no dots, and a car with none falls back to the silhouette of
 * its class, the same fallback every other screen shows.
 *
 * The strip is the only place in the app that scrolls sideways on purpose,
 * so it keeps its own container and never lets the page scroll with it
 * (`overscrollBehaviorX: contain`).
 */
import {useCallback, useRef, useState} from 'react'
import {Box, HStack, Image} from '@chakra-ui/react'
import {CarImage, type CarPicture, type CarPictureImage} from './CarImage'

export interface CarGalleryProps {
  car: CarPicture | null | undefined
  /** The alt text of every picture, usually the plate. */
  alt?: string
  /** The strip's height. The pictures are cropped to it, 16 by 9 by default. */
  ratio?: number
}

const pictures = (car: CarPicture | null | undefined): CarPictureImage[] => {
  const list = (car?.images ?? []).filter(image => image?.url || image?.thumbUrl)
  if (list.length > 0) return list
  // A read that answered the cover's two URLs only, which is every screen
  // built before the gallery. One picture is still a gallery of one.
  if (car?.imageUrl || car?.imageThumbUrl) {
    return [{url: car.imageUrl ?? null, thumbUrl: car.imageThumbUrl ?? null}]
  }
  return []
}

export function CarGallery({car, alt, ratio = 16 / 9}: CarGalleryProps) {
  const list = pictures(car)
  const strip = useRef<HTMLDivElement | null>(null)
  const [at, setAt] = useState(0)

  const onScroll = useCallback(() => {
    const el = strip.current
    if (!el) return
    const width = el.clientWidth || 1
    setAt(Math.max(0, Math.min(list.length - 1, Math.round(el.scrollLeft / width))))
  }, [list.length])

  // Nothing photographed: the silhouette, in the box the strip would fill.
  if (list.length === 0) {
    return <CarImage car={car} size="banner" full alt={alt ?? ''} />
  }

  return (
    <Box w="full" data-testid="car-gallery" data-car-pictures={list.length}>
      <Box
        ref={strip}
        onScroll={onScroll}
        display="flex"
        overflowX="auto"
        overscrollBehaviorX="contain"
        scrollSnapType="x mandatory"
        rounded="surface"
        borderWidth="1px"
        borderColor="border.default"
        bg="bg.muted"
        css={{
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': {display: 'none'}
        }}>
        {list.map((image, index) => (
          <Box
            key={image.id ?? `${image.url}-${index}`}
            flex="0 0 100%"
            scrollSnapAlign="start"
            aspectRatio={ratio}
            position="relative">
            <Image
              src={image.url ?? image.thumbUrl ?? undefined}
              alt={alt ?? ''}
              w="full"
              h="full"
              objectFit="cover"
              // The cover is what the reader is waiting for, the rest can
              // wait until the strip is swiped.
              loading={index === 0 ? 'eager' : 'lazy'}
              draggable={false}
            />
          </Box>
        ))}
      </Box>

      {list.length > 1 && (
        <HStack gap="2" justify="center" mt="2" aria-hidden data-testid="car-gallery-dots">
          {list.map((image, index) => (
            <Box
              key={image.id ?? `dot-${index}`}
              w="2"
              h="2"
              rounded="full"
              transition="background-color 0.2s"
              bg={index === at ? 'fg.default' : 'border.emphasized'}
            />
          ))}
        </HStack>
      )}
    </Box>
  )
}
