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

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    // when the image is in viewport for at least 500ms, we load the full image
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            timeoutId = setTimeout(() => {
              imageRef.current?.setAttribute('src', node.url)
              // set loading state to false when image is loaded
              imageRef.current?.addEventListener('load', () => {
                setIsLoaded(true)
              })
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
      window.open(node.url, '_blank', 'noopener,noreferrer')
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
          href={node.url}
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
          src={node.preview?.url}
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
