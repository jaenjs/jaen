import {
  AspectRatio,
  Image,
  Input,
  InputGroup,
  Spinner,
  Stack,
  Text
} from '@chakra-ui/react'
import {MediaNode} from 'jaen'
import {MouseEventHandler, useEffect, useRef, useState} from 'react'

export interface MediaItemProps {
  node: MediaNode

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
          borderRadius: 'lg'
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
