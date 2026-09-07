import {
  AspectRatio,
  Center,
  Icon,
  Image,
  Input,
  InputGroup,
  Link,
  Spinner,
  Stack,
  Text
} from '@chakra-ui/react'
import {MouseEventHandler, useEffect, useRef, useState} from 'react'

import {FaFilePdf} from '@react-icons/all-files/fa/FaFilePdf'
import {useFileObjectUrl} from 'jaen'

import {MediaFolderNode} from '../../../../types'

/** What a node has to say to be drawn as a document rather than a picture. */
export const DOCUMENT_MIME_TYPE = 'application/pdf'

export interface MediaItemProps {
  node: MediaFolderNode

  isLast: boolean

  isSelected?: boolean
  onClick?: MouseEventHandler<HTMLDivElement> | undefined
  onDoubleClick?: MouseEventHandler<HTMLDivElement> | undefined
  onUpdateDescription?: (description: string) => void
}

export const MediaItem: React.FC<MediaItemProps> = ({
  node,
  isLast,
  isSelected,
  onClick,
  onDoubleClick,
  onUpdateDescription
}) => {
  const imageRef = useRef<HTMLImageElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  /**
   * The tile has always drawn the thumbnail first and swapped in the full
   * file once it had been in view for half a second. That swap used to be a
   * `setAttribute('src', node.url)` straight onto the element, which the
   * private gateway makes impossible: an `<img>` sends no Authorization
   * header and the gateway answers 401. The observer now only says "this one
   * is in view", and both addresses are fetched with the signed-in person's
   * token and drawn as object URLs.
   */
  const [isInView, setIsInView] = useState(false)

  const previewUrl = useFileObjectUrl(node.preview?.url)
  const fullUrl = useFileObjectUrl(isInView ? node.url : undefined)

  /**
   * A document has no preview to draw, so its bytes are fetched up front and
   * the link points at the object URL. A blob: href opens in a new tab
   * without a popup being blocked, which a `window.open` after an await
   * would be.
   */
  const documentUrl = useFileObjectUrl(
    node.mimeType === DOCUMENT_MIME_TYPE ? node.url : undefined
  )

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    // when the image is in viewport for at least 500ms, we load the full image
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            timeoutId = setTimeout(() => {
              setIsInView(true)
            }, 500)
          } else {
            clearTimeout(timeoutId)
          }
        })
      },
      {threshold: 1}
    )

    if (imageRef.current) {
      observer.observe(imageRef.current)
    }

    return () => {
      observer.disconnect()
      clearTimeout(timeoutId)
    }
  }, [imageRef])

  /**
   * A document is not a picture: there is nothing to load, nothing to
   * measure and nothing an image editor could do with it, so the tile draws
   * the document icon and the file name, and the name is the link that
   * opens the gateway's url in a new tab. A double click anywhere on the
   * tile does the same, because that is the gesture the grid's pictures
   * answer with the preview. See okf/architecture/media.md, "One gallery,
   * jaen's".
   */
  if (node.mimeType === DOCUMENT_MIME_TYPE) {
    const openDocument = () => {
      if (documentUrl) {
        window.open(documentUrl, '_blank', 'noopener,noreferrer')
      }
    }

    return (
      <Stack
        key={node.id}
        id={node.id}
        justifyContent="center"
        onClick={onClick}
        onDoubleClick={event => {
          event.stopPropagation()
          openDocument()
        }}
        data-testid="media-item-document">
        <AspectRatio
          ratio={4 / 3}
          borderColor="border.emphasized"
          borderWidth="1px"
          {...(isSelected && {
            outline: '2px solid',
            outlineColor: 'brand.500',
            outlineOffset: '3px',
            borderRadius: 'surface'
          })}>
          <Center id={isLast ? 'last-media-item' : undefined}>
            <Icon boxSize="10" color="fg.muted" asChild>
              <FaFilePdf />
            </Icon>
          </Center>
        </AspectRatio>

        <Link
          href={documentUrl}
          target="_blank"
          rel="noopener noreferrer"
          fontSize="xs"
          fontWeight="bold"
          justifyContent="center"
          textAlign="center"
          wordBreak="break-all"
          data-testid="media-item-document-link"
          onClick={event => {
            // The tile is still selectable, the link is only the way out to
            // the file, so the click does not also toggle the selection.
            event.stopPropagation()
          }}>
          {node.description || node.url}
        </Link>
      </Stack>
    )
  }

  return (
    <Stack key={node.id} id={node.id} justifyContent="center" onClick={onClick}>
      <AspectRatio
        ratio={
          node.width > 0 && node.height > 0 ? node.width / node.height : 4 / 3
        }
        onDoubleClick={onDoubleClick}
        objectFit="contain"
        borderColor="border.emphasized"
        borderWidth="1px"
        {...(isSelected && {
          outline: '2px solid',
          outlineColor: 'brand.500',
          outlineOffset: '3px',
          borderRadius: 'surface'
        })}>
        <Image
          ref={imageRef}
          src={fullUrl ?? previewUrl}
          onLoad={() => {
            setIsLoaded(true)
          }}
          alt={node.description}
          id={isLast ? 'last-media-item' : undefined}
        />
      </AspectRatio>

      {/*
        v2's InputGroup handed `size` to the input and both addons through
        context, which v3 dropped, so each of the three carries its own.
        `w: '4.5trem'` is the v2 typo verbatim: it is not a length, so the
        addon has always sized itself to its content. Correcting it here would
        widen the addon and move the input edge.
      */}
      <InputGroup
        startAddon={!isLoaded ? <Spinner size="xs" /> : undefined}
        startAddonProps={{size: 'xs', pointerEvents: 'none'}}
        endAddon={
          <Text fontSize="xs" fontWeight="bold">
            {node.width}x{node.height}
          </Text>
        }
        endAddonProps={{size: 'xs', w: '4.5trem'}}>
        <Input
          key={node?.description}
          size="xs"
          textAlign="center"
          fontSize="xs"
          fontWeight="bold"
          defaultValue={node.description}
          onBlur={e => {
            onUpdateDescription?.(e.target.value)
          }}
        />
      </InputGroup>
    </Stack>
  )
}
