import {Box, Button, Center, IconButton, Image, Text} from '@chakra-ui/react'
import {GatsbyImage, getSrc} from 'gatsby-plugin-image'
import {CSSProperties, forwardRef, ReactEventHandler} from 'react'
import {FaImage} from '@react-icons/all-files/fa/FaImage'
import {FaTrashAlt} from '@react-icons/all-files/fa/FaTrashAlt'
import {PhotoProvider, PhotoView} from 'react-photo-view'

import {connectField} from '../../connectors'
import {useMediaModal} from '../../contexts/media-modal'
import {useNotificationsContext} from '../../contexts/notifications'
import {PageProvider, usePageContext} from '../../contexts/page'
import {HighlightTooltip} from '../components/HighlightTooltip'
import {useFileObjectUrl} from '../../utils/open-storage-gateway'
import {useImage} from './hooks/use-image'

export interface ImageProps {
  alt?: string
  className?: string
  style?: CSSProperties
  imgClassName?: string
  imgStyle?: CSSProperties
  backgroundColor?: string
  objectFit?: CSSProperties['objectFit']
  objectPosition?: CSSProperties['objectPosition']
  onLoad?: (props: {wasCached: boolean}) => void
  onError?: ReactEventHandler<HTMLImageElement>
  onStartLoad?: (props: {wasCached: boolean}) => void
}

export interface ImageFieldProps extends ImageProps {
  lightbox?: boolean
  /**
   * When true, the image will be displayed in a lightbox along with other images in the same group.
   * Thus it is required to wrap the image in a `PhotoProvider` component.
   *
   * @example
   * ```tsx
   *
   * import {Field, PhotoProvider} from 'jaen'
   *
   * <PhotoProvider maskOpacity={0.8}>
   *  <Field.Image ... lightboxGroup />
   *  <Field.Image ... lightboxGroup />
   * </PhotoProvider>
   * ```
   */
  lightboxGroup?: boolean
  defaultValue?: string
  /**
   * When true, the unoptimized image will be rendered after the optimized image.
   * This is useful when you want to display a GIF image.
   *
   * @example
   * ```tsx
   * import {Field} from 'jaen'
   *
   * <Field.Image ... overload defaultValue="https://i.giphy.com/media/duzpaTbCUy9Vu/giphy.webp" />
   * ```
   *
   * In this example, the GIF image will be displayed after the optimized image (no GIF).
   */
  overload?: boolean
  sizes?: string
  autoScale?: boolean
  /**
   * Intrinsic size of `defaultValue`, written as real width and height
   * attributes on the fallback img. Chakra's own width/height are style props
   * and never reach the DOM, which is what Lighthouse's "explicit width and
   * height" audit reads. Ignored once the field has a media node, because
   * GatsbyImage writes them itself.
   */
  intrinsicWidth?: number
  intrinsicHeight?: number
}

export type ImageFieldMediaId = string

export const ImageField = connectField<ImageFieldMediaId, ImageFieldProps>(
  ({
    jaenField,
    lightbox,
    lightboxGroup,
    defaultValue,
    overload,
    sizes,
    autoScale = true,
    intrinsicWidth,
    intrinsicHeight,
    ...imageProps
  }) => {
    const isLightbox = lightbox && !jaenField.isEditing

    let mediaId = jaenField.value

    if (mediaId === undefined) {
      mediaId = jaenField.staticValue
    }

    const {jaenPage} = usePageContext()

    const context = useMediaModal({
      id: jaenField.id || jaenField.name,
      jaenPageId: jaenPage.id,
      onSelect: media => {
        jaenField.onUpdateValue(media.id)
      }
    })

    const {confirm} = useNotificationsContext()

    const handleRemove = async () => {
      const ok = await confirm({
        title: 'Remove Image',
        message: 'Are you sure you want to remove this image?'
      })

      if (ok) {
        jaenField.onUpdateValue(null as any)
      }
    }

    return (
      <PageProvider
        jaenPage={{
          id: 'JaenPage /cms/media/',
          mediaNodes: jaenPage.mediaNodes || []
        }}>
        <HighlightTooltip
          id={jaenField.id || jaenField.name}
          author={jaenField.lastAuthor}
          isEditing={jaenField.isEditing}
          boxSize={autoScale ? 'full' : 'fit-content'}
          actions={[
            <Button
              variant={
                // This variant is declared in gatsby-plugin-jaen's button
                'field-highlighter-tooltip'
              }
              onClick={() => {
                context.toggleModal({defaultSelected: mediaId})
              }}>
              <FaImage />
              Image
            </Button>,

            <IconButton
              variant="field-highlighter-tooltip"
              aria-label="Remove"
              onClick={handleRemove}>
              <FaTrashAlt />
            </IconButton>
          ]}
          as={ImageComponent}
          asProps={{
            mediaId,
            fieldName: jaenField.name,
            imageProps,
            lightbox: isLightbox,
            lightboxGroup,
            defaultValue,
            sizes,
            autoScale,
            intrinsicWidth,
            intrinsicHeight
          }}
        />
      </PageProvider>
    )
  },
  {
    fieldType: 'IMA:ImageField'
  }
)

