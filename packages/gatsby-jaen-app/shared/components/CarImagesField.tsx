/**
 * The vehicle form's gallery: upload several pictures at once, order them,
 * mark the cover, remove one.
 *
 * okf/architecture/media.md, "Many pictures per car": the owner asked why a
 * vehicle could only carry one photograph. A car now has as many as the
 * dispatcher uploads, the first one is the cover, and the customer's
 * booking detail and the public ride page draw the whole strip.
 *
 * Every file goes through jaen's own `uploadFile`, the same path the CMS
 * media library uses, so the pictures land in the one library and the app
 * stores nothing but what the gateway answered. The control is
 * `MediaDropzone` from gatsby-plugin-jaen, the one upload control of the
 * estate, here with `maxFiles` above one so a phone can hand over a whole
 * roll in one gesture.
 *
 * The field holds a draft. A picture that is already a row carries its `id`,
 * a fresh upload does not, and the dialog writes the difference on submit
 * (`addCarImages`, `removeCarImage`, `reorderCarImages`), so a form that is
 * abandoned changes nothing.
 *
 * Ordering works twice over on purpose: a pointer drags a tile onto another
 * tile, and the two arrows on every tile move it one place. The arrows are
 * what a touch screen has, and they are also what a keyboard has.
 */
import {useCallback, useRef, useState} from 'react'
import {Badge, Box, Grid, HStack, IconButton, Image, Stack, Text} from '@chakra-ui/react'
import {FaArrowLeft} from '@react-icons/all-files/fa/FaArrowLeft'
import {FaArrowRight} from '@react-icons/all-files/fa/FaArrowRight'
import {FaTrash} from '@react-icons/all-files/fa/FaTrash'
import {uploadFile} from 'jaen'
import {MediaDropzone} from 'gatsby-plugin-jaen'

/**
 * One picture of the draft. `id` is the row on the backend, absent while the
 * picture has only been uploaded to the gateway and not yet stored on the car.
 */
export interface CarGalleryItem {
  id?: string
  fileId: string
  url: string
  thumbUrl?: string
  width?: number
  height?: number
}

export interface CarImagesFieldProps {
  value: CarGalleryItem[]
  onChange: (value: CarGalleryItem[]) => void
  disabled?: boolean
  strings: {
    ImagesUpload: string
    ImagesHint: string
    ImagesUploading: string
    ImagesTooMany: string
    ImageFailed: string
    ImageNotAnImage: string
    ImageRemove: string
    GalleryCover: string
    GalleryEmpty: string
    GalleryEarlier: string
    GalleryLater: string
  }
  /** Told what went wrong, so the dialog shows it where it shows its other failures. */
  onFailure?: (message: string) => void
}

/** 8 MB per file. A photograph from a phone fits, a raw file does not belong here. */
export const MAX_CAR_IMAGE_BYTES = 8 * 1024 * 1024

/** The backend refuses more, so the form refuses them before the upload. */
export const MAX_CAR_IMAGES = 24

const ACCEPT = 'image/png,image/jpeg,image/webp'

/**
 * The picture's own pixels, read from the file before it is sent. A browser
 * that cannot decode the file answers nothing rather than failing the
 * upload: the dimensions are decoration, the file id and the URL are the
 * picture.
 */
const measure = (file: File): Promise<{width: number; height: number} | null> =>
  new Promise(resolve => {
    if (typeof window === 'undefined' || typeof window.Image === 'undefined') {
      resolve(null)
      return
    }
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      const size = {width: img.naturalWidth, height: img.naturalHeight}
      URL.revokeObjectURL(url)
      resolve(size.width > 0 && size.height > 0 ? size : null)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })

const move = <T,>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length || from === to) return list
  if (from < 0 || from >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  if (item === undefined) return list
  next.splice(to, 0, item)
  return next
}

