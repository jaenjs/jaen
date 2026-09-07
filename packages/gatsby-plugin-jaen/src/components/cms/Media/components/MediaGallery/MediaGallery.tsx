// MediaGallery.tsx
import {
  Box,
  Button,
  ButtonGroup,
  HStack,
  Icon,
  IconButton,
  Input,
  InputGroup,
  Slider,
  Spacer,
  Tag
} from '@chakra-ui/react'
import {MediaNode} from 'jaen'
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {BsLayoutSidebarInset} from '@react-icons/all-files/bs/BsLayoutSidebarInset'

import {FaCheck} from '@react-icons/all-files/fa/FaCheck'
import {FaClone} from '@react-icons/all-files/fa/FaClone'
import {FaDownload} from '@react-icons/all-files/fa/FaDownload'
import {FaMinus} from '@react-icons/all-files/fa/FaMinus'
import {FaPlus} from '@react-icons/all-files/fa/FaPlus'
import {FaSearch} from '@react-icons/all-files/fa/FaSearch'
import {FaSlidersH} from '@react-icons/all-files/fa/FaSlidersH'
import {FaTimes} from '@react-icons/all-files/fa/FaTimes'
import {FaTrash} from '@react-icons/all-files/fa/FaTrash'

import {MediaPreviewState} from '../../types'
import {MediaGrid} from './components/MediaGrid/MediaGrid'
import {useDebouncedCallback} from 'use-debounce'
import {
  MediaDropzone,
  MediaDropzoneControl
} from '../../../../shared/MediaDropzone'

export interface MediaGalleryProps {
  pageFilter?: string
  removePageFilter: () => void

  mediaNodes: MediaNode[]

  selectedMediaNode: MediaNode | null
  onSelectMediaNode: (node: MediaNode | null) => void

  onUpload: (files: File[]) => Promise<void>
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

  isSidebarOpen: boolean
  onToggleSidebar: () => void

  isPreview: MediaPreviewState
  onPreview: (state: MediaPreviewState) => void

  isSelector?: boolean
  onSelect?: (id: string) => void
}

