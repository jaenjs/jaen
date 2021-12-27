import {Box, Divider, Flex} from '@chakra-ui/layout'
import * as React from 'react'

import PageContent from '../../PageContent'
import PageTree from '../../PageTree'

const treeExample = {
  'SitePage /test': {
    id: 'test',
    children: [],
    data: {
      title: 'root',
      slug: 'root'
    },
    parent: null
  },
  '1-1': {
    id: '1-1',
    children: ['1-1-1', '1-1-2'],
    data: {
      title: 'First parent',
      slug: 'root1',
      locked: true,
      hasChanges: true
    },
    parent: null
  },
  '1-2': {
    id: '1-2',
    children: [],
    data: {
      title: 'Second parent',
      slug: 'root2'
    },
    parent: null
  },
  '1-1-1': {
    id: '1-1-1',
    children: [],
    data: {
      title: 'Child one',
      slug: 'root3'
    },
    parent: '1-1'
  },
  '1-1-2': {
    id: '1-1-2',
    children: [],
    data: {
      title: 'Child two',
      slug: 'root4',
      hasChanges: true
    },
    parent: '1-1'
  },
  '1-2-1': {
    id: '1-2-1',
    children: [],
    data: {
      title: 'Child three',
      slug: 'root4'
    },
    parent: '1-2'
  },
  '1-2-2': {
    id: '1-2-2',
    children: [],
    data: {
      title: 'Child four',
      slug: 'root4'
    },
    parent: '1-2'
  }
}

/**
 * PagesTab is a component for displaying the page tree with content in the dashboard.
 * Display PageTree and PageContent next to each other.
 */
const PagesTab: React.FC = () => {
  return (
    <div>
      <h1>PagesTab</h1>
      <Flex>
        <PageTree
          items={treeExample}
          rootItemIds={['SitePage /test', '1-1', '1-2']}
          defaultSelection={'1-1'}
          height={500}
          templates={['HomePage']}
          onItemSelect={() => {}}
          onItemCreate={() => {}}
          onItemDelete={() => {}}
          onItemMove={() => {}}
        />
        <Divider orientation='vertical'/>
        <Box flex={1}>
          <PageContent />
        </Box>
      </Flex>
    </div>
  )
}

export default PagesTab
