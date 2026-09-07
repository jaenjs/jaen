/**
 * The one upload control of this estate.
 *
 * jaen's Media tab used to drive its upload with react-dropzone while the
 * taxi app drew its own Chakra `FileUpload` for the invoice, so the two
 * looked and behaved differently for the same gesture. Everything a person
 * uploads now goes through this component: the Media gallery, the fleet's
 * vehicle picture and the app's invoice, one look, one drag and drop, one
 * progress. See okf/architecture/media.md in the taxi-app repository,
 * "Target".
 *
 * Two shapes, one control:
 *
 * - **the box**, the default: a dashed surface with the cloud icon, the
 *   label and the hint, which is what a form shows where an upload is the
 *   point of the field (the invoice, a vehicle picture).
 * - **the surface**, with `children`: the children are the drop area
 *   themselves and a translucent sheet is drawn over them while a file
 *   hovers, and only then, which is what a gallery shows, where the grid is
 *   the target and a box would be in the way.
 *
 * Both render the same `FileUpload.Dropzone` and both carry
 * `data-testid="media-dropzone"` (MEDIA_DROPZONE_TESTID), which is how a
 * check proves that a screen renders this control and not one of its own.
 *
 * The button that opens the file dialog is often not inside the dropzone (a
 * gallery keeps it in its sticky toolbar), so the control is handed out
 * through `controlRef`: `controlRef.current.open()` opens the dialog and
 * `clear()` empties the selection after an upload, so dropping the same
 * file twice is two uploads and not one ignored repeat.
 */
import React, {useCallback, useEffect} from 'react'
import {
  Box,
  FileUpload,
  Icon,
  Text,
  useFileUploadContext
} from '@chakra-ui/react'
import {useIntl} from 'react-intl'

import {FaCloudUploadAlt} from '@react-icons/all-files/fa/FaCloudUploadAlt'

/** The one testid every upload control of the estate carries. */
export const MEDIA_DROPZONE_TESTID = 'media-dropzone'

/**
 * The drag sheet of the surface shape, which exists only while a file
 * hovers. A check reads it to prove that nothing covers the grid at rest.
 */
export const MEDIA_DROPZONE_SHEET_TESTID = 'media-dropzone-sheet'

export interface MediaDropzoneControl {
  /** Opens the file dialog, for a trigger that lives outside the dropzone. */
  open: () => void
  /** Empties the selection, so the same file can be dropped again. */
  clear: () => void
}

export interface MediaDropzoneProps {
  /** The accepted files, in the order the person chose them. */
  onUpload: (files: File[]) => void | Promise<void>
  /** Anything the accept rule, the size or the count refused. */
  onReject?: (files: File[]) => void
  /** `image/*`, `application/pdf`, a list, or a map of type to extensions. */
  accept?: string | string[] | Record<string, string[]>
  maxFiles?: number
  /** Bytes. */
  maxFileSize?: number
  disabled?: boolean
  /** True while the caller's upload is running: the box says so and refuses a second drop. */
  uploading?: boolean

  /** The headline of the box, "Rechnung hochladen". */
  label?: string
  /** The second line, what may be dropped. */
  hint?: string
  /** The headline while `uploading`. */
  uploadingLabel?: string

  /** Handed the control as soon as the machine exists, see the note above. */
  controlRef?: React.MutableRefObject<MediaDropzoneControl | null>
  /** Told whenever a file starts or stops hovering, for a toolbar that reacts. */
  onDragChange?: (dragging: boolean) => void

  /** The surface shape: these are the drop area, and the box is not drawn. */
  children?: React.ReactNode
  /** An id for the outer element, so an old check keeps its selector. */
  rootTestId?: string
  minH?: string
}

/**
 * The machine's api reaches the caller from inside the provider, and it
 * reaches it from an effect rather than from the render: handing the
 * control out or reporting a drag while rendering would set a parent's
 * state during this component's render, which React refuses to do quietly.
 */
const DropzoneBridge: React.FC<{
  controlRef?: React.MutableRefObject<MediaDropzoneControl | null>
  onDragChange?: (dragging: boolean) => void
}> = ({controlRef, onDragChange}) => {
  const api = useFileUploadContext()

  useEffect(() => {
    if (!controlRef) return
    controlRef.current = {
      open: () => api.openFilePicker(),
      clear: () => api.clearFiles()
    }
    return () => {
      controlRef.current = null
    }
  }, [api, controlRef])

  useEffect(() => {
    onDragChange?.(api.dragging)
  }, [api.dragging, onDragChange])

  return null
}