export const MediaGallery: React.FC<MediaGalleryProps> = ({
  pageFilter,
  removePageFilter,
  mediaNodes,
  selectedMediaNode,
  onSelectMediaNode,
  onUpload,
  onDelete,
  onUpdate,
  onClone,
  onDownload,
  isSidebarOpen,
  onToggleSidebar,
  isPreview,
  onPreview,
  isSelector,
  onSelect
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('')

  const handleSearchChange = useDebouncedCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(event.target.value)

      // reset selected media node
      onSelectMediaNode(null)
    },
    300
  )

  const [mediaNodesLimit, setMediaNodesLimit] = useState<number>(30)

  const onLoadMore = useCallback(() => {
    setMediaNodesLimit(mediaNodesLimit + 30)
  }, [mediaNodesLimit])

  const filteredMediaNodes = useMemo(() => {
    return mediaNodes.filter(node => {
      if (searchQuery.length === 0) return true

      return node.description?.toLowerCase().includes(searchQuery.toLowerCase())
    })
  }, [mediaNodes, searchQuery])

  const limitedMediaNodes = useMemo(
    () => filteredMediaNodes.slice(0, mediaNodesLimit),
    [filteredMediaNodes, mediaNodesLimit]
  )

  const [columnCount, setColumnCount] = useState<number>(3)

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

  useEffect(() => {
    const handleScroll = () => {
      const lastMediaItem = document.getElementById('last-media-item') // Add an ID to the last media item in the list

      if (lastMediaItem) {
        const rect = lastMediaItem.getBoundingClientRect()
        const isAtBottom = rect.bottom <= window.innerHeight

        if (isAtBottom) {
          onLoadMore()
        }
      }
    }

    window.addEventListener('scroll', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [onLoadMore])

  useEffect(() => {
    // scroll to selected media item
    if (selectedMediaNode) {
      const selectedMediaItem = document.getElementById(selectedMediaNode.id)

      if (selectedMediaItem) {
        selectedMediaItem.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      }
    }
  }, [selectedMediaNode?.id])

  const [isUploading, setIsUploading] = useState<boolean>(false)

  /**
   * The gallery's grid is the drop area and the toolbar's button is the way
   * to the file dialog, so the control of the shared dropzone is handed out
   * here rather than rendered as a button of its own. The selection is
   * cleared after every upload: without it the same file dropped twice is
   * one upload and the second gesture does nothing.
   */
  const dropzoneControl = useRef<MediaDropzoneControl | null>(null)
  const [isDragActive, setIsDragActive] = useState<boolean>(false)

  const handleOnUpload = useCallback(
    async (files: File[]) => {
      setIsUploading(true)

      try {
        await onUpload(files)
      } finally {
        setIsUploading(false)
        dropzoneControl.current?.clear()
      }
    },
    [onUpload]
  )

  const searchRef = useRef<HTMLInputElement>(null)

  return (
    <Box w="full">
      <HStack
        visibility={isPreview ? 'hidden' : 'visible'}
        h="12"
        w="full"
        px="4"
        top="0"
        pos="sticky"
        zIndex="2"
        bg="bg.surface"
        borderBottom="1px solid"
        borderColor="border.emphasized">
        <HStack display={{base: 'none', md: 'flex'}}>
          <HStack display={{base: 'none', md: 'flex'}}>
            {!isSelector && !isSidebarOpen && (
              <IconButton
                aria-label="open sidebar"
                fontSize="1.2em"
                variant="ghost"
                onClick={onToggleSidebar}>
                <BsLayoutSidebarInset />
              </IconButton>
            )}

            <Icon boxSize="2" asChild>
              <FaMinus
                onClick={() => {
                  if (columnCount === 1) return

                  setColumnCount(columnCount - 1)
                }}
              />
            </Icon>
            <Slider.Root
              w="12"
              // One label per thumb, which is where v2 put the single string too.
              aria-label={['slider-image-size']}
              value={[columnCount]}
              min={1}
              max={5}
              onValueChange={({value}) => {
                // One thumb, so the array is always a single entry; the fallback
                // only exists to satisfy noUncheckedIndexedAccess.
                setColumnCount(value[0] ?? columnCount)
              }}>
              <Slider.Control>
                <Slider.Track>
                  <Slider.Range />
                </Slider.Track>
                <Slider.Thumbs />
              </Slider.Control>
            </Slider.Root>
            <Icon boxSize="2" asChild>
              <FaPlus
                onClick={() => {
                  if (columnCount === 5) return

                  setColumnCount(columnCount + 1)
                }}
              />
            </Icon>
          </HStack>

          {!isSelector && pageFilter && (
            <Tag.Root size="md" variant="subtle">
              {pageFilter}
              <Tag.CloseTrigger
                onClick={() => {
                  removePageFilter()
                }}
              />
            </Tag.Root>
          )}
        </HStack>

        <Spacer />

        {/*
          v2's InputGroup pushed `size` down to the input and both elements
          through context. v3 has no such context, so the size rides on the
          input and the elements size themselves off `--input-height`.
        */}
        <InputGroup
          maxW="md"
          startElement={
            <Icon color="gray.300" asChild>
              <FaSearch />
            </Icon>
          }
          // The 4px kept the clear button off the right border; nothing in
          // InputElement reproduces it.
          endElementProps={{mr: '1'}}
          endElement={
            searchQuery.length > 0 ? (
              <IconButton
                aria-label="Clear search"
                variant="ghost"
                size="xs"
                onClick={() => {
                  setSearchQuery('')
                  // clear search input
                  searchRef.current?.focus()

                  searchRef.current!.value = ''
                }}>
                <FaTimes />
              </IconButton>
            ) : undefined
          }>
          <Input
            ref={searchRef}
            size="sm"
            type="text"
            placeholder="Search media..."
            defaultValue={searchQuery}
            onChange={handleSearchChange}
          />
        </InputGroup>

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
        </ButtonGroup>

        <Box display={{base: 'block', md: 'none'}}>
          <IconButton
            size="xs"
            variant="outline"
            aria-label={isDragActive ? 'Drop to upload' : 'Upload images'}
            loading={isUploading}
            onClick={() => dropzoneControl.current?.open()}>
            <FaPlus
              style={{
                transform: isDragActive ? 'rotate(15deg)' : 'none'
              }}
            />
          </IconButton>
        </Box>

        <Box display={{base: 'none', md: 'block'}}>
          {isDragActive ? (
            <Button size="xs" colorPalette="orange">
              <FaPlus />
              Drop to upload
            </Button>
          ) : (
            <Button
              variant="outline"
              size="xs"
              loading={isUploading}
              onClick={() => dropzoneControl.current?.open()}>
              <FaPlus />
              Upload
            </Button>
          )}
        </Box>

        <Button
          display={isSelector ? 'block' : 'none'}
          size="xs"
          disabled={selectedMediaNode === null}
          onClick={() => {
            if (isSelector && selectedMediaNode) {
              onSelect?.(selectedMediaNode?.id)
            }
          }}>
          <FaCheck />
          Choose
        </Button>
      </HStack>

      <MediaDropzone
        accept="image/*"
        maxFiles={20}
        onUpload={handleOnUpload}
        uploading={isUploading}
        controlRef={dropzoneControl}
        onDragChange={setIsDragActive}>
        <Box h="full" p="1">
          <MediaGrid
            mediaNodes={limitedMediaNodes}
            columnCount={6 - columnCount}
            selectedMediaNode={selectedMediaNode}
            onSelect={onSelectMediaNode}
            onDoubleClick={() => {
              onPreview('PREVIEW')
            }}
            onUpdateDescription={description => {
              handleUpdate({description})
            }}
          />
        </Box>
      </MediaDropzone>
    </Box>
  )
}