export function CarImagesField({
  value,
  onChange,
  disabled,
  strings: s,
  onFailure
}: CarImagesFieldProps) {
  const [busy, setBusy] = useState(false)
  const dragging = useRef<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  const upload = useCallback(
    async (files: File[]) => {
      const room = MAX_CAR_IMAGES - value.length
      if (room <= 0) {
        onFailure?.(s.ImagesTooMany)
        return
      }
      const taken = files.slice(0, room)
      if (taken.length < files.length) onFailure?.(s.ImagesTooMany)

      setBusy(true)
      const added: CarGalleryItem[] = []
      try {
        // One after another rather than all at once: the gateway is a single
        // upload endpoint and a phone's roll of ten would otherwise open ten
        // connections at the same time.
        for (const file of taken) {
          const size = await measure(file)
          const answer = await uploadFile(file, file.name)
          const fileId = String(answer?.data?.file_id ?? '')
          const url = String(answer?.fileUrl ?? '')
          if (!fileId || !url) throw new Error(s.ImageFailed)
          added.push({
            fileId,
            url,
            // A gateway that stored no thumbnail answers none, and the full
            // file is then what a list shows. The backend takes the absence.
            thumbUrl: String(answer?.fileThumbUrl ?? '') || undefined,
            width: size?.width,
            height: size?.height
          })
        }
      } catch (error) {
        // The dialog shows this beside its other failures. Swallowing it
        // would leave the form looking as if the pictures had been taken.
        onFailure?.(error instanceof Error ? error.message : s.ImageFailed)
      } finally {
        setBusy(false)
        // Whatever did arrive is kept: an upload that failed on the fourth
        // file must not throw the first three away.
        if (added.length) onChange([...value, ...added])
      }
    },
    [onChange, onFailure, s.ImageFailed, s.ImagesTooMany, value]
  )

  const drop = (to: number) => {
    const from = dragging.current
    dragging.current = null
    setOver(null)
    if (from === null) return
    onChange(move(value, from, to))
  }

  return (
    <Stack gap="3" data-testid="car-images-field" data-car-pictures={value.length}>
      {value.length === 0 ? (
        <Text textStyle="sm" color="fg.muted">
          {s.GalleryEmpty}
        </Text>
      ) : (
        <Grid templateColumns={{base: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)'}} gap="3">
          {value.map((image, index) => (
            <Box
              key={image.id ?? image.fileId}
              data-testid="car-image-tile"
              data-cover={index === 0 ? 'true' : undefined}
              draggable={!disabled}
              onDragStart={() => {
                dragging.current = index
              }}
              onDragOver={event => {
                event.preventDefault()
                setOver(index)
              }}
              onDragLeave={() => setOver(o => (o === index ? null : o))}
              onDrop={event => {
                event.preventDefault()
                drop(index)
              }}
              onDragEnd={() => {
                dragging.current = null
                setOver(null)
              }}
              position="relative"
              rounded="control"
              overflow="hidden"
              borderWidth="1px"
              borderColor={over === index ? 'brand.solid' : 'border.default'}
              bg="bg.muted">
              <Box aspectRatio={4 / 3}>
                <Image
                  src={image.thumbUrl || image.url}
                  alt=""
                  w="full"
                  h="full"
                  objectFit="cover"
                  loading="lazy"
                  draggable={false}
                />
              </Box>

              {index === 0 && (
                <Badge
                  position="absolute"
                  top="1.5"
                  insetStart="1.5"
                  colorPalette="brand"
                  data-testid="car-image-cover">
                  {s.GalleryCover}
                </Badge>
              )}

              <HStack gap="2" p="2" justify="space-between" bg="bg.surface">
                <HStack gap="2">
                  <IconButton
                    size="xs"
                    variant="outline"
                    minW={{base: '44px', md: '8'}}
                    minH={{base: '44px', md: '8'}}
                    aria-label={s.GalleryEarlier}
                    title={s.GalleryEarlier}
                    disabled={disabled || index === 0}
                    onClick={() => onChange(move(value, index, index - 1))}
                    data-testid="car-image-earlier">
                    <FaArrowLeft />
                  </IconButton>
                  <IconButton
                    size="xs"
                    variant="outline"
                    minW={{base: '44px', md: '8'}}
                    minH={{base: '44px', md: '8'}}
                    aria-label={s.GalleryLater}
                    title={s.GalleryLater}
                    disabled={disabled || index === value.length - 1}
                    onClick={() => onChange(move(value, index, index + 1))}
                    data-testid="car-image-later">
                    <FaArrowRight />
                  </IconButton>
                </HStack>
                <IconButton
                  size="xs"
                  variant="outline"
                  colorPalette="red"
                  minW={{base: '44px', md: '8'}}
                  minH={{base: '44px', md: '8'}}
                  aria-label={s.ImageRemove}
                  title={s.ImageRemove}
                  disabled={disabled}
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                  data-testid="car-image-remove">
                  <FaTrash />
                </IconButton>
              </HStack>
            </Box>
          ))}
        </Grid>
      )}

      <MediaDropzone
        accept={ACCEPT}
        maxFiles={MAX_CAR_IMAGES}
        maxFileSize={MAX_CAR_IMAGE_BYTES}
        disabled={disabled}
        uploading={busy}
        minH="24"
        label={s.ImagesUpload}
        hint={s.ImagesHint}
        uploadingLabel={s.ImagesUploading}
        rootTestId="car-image-dropzone"
        onReject={() => onFailure?.(s.ImageNotAnImage)}
        onUpload={files => {
          if (files.length) void upload(files)
        }}
      />
    </Stack>
  )
}