const ImageComponent = forwardRef<
  HTMLDivElement,
  {
    mediaId?: ImageFieldMediaId
    fieldName: string
    imageProps?: ImageProps

    lightbox?: boolean
    lightboxGroup?: boolean

    defaultValue?: string
    sizes?: string
    autoScale?: boolean
    /** Intrinsic size of `defaultValue`, written as real img attributes. */
    intrinsicWidth?: number
    intrinsicHeight?: number
  }
>(
  (
    {
      mediaId,
      fieldName,
      imageProps = {},
      lightbox,
      lightboxGroup,
      defaultValue,
      sizes,
      autoScale,
      intrinsicWidth,
      intrinsicHeight,
      ...props
    },
    ref
  ) => {
    const image = useImage(mediaId || '')

    /**
     * The unoptimised branch draws whatever address the field carries, and
     * since the gateway went private that address may be one only a signed-in
     * person may read. In the CMS the file is therefore fetched with that
     * person's token and drawn through an object URL; on a public page the
     * hook hands back the address it was given, because the build has already
     * rewritten every gateway URL onto this site's own origin.
     *
     * Called before the early return: a hook may not be conditional.
     */
    const defaultSrc = useFileObjectUrl(defaultValue)

    if (!image && !defaultValue) {
      return (
        <Center
          ref={ref}
          boxSize={autoScale ? 'full' : undefined}
          pos={'relative'}
          overflow="hidden"
          style={imageProps?.style}
          className={imageProps?.className}
          {...props}>
          <Text color="gray.600" fontSize="sm">
            No image
          </Text>
        </Center>
      )
    }

    let element = (
      <Box
        ref={ref}
        boxSize={autoScale ? 'full' : undefined}
        pos={'relative'}
        overflow="hidden"
        cursor={lightbox ? 'zoom-in' : 'default'}
        {...props}>
        {image ? (
          <GatsbyImage
            image={image?.image}
            alt={image.description}
            {...imageProps}
            sizes={sizes}
            style={{
              ...imageProps?.style,
              ...(autoScale ? {height: '100%', width: '100%'} : {})
            }}
          />
        ) : (
          /**
           * A plain img, not Chakra's, when the caller knows the intrinsic
           * size.
           *
           * Chakra treats `width` and `height` as style props, so they become
           * CSS and never reach the DOM as attributes. Lighthouse's "Image
           * elements do not have explicit width and height" reads the
           * attributes, and without them the browser cannot reserve the box
           * before the file arrives. An aspect-ratio on a wrapper fixes the
           * shift but not the audit, because the audit looks at the element.
           *
           * Only this branch needs it: the media path renders GatsbyImage,
           * which writes the attributes itself.
           */
          // @ts-ignore
          <Image
            {...imageProps}
            sizes={sizes}
            src={defaultSrc}
            boxSize={autoScale ? 'full' : undefined}
            style={imageProps?.style}
            asChild={intrinsicWidth && intrinsicHeight ? true : undefined}>
            {intrinsicWidth && intrinsicHeight ? (
              <img
                src={defaultSrc}
                width={intrinsicWidth}
                height={intrinsicHeight}
                alt={imageProps?.alt}
                loading="lazy"
                decoding="async"
              />
            ) : undefined}
          </Image>
        )}
      </Box>
    )

    if (lightbox) {
      const src = image ? getSrc(image.image) : defaultSrc

      element = <PhotoView src={src}>{element}</PhotoView>

      if (!lightboxGroup) {
        element = (
          <PhotoProvider maskOpacity={0.8}>
            <PhotoView src={src}>{element}</PhotoView>
          </PhotoProvider>
        )
      }
    }

    return element
  }
)
