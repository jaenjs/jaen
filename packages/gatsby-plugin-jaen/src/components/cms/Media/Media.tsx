import {MediaNode} from 'jaen'
import {
  Flex,
  Heading,
  HStack,
  Icon,
  IconButton,
  Stack,
  Tabs
} from '@chakra-ui/react'
import React, {useEffect, useMemo, useState} from 'react'
import {useIntl} from 'react-intl'

import {BsLayoutSidebarInset} from '@react-icons/all-files/bs/BsLayoutSidebarInset'

import {MediaSource} from '../../../contexts/jaen-frame-menu'
import {PageTree} from '../../shared/PageTree/PageTree'
import {TreeNode} from '../Pages/components/PageVisualizer'
import {MediaGallery} from './components/MediaGallery/MediaGallery'
import {MediaPreview} from './components/MediaPreview/MediaPreview'
import {MediaPreviewState} from './types'

export interface MediaProps {
  mediaNodes: MediaNode[]
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
   * The sources registered on the frame's context, one tab each beside the
   * page images. See okf/architecture/media.md, "Sources", in the taxi-app
   * repository: the app registers Fahrzeuge and Dokumente there, and this
   * component knows nothing about either beyond what a source declares.
   */
  sources?: MediaSource[]
}

/** The value of the tab the page images live on. A source id may not be this. */
export const PAGE_IMAGES_TAB = 'jaen-pages'

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
  sources
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

  const filteredMediaNodes = useMemo(() => {
    if (filters.page) {
      return mediaNodes.filter(node => {
        return node.jaenPageId === filters.page?.jaenPageId
      })
    }

    return mediaNodes
  }, [filters, mediaNodes])

  const sortedMediaNodes = filteredMediaNodes.sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const handleClone = (id: string) => {
    onClone(id)

    setSelectedMediaNode(null)
  }

  /**
   * The page images are the first tab and stay the default, so the tab is
   * an addition for whoever registered a source and no change at all for a
   * site that registers none. A selector (FormMediaChooser) shows no tabs:
   * it is choosing a page image and nothing else fits in a jaen field.
   */
  const [tab, setTab] = useState<string>(PAGE_IMAGES_TAB)
  const tabbedSources = isSelector ? [] : (sources ?? [])

  const gallery = (
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

  if (tabbedSources.length === 0) {
    return gallery
  }

  return (
    <Tabs.Root
      value={tab}
      onValueChange={event => {
        setTab(event.value)
      }}
      variant="line"
      // A source reads through its own query and shows its own skeleton, so
      // it is mounted when its tab is opened and dropped when it is left,
      // rather than fetching in the background behind the page images.
      lazyMount
      unmountOnExit
      data-testid="media-tabs">
      <Tabs.List
        px="4"
        pos="sticky"
        top="0"
        zIndex="3"
        bg="bg.surface"
        borderBottom="1px solid"
        borderColor="border.emphasized">
        <Tabs.Trigger
          value={PAGE_IMAGES_TAB}
          data-testid={`media-tab-${PAGE_IMAGES_TAB}`}>
          {intl.formatMessage({
            id: 'MediaTabPageImages',
            defaultMessage: 'Page images'
          })}
        </Tabs.Trigger>

        {tabbedSources.map(source => (
          <Tabs.Trigger
            key={source.id}
            value={source.id}
            data-testid={`media-tab-${source.id}`}>
            {source.icon && (
              <Icon asChild>
                <source.icon />
              </Icon>
            )}
            {source.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <Tabs.Content value={PAGE_IMAGES_TAB} p="0">
        {gallery}
      </Tabs.Content>

      {tabbedSources.map(source => (
        <Tabs.Content
          key={source.id}
          value={source.id}
          p="4"
          data-testid={`media-source-${source.id}`}>
          <source.list onOpen={source.open} onRemove={source.remove} />
        </Tabs.Content>
      ))}
    </Tabs.Root>
  )
}
