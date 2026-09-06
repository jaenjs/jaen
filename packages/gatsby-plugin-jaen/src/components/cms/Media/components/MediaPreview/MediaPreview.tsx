import {
  AspectRatio,
  Button,
  ButtonGroup,
  HStack,
  IconButton,
  Image,
  Input,
  Spacer,
  Text,
  Dialog,
  Portal
} from '@chakra-ui/react'
import {MediaNode} from 'jaen'
import {useEffect} from 'react'
import FilerobotImageEditor, {TABS} from 'react-filerobot-image-editor'

import {FaArrowLeft} from '@react-icons/all-files/fa/FaArrowLeft'
import {FaArrowRight} from '@react-icons/all-files/fa/FaArrowRight'
import {FaClone} from '@react-icons/all-files/fa/FaClone'
import {FaDownload} from '@react-icons/all-files/fa/FaDownload'
import {FaSlidersH} from '@react-icons/all-files/fa/FaSlidersH'
import {FaTrash} from '@react-icons/all-files/fa/FaTrash'
import {FaCheck} from '@react-icons/all-files/fa/FaCheck'

import {TransformComponent, TransformWrapper} from 'react-zoom-pan-pinch'

import {MediaPreviewState} from '../../types'

export interface MediaPreviewProps {
  selectedMediaNode: MediaNode | null
  onSelectMediaNode: (node: MediaNode | null) => void
  mediaNodes: MediaNode[]
  isSelector?: boolean
  onSelect?: (id: string) => void
  isPreview: MediaPreviewState
  onPreview: (state: MediaPreviewState) => void

