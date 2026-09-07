/**
 * The vehicle form's picture: upload, replace, remove.
 *
 * okf/architecture/media.md, "Images go to the gateway": the file goes
 * through jaen's own `uploadFile`, the same path the CMS media library
 * uses, so the picture lands in the one library and the app stores nothing
 * but the ids the gateway answered. The upload answers `file_id`, `url` and
 * `thumbUrl`; the picture's own width and height are measured here in the
 * browser, because the gateway answers dimensions for its thumbnail alone.
 *
 * The control is `MediaDropzone` from gatsby-plugin-jaen, the one upload
 * control of the estate: the same component the Media tab's gallery and the
 * booking detail's invoice upload draw, so the gesture, the look and the
 * progress are one thing everywhere. It carries `data-testid="media-dropzone"`,
 * which is how a check proves a screen renders it and not a dropzone of its
 * own.
 *
 * Replacing uploads a new file and simply overwrites the ids. The old file
 * stays on the gateway, where it is content addressed and referenced
 * nowhere else, which is what media.md asks for.
 */
import {useState} from 'react'
import {Button, HStack, Stack} from '@chakra-ui/react'
import {FaTrash} from '@react-icons/all-files/fa/FaTrash'
import {uploadFile} from 'jaen'
import {MediaDropzone} from 'gatsby-plugin-jaen'
import {CarImage, type CarPicture} from './CarImage'

/** The five columns of Car, as the form carries them. Null is "no picture". */
export interface CarImageValue {
  imageFileId: string
  imageUrl: string
  imageThumbUrl: string
  imageWidth?: number
  imageHeight?: number
}

export interface CarImageFieldProps {
  /** The picture the car has now, or nothing. */
  value: CarImageValue | null
  onChange: (value: CarImageValue | null) => void
  /** What the silhouette falls back to while there is no picture. */
  carClass?: string | null
  licensePlate?: string | null
  disabled?: boolean
  strings: {
    ImageUpload: string
    ImageReplace: string
    ImageRemove: string
    ImageHint: string
    ImageUploading: string
    ImageFailed: string
    ImageNotAnImage: string
  }
  /** Told what went wrong, so the dialog shows it where it shows its other failures. */
  onFailure?: (message: string) => void
}

/** 8 MB. A photograph from a phone fits, a raw file does not belong here. */
export const MAX_CAR_IMAGE_BYTES = 8 * 1024 * 1024

const ACCEPT = 'image/png,image/jpeg,image/webp'

/**
 * The picture's own pixels, read from the file before it is sent. A browser
 * that cannot decode the file answers nothing rather than failing the
 * upload: the dimensions are decoration, the three ids are the picture.
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

export function CarImageField({
  value,
  onChange,
  carClass,
  licensePlate,
  disabled,
  strings: s,
  onFailure
}: CarImageFieldProps) {
  const [busy, setBusy] = useState(false)

  const car: CarPicture = {
    licensePlate,
    carClass,
    imageUrl: value?.imageUrl ?? null,
    imageThumbUrl: value?.imageThumbUrl ?? null
  }

  const upload = async (file: File) => {
    setBusy(true)
    try {
      const size = await measure(file)
      const answer = await uploadFile(file, file.name)
      const fileId = String(answer?.data?.file_id ?? '')
      const url = String(answer?.fileUrl ?? '')
      // A gateway that stored no thumbnail answers none, and the full file
      // is then the thumbnail too: the row's three ids stay filled, which is
      // what the backend requires of the triple.
      const thumb = String(answer?.fileThumbUrl ?? '') || url
      if (!fileId || !url) throw new Error(s.ImageFailed)
      onChange({
        imageFileId: fileId,
        imageUrl: url,
        imageThumbUrl: thumb,
        imageWidth: size?.width,
        imageHeight: size?.height
      })
    } catch (error) {
      // The dialog shows this beside its other failures. Swallowing it would
      // leave the form looking as if the picture had been taken.
      onFailure?.(error instanceof Error ? error.message : s.ImageFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack gap="3" data-testid="car-image-field">
      <CarImage car={car} size="banner" full alt={licensePlate ?? ''} />

      <MediaDropzone
        accept={ACCEPT}
        maxFiles={1}
        maxFileSize={MAX_CAR_IMAGE_BYTES}
        disabled={disabled}
        uploading={busy}
        minH="24"
        label={value ? s.ImageReplace : s.ImageUpload}
        hint={s.ImageHint}
        uploadingLabel={s.ImageUploading}
        rootTestId="car-image-dropzone"
        onReject={() => onFailure?.(s.ImageNotAnImage)}
        onUpload={files => {
          const file = files[0]
          if (file) void upload(file)
        }}
      />

      {value && (
        <HStack gap="2">
          <Button
            size="sm"
            variant="outline"
            colorPalette="red"
            minH={{base: '44px', md: '8'}}
            disabled={disabled || busy}
            onClick={() => onChange(null)}
            data-testid="car-image-remove">
            <FaTrash /> {s.ImageRemove}
          </Button>
        </HStack>
      )}
    </Stack>
  )
}
