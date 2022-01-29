import {AddIcon, DeleteIcon, ViewIcon} from '@chakra-ui/icons'
import {Box, Divider, Flex} from '@chakra-ui/layout'
import {ButtonGroup, IconButton} from '@chakra-ui/react'
import {ITreeJaenPage} from '@jaen/internal-plugins/pages/types'
import * as React from 'react'
import {ContentValues, PageContent} from './PageContent'
import PageTree, {PageTreeProps} from './PageTree'

export interface PagesTabProps extends PageTreeProps {
  getPage: (id: string) => ITreeJaenPage
  onPageUpdate: (id: string, values: ContentValues) => void
}

/**
 * PagesTab is a component for displaying the page tree with content in the dashboard.
 * Display PageTree and PageContent next to each other.
 */
const PagesTab = (props: PagesTabProps) => {
  const [selection, setSelection] = React.useState<ITreeJaenPage | null>(null)

  const onSelect = (id: string | null) => {
    if (id !== null) {
      const page = props.getPage(id)
      setSelection(page)
    } else {
      setSelection(null)
    }
  }

  const handlePageUpdate = React.useCallback(
    (values: ContentValues) =>
      selection && props.onPageUpdate(selection.id, values),
    [selection]
  )

  const selectedTemplate = React.useMemo(
    () => props.templates.find(t => t.name === selection?.template) || null,
    [props.templates, selection?.template]
  )

  return (
    <div>
      <Flex>
        <Box h="70vh" w="30%">
          <>
            <ButtonGroup size="sm" pb="4">
              <IconButton
                aria-label="Add a subpage to the selected page"
                icon={<AddIcon />}
                disabled
              />
              <IconButton
                aria-label="Delete the selected page"
                icon={<DeleteIcon />}
                onClick={() => {
                  props.onItemDelete(selection!.id)

                  setSelection(null)
                }}
                disabled={!selection?.template}
              />
              <IconButton
                aria-label="Navigate to the page"
                icon={<ViewIcon />}
                onClick={() => props.onItemDoubleClick(selection?.id!)}
                disabled={!selection}
              />
            </ButtonGroup>
            <PageTree
              items={props.items}
              templates={props.templates}
              creatorFallbackTemplates={props.creatorFallbackTemplates}
              onItemSelect={onSelect}
              onItemDoubleClick={props.onItemDoubleClick}
              onItemCreate={props.onItemCreate}
              onItemDelete={props.onItemDelete}
              onItemMove={props.onItemMove}
            />
          </>
        </Box>
        <Divider orientation="vertical" />

        <Box flex={1}>
          {selection ? (
            <PageContent
              key={selection.id}
              template={selectedTemplate}
              values={{
                title: selection.jaenPageMetadata.title,
                slug: selection.slug,
                description: selection.jaenPageMetadata.description,
                excludedFromIndex: selection.excludedFromIndex
              }}
              onSubmit={handlePageUpdate}
            />
          ) : (
            <p>Select a page to view its content.</p>
          )}
        </Box>
      </Flex>
    </div>
  )
}

export default PagesTab