/**
 * The sheet of the surface shape, drawn only while a file hovers over it.
 *
 * It used to ride on `FileUpload.DropzoneContent`, on the assumption that
 * the slot appears with the drag the way a "drop it here" line does. It
 * does not: in v3 `DropzoneContent` is a plain styled div that is always
 * rendered, which is why the box shape draws its label and its hint in one.
 * An absolute, translucent, blurred box inside it therefore stood over the
 * media grid at every moment, and the Media tab showed every picture behind
 * a white blur that no gesture made go away. The drag is asked for instead,
 * from the machine that knows it.
 */
const DropSheet: React.FC = () => {
  const api = useFileUploadContext()

  if (!api.dragging) return null

  return (
    <Box
      data-testid={MEDIA_DROPZONE_SHEET_TESTID}
      pos="absolute"
      inset="0"
      zIndex="1"
      // The sheet is the whole feedback of the surface shape, and it must
      // not swallow the click that lands under it.
      pointerEvents="none"
      bg="bg.translucent"
      backdropFilter="blur(8px) saturate(180%)"
    />
  )
}

export const MediaDropzone: React.FC<MediaDropzoneProps> = ({
  onUpload,
  onReject,
  accept,
  maxFiles = 1,
  maxFileSize,
  disabled,
  uploading,
  label,
  hint,
  uploadingLabel,
  controlRef,
  onDragChange,
  children,
  rootTestId,
  minH = '28'
}) => {
  const intl = useIntl()

  const headline =
    label ??
    intl.formatMessage({
      id: 'MediaDropzoneLabel',
      defaultMessage: 'Upload a file'
    })
  const secondLine =
    hint ??
    intl.formatMessage({
      id: 'MediaDropzoneHint',
      defaultMessage: 'Drag a file here or choose one'
    })
  const busyLine =
    uploadingLabel ??
    intl.formatMessage({
      id: 'MediaDropzoneUploading',
      defaultMessage: 'Uploading …'
    })

  const handleFileChange = useCallback(
    (details: {acceptedFiles: File[]; rejectedFiles: Array<{file: File}>}) => {
      if (details.rejectedFiles.length) {
        onReject?.(details.rejectedFiles.map(entry => entry.file))
      }
      if (details.acceptedFiles.length) {
        void onUpload(details.acceptedFiles)
      }
    },
    [onUpload, onReject]
  )

  return (
    <FileUpload.Root
      accept={accept}
      maxFiles={maxFiles}
      maxFileSize={maxFileSize}
      disabled={disabled || uploading}
      onFileChange={handleFileChange}
      w="full"
      data-testid={rootTestId}>
      <DropzoneBridge controlRef={controlRef} onDragChange={onDragChange} />

      <FileUpload.HiddenInput />

      {children ? (
        <FileUpload.Dropzone
          // The surface shape borrows nothing from the box: no border, no
          // padding, no minimum height, because the children are the area.
          data-testid={MEDIA_DROPZONE_TESTID}
          // A click on the grid selects a picture, it does not open the file
          // dialog: the toolbar's button is the way in, through controlRef.
          disableClick
          unstyled
          pos="relative"
          display="block"
          w="full"
          h="full"
          p="0"
          border="none"
          borderRadius="0"
          bg="transparent">
          <DropSheet />
          {children}
        </FileUpload.Dropzone>
      ) : (
        <FileUpload.Dropzone
          data-testid={MEDIA_DROPZONE_TESTID}
          minH={minH}
          w="full"
          cursor={disabled || uploading ? 'default' : 'pointer'}>
          <Icon color="fg.muted" boxSize="6">
            <FaCloudUploadAlt />
          </Icon>
          <FileUpload.DropzoneContent>
            <Text textStyle="sm" fontWeight="medium">
              {uploading ? busyLine : headline}
            </Text>
            <Text textStyle="xs" color="fg.muted">
              {secondLine}
            </Text>
          </FileUpload.DropzoneContent>
        </FileUpload.Dropzone>
      )}
    </FileUpload.Root>
  )
}
