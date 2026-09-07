import {MediaNode} from 'jaen'
import {Flex, Heading, HStack, IconButton, Stack} from '@chakra-ui/react'
import React, {useEffect, useMemo, useState} from 'react'
import {useIntl} from 'react-intl'

import {BsLayoutSidebarInset} from '@react-icons/all-files/bs/BsLayoutSidebarInset'

import {
  MediaFolders,
  MediaFolderTreeNode
} from '../../../contexts/jaen-frame-menu'
import {PageTree} from '../../shared/PageTree/PageTree'
import {TreeNode} from '../Pages/components/PageVisualizer'
import {MediaGallery} from './components/MediaGallery/MediaGallery'
import {MediaPreview} from './components/MediaPreview/MediaPreview'
import {MediaFolderNode, MediaPreviewState} from './types'

export interface MediaProps {
  mediaNodes: MediaFolderNode[]
  tree: Array<TreeNode>

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

  isSelector?: boolean
  onSelect?: (id: string) => void

  // media node id
  defaultSelected?: string

  onJaenPageSelect: (id: string | null) => void

  /**
   * The folders an app registered on the frame's context, already merged
   * into `tree` and `mediaNodes` by the container. They are handed on for
   * two things this component decides: selecting an app folder shows every
   * node underneath it rather than only the ones filed exactly there, and
   * upload inside one is refused with the folder's hint. See
   * okf/architecture/media.md, "One gallery, jaen's".
   */
  folders?: MediaFolders[]
}

export const Media: React.FC<MediaProps> = ({
  tree,
  mediaNodes,
  onUpload,
  onDelete,
  onUpdate,
  onClone,
  onDownload,
  isSelector,
  onSelect,
  defaultSelected,
  onJaenPageSelect,
  folders
}) => {
  const intl = useIntl()

  const [isSidebarOpen, setSidebarOpen] = useState(false) // State variable for sidebar visibility

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen)
  }

  const [isPreview, setPreview] = useState<MediaPreviewState>(false)

  const handlePreview = (state: MediaPreviewState) => {
    setPreview(state)
  }

  const defaultSelectedMediaNode = useMemo(() => {
    if (defaultSelected) {
      return mediaNodes.find(node => node.id === defaultSelected) || null
    }

    return null
  }, [defaultSelected, mediaNodes])

  const [selectedMediaNode, setSelectedMediaNode] = useState<MediaNode | null>(
    null
  )

  useEffect(() => {
    // reselect media node if it still exists
    if (selectedMediaNode) {
      const node = mediaNodes.find(node => node.id === selectedMediaNode.id)

      if (node) {
        setSelectedMediaNode(node)
      } else {
        setSelectedMediaNode(null)
      }
    }
  }, [mediaNodes])

  const [filters, setFilters] = useState<{
    page?: {
      jaenPageId: string
      label: string
    }
  }>({})

  const removePageFilter = () => {
    setFilters({
      ...filters,
      page: undefined
    })

    onJaenPageSelect(null)
  }

  /**
   * Every id of an app folder mapped to the ids underneath it, itself
   * included. A page shows the media filed on that page and nothing of its
   * children, which is jaen's own behaviour and stays; an app folder is a
   * heading rather than a page, so "Fahrzeuge" shows every car's picture
   * and a car's own entry only that car's.
   */
  const folderScopes = useMemo(() => {
    const scopes = new Map<string, Set<string>>()

    const walk = (node: MediaFolderTreeNode): Set<string> => {
      const own = new Set<string>([node.id])
      node.children.forEach(child => {
        walk(child).forEach(id => own.add(id))
      })
      scopes.set(node.id, own)
      return own
    }

    ;(folders ?? []).forEach(folder => {
      const own = new Set<string>([folder.id])
      folder.tree.forEach(child => {
        walk(child).forEach(id => own.add(id))
      })
      scopes.set(folder.id, own)
    })

    return scopes
  }, [folders])

  /** The folder a selected tree entry belongs to, none for a page. */
  const selectedFolder = useMemo(() => {
    const selected = filters.page?.jaenPageId
    if (!selected) return undefined

    return (folders ?? []).find(folder =>
      folderScopes.get(folder.id)?.has(selected)
    )
  }, [filters.page?.jaenPageId, folders, folderScopes])

  const filteredMediaNodes = useMemo(() => {
    const selected = filters.page?.jaenPageId

    if (selected) {
      const scope = folderScopes.get(selected)

      return mediaNodes.filter(node => {
        if (!node.jaenPageId) return false

        return scope ? scope.has(node.jaenPageId) : node.jaenPageId === selected
      })
    }

    return mediaNodes
  }, [filters.page?.jaenPageId, folderScopes, mediaNodes])

  const sortedMediaNodes = filteredMediaNodes.sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const handleClone = (id: string) => {
    onClone(id)

    setSelectedMediaNode(null)
  }

  return (
    <Flex id="momo" pos="relative" minH="calc(100dvh - 4rem - 3rem)">
      <Stack
        as="nav"
        h="calc(100dvh - 4rem)"
        pos="sticky"
        top="0"
        w="xs"
        borderRight="1px solid"
        borderColor="border.emphasized"
        overflow="auto"
        display={isSidebarOpen ? 'block' : 'none'} // Show/hide sidebar based on state
      >
        <HStack w="full" px="4" h="12">
          <IconButton
            aria-label={intl.formatMessage({
              id: 'MediaCloseSidebarAriaLabel',
              defaultMessage: 'close sidebar'
            })}
            fontSize="1.2em"
            variant="ghost"
            onClick={toggleSidebar}>
            <BsLayoutSidebarInset />
          </IconButton>
        </HStack>
        <Stack px="4" py="1" ml="2">
          <Stack>
            <Heading size="xs">
              {intl.formatMessage({
                id: 'MediaPagesHeading',
                defaultMessage: 'Pages'
              })}
            </Heading>

            <PageTree
              tree={tree}
              defaultSelected={filters.page?.jaenPageId}
              onSelected={(id, node) => {
                setFilters({
                  ...filters,
                  page: {
                    jaenPageId: id,
                    label: node.data
                  }
                })

                onJaenPageSelect(id)
              }}
            />
          </Stack>
        </Stack>
      </Stack>

      <MediaGallery
        pageFilter={filters.page?.label}
        removePageFilter={removePageFilter}
        mediaNodes={sortedMediaNodes}
        selectedMediaNode={selectedMediaNode || defaultSelectedMediaNode}
        onSelectMediaNode={setSelectedMediaNode}
        onUpload={onUpload}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onClone={handleClone}
        onDownload={onDownload}
        isUploadDisabled={!!selectedFolder}
        uploadHint={selectedFolder?.uploadHint}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={toggleSidebar}
        isPreview={isPreview}
        onPreview={handlePreview}
        isSelector={isSelector}
        onSelect={onSelect}
      />

      <MediaPreview
        mediaNodes={sortedMediaNodes}
        isPreview={isPreview}
        isSelector={isSelector}
        onSelect={onSelect}
        selectedMediaNode={selectedMediaNode || defaultSelectedMediaNode}
        onSelectMediaNode={setSelectedMediaNode}
        onPreview={handlePreview}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onClone={handleClone}
        onDownload={onDownload}
      />
    </Flex>
  )
}
