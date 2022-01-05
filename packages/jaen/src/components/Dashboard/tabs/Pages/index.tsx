import {Box, Divider, Flex} from '@chakra-ui/layout'
import {CreateValues} from 'components/Dashboard/tabs/Pages/PageCreator'
import * as React from 'react'

import {TreeNode} from '../../../../utils/hooks/jaen/useJaenPageTree'
import {ContentValues, PageContent} from './PageContent'
import PageTree, {Items, PageTreeProps} from './PageTree'

export interface PagesTabProps extends PageTreeProps {
  getPage: (id: string) => TreeNode
  onPageUpdate: (id: string, values: ContentValues) => void
}

/**
 * PagesTab is a component for displaying the page tree with content in the dashboard.
 * Display PageTree and PageContent next to each other.
 */
const PagesTab = (props: PagesTabProps) => {
  const [selection, setSelection] = React.useState<TreeNode | null>(null)

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
    () =>
      props.templates.find(t => t.name === selection?.template?.name) || null,
    [props.templates, selection?.template?.name]
  )

  return (
    <div>
      <h1>PagesTab</h1>
      <Flex>
        <Box h="500" w="25%">
          <>
            <PageTree
              items={props.items}
              templates={props.templates}
              creatorFallbackTemplates={props.creatorFallbackTemplates}
              onItemSelect={onSelect}
              onItemCreate={props.onItemCreate}
              onItemDelete={props.onItemDelete}
              onItemMove={props.onItemMove}
            />
          </>
        </Box>
        <Divider orientation="vertical" />
        <Box flex={1}>
          {selection ? (
            <>
              <PageContent
                key={selection.id}
                template={selectedTemplate}
                values={{
                  title: selection.jaenPageMetadata.title,
                  slug: selection.slug,
                  description: selection.jaenPageMetadata.description
                }}
                onSubmit={handlePageUpdate}
              />
            </>
          ) : (
            <p>Select a page to view its content.</p>
          )}
        </Box>
      </Flex>
    </div>
  )
}

export default PagesTab