  onDelete: (ids: string) => void
  onUpdate: (
    id: string,
    data: Partial<
      MediaNode & {
        file: File
      }
    >
  ) => void
  onClone: (id: string) => void
  onDownload: (id: string) => void
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({
  selectedMediaNode,
  onSelectMediaNode,
  mediaNodes,
  isSelector,
  onSelect,
  isPreview,
  onPreview,
  onDelete,
  onUpdate,
  onClone,
  onDownload
}) => {
  const handleDownload = () => {
    if (selectedMediaNode) {
      // call onDownload callback

      onDownload(selectedMediaNode.id)
    }
  }

  const handleDelete = () => {
    if (selectedMediaNode) {
      // call onDelete callback

      onDelete(selectedMediaNode.id)
      onSelectMediaNode(null)

      onPreview(false)
    }
  }

  const handleEdit = () => {
    if (selectedMediaNode) {
      // call onEdit callback

      onPreview('EDIT')
    }
  }

  const handleClone = () => {
    if (selectedMediaNode) {
      // call onClone callback

      onClone(selectedMediaNode.id)
    }
  }

  const handleUpdate = (
    data: Partial<
      MediaNode & {
        file: File
      }
    >
  ) => {
    if (selectedMediaNode) {
      // call onUpdate callback

      onUpdate(selectedMediaNode.id, data)
    }
  }

  const previewItemsLength = Math.min(mediaNodes.length, 9)

  return (
    <Dialog.Root
      open={isPreview !== false}
      size="full"
      motionPreset="none"
      onOpenChange={e => {
        if (!e.open) {
          onPreview(false)
        }
      }}>
      <Portal>
        <Dialog.Backdrop />

        {/*
          v2 spelled a `#momo` root here as containerProps on ModalContent,
          because the provider scoped every Chakra custom property to that
          selector and a portal lands outside it. v3 emits them globally behind
          the `jaen` prefix (see gatsby/wrap-root-element), so the portalled
          content resolves its tokens without a root of its own.

          The id must not be re-homed onto the positioner either: zag owns that
          element's id and resolves it back with getElementById to write
          `--layer-index` and `--z-index`. An override sends that lookup to
          JaenFrame's header instead — and this dialog opens inside the media
          modal, so both would have claimed the same id at once and neither
          positioner would have received its layer index.
        */}
        <Dialog.Positioner>
          <Dialog.Content
            overflow="hidden"
            bg="transparent"
            css={{
              '& .react-transform-wrapper': {
                w: 'full',
                h: 'full',
                justifyContent: 'center',
                display: isPreview === 'PREVIEW' ? 'flex' : 'none'
              },

              '& .react-transform-component': {
                w: 'full',
                h: 'full'
              }
            }}>
            <Dialog.Header p="0">
              <HStack
                h="12"
                w="full"
                p="4"
                top="0"
                pos="sticky"
                zIndex="2"
                bg="bg.surface"
                borderBottom="1px solid"
                borderColor="border.emphasized">
                {/* `text` comes from theme/recipes/button.ts. v3 types variant
                    off Chakra's shipped recipes.gen.d.ts, which only picks up
                    theme recipes once `chakra typegen` regenerates it, and no
                    package here runs typegen yet. */}
                <Button
                  variant="text"
                  onClick={() => {
                    onPreview(false)
                  }}>
                  <FaArrowLeft />
                  Back to media
                </Button>

                <Spacer />

                <Input
                  key={selectedMediaNode?.description}
                  size="xs"
                  textAlign="center"
                  border="none"
                  fontSize="xs"
                  fontWeight="bold"
                  defaultValue={selectedMediaNode?.description}
                  maxW="sm"
                  onBlur={e => {
                    handleUpdate({
                      description: e.target.value
                    })
                  }}
                />

                <Spacer />

                <ButtonGroup variant="outline" size="xs">
                  <IconButton
                    aria-label="Customize selected image"
                    onClick={handleEdit}
                    disabled={selectedMediaNode === null}>
                    <FaSlidersH />
                  </IconButton>

                  <IconButton
                    aria-label="Clone selected image"
                    onClick={handleClone}
                    disabled={selectedMediaNode === null}>
                    <FaClone />
                  </IconButton>

                  <IconButton
                    aria-label="Download selected image"
                    onClick={handleDownload}
                    disabled={selectedMediaNode === null}>
                    <FaDownload />
                  </IconButton>
                  <IconButton
                    aria-label="Delete selected image"
                    onClick={handleDelete}
                    disabled={selectedMediaNode === null}>
                    <FaTrash />
                  </IconButton>

                  {isSelector && (
                    <Button
                      variant="solid"
                      onClick={() => {
                        if (selectedMediaNode && onSelect) {
                          onSelect(selectedMediaNode.id)
                        }
                      }}>
                      <FaCheck />
                      Choose
                    </Button>
                  )}
                </ButtonGroup>
              </HStack>
            </Dialog.Header>

            <Dialog.Body
              display="flex"
              h="calc(100dvh - 3rem - 6rem)"
              flex="unset">
              <TransformWrapper
                doubleClick={{
                  mode: 'reset'
                }}>
                {({resetTransform}) => {
                  useEffect(() => {
                    resetTransform()
                  }, [selectedMediaNode?.url])

                  return (
                    <TransformComponent>
                      <Image
                        w="100%"
                        h="100%"
                        objectFit="contain"
                        src={selectedMediaNode?.url}
                        alt={selectedMediaNode?.description}
                      />
                    </TransformComponent>
                  )
                }}
              </TransformWrapper>

              {selectedMediaNode && isPreview === 'EDIT' && (
                // previewPixelRatio is declared required but has a default of
                // window.devicePixelRatio in the editor's own defaultConfig, and
                // passing it explicitly would override that default.
                // @ts-expect-error - upstream types the prop as required
                <FilerobotImageEditor
                  source={selectedMediaNode?.url}
                  closeAfterSave
                  onSave={async editedImageObject => {
                    editedImageObject.imageCanvas?.toBlob(blob => {
                      if (blob) {
                        const newFile = new File(
                          [blob],
                          editedImageObject.fullName ?? 'image.png',
                          {
                            type: blob.type
                          }
                        )

                        handleUpdate({
                          file: newFile
                        })
                      }
                    })
                  }}
                  onBeforeSave={() => false}
                  onClose={() => {
                    onPreview('PREVIEW')
                  }}
                  annotationsCommon={{
                    fill: '#ff0000'
                  }}
                  Rotate={{angle: 90, componentType: 'slider'}}
                  Text={{text: 'Text...'}}
                  tabsIds={[
                    TABS.RESIZE,
                    TABS.ADJUST,
                    TABS.FILTERS,
                    TABS.FINETUNE,
                    TABS.ANNOTATE,
                    TABS.WATERMARK
                  ]}
                  savingPixelRatio={8}
                  // previewPixelRatio={0}
                />
              )}
            </Dialog.Body>

            <Dialog.Footer p="0">
              <HStack
                h="24"
                w="full"
                p="4"
                justifyContent="center"
                bg="bg.surface"
                borderTop="1px solid"
                borderColor="border.emphasized">
                <IconButton
                  variant="ghost"
                  aria-label="Previous image"
                  onClick={() => {
                    // use previous image
                    const currentIndex = mediaNodes.findIndex(
                      node => node.id === selectedMediaNode?.id
                    )

                    // make sure to loop around
                    const previousIndex =
                      (currentIndex - 1 + mediaNodes.length) % mediaNodes.length

                    const node = mediaNodes[previousIndex]

                    if (node) {
                      onSelectMediaNode(node)
                    }
                  }}>
                  <FaArrowLeft />
                </IconButton>

                <HStack>
                  {[...Array(previewItemsLength)].map((_, index) => {
                    const startIndex = mediaNodes.findIndex(
                      node => node.id === selectedMediaNode?.id
                    )

                    const offset = index - Math.floor(previewItemsLength / 2)
                    const nodeIndex =
                      (startIndex + offset + mediaNodes.length) %
                      mediaNodes.length

                    const node = mediaNodes[nodeIndex]

                    if (!node) {
                      return <Text>{nodeIndex}</Text>
                    }

                    return (
                      <AspectRatio
                        key={node.id}
                        ratio={
                          node.width > 0 && node.height > 0
                            ? node.width / node.height
                            : 4 / 3
                        }
                        objectFit="contain"
                        w="16"
                        h="16"
                        {...(selectedMediaNode?.id === node.id && {
                          outline: '2px solid',
                          outlineColor: 'brand.500',
                          outlineOffset: '2px',
                          borderRadius: 'surface'
                        })}
                        onClick={() => {
                          onSelectMediaNode(node)
                        }}>
                        <Image
                          key={node.id}
                          id={index === 8 ? 'last-media-item' : undefined}
                          w="100%"
                          h="100%"
                          src={node.preview?.url ?? node.url}
                          alt={node.description}
                        />
                      </AspectRatio>
                    )
                  })}
                </HStack>

                <IconButton
                  variant="ghost"
                  aria-label="Next image"
                  onClick={() => {
                    // use next image
                    const currentIndex = mediaNodes.findIndex(
                      node => node.id === selectedMediaNode?.id
                    )

                    // make sure to loop around
                    const nextIndex = (currentIndex + 1) % mediaNodes.length

                    const node = mediaNodes[nextIndex]

                    if (node) {
                      onSelectMediaNode(node)
                    }
                  }}>
                  <FaArrowRight />
                </IconButton>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
