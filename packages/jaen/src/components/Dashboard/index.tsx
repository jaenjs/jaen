import {
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  useDisclosure
} from '@chakra-ui/react'
import {FocusableElement} from '@chakra-ui/utils'
import * as React from 'react'

import {ContentValues, PageContent} from './PageContent'
import {CreateValues} from './PageCreator'
import PageTree from './PageTree'
import SidebarWithHeader from './SidebarWithHeader'

const Dashboard: React.FC<{
  isOpen: boolean
  onClose: () => void
  /**
   * The callback to be called when the user clicks the editing button.
   */
  onEditingMode: () => void
  /**
   * The callback to be called when the user clicks the discard button.
   */
  onDiscardChanges: () => void
  onPublish: () => void
  onPageCreate: (parentId: string | null, values: CreateValues) => void
  onPageDelete: (id: string) => void
  onPageMove: (
    id: string,
    oldParentId: string | null,
    newParentId: string | null
  ) => void
  onPageUpdate: (id: string, values: ContentValues) => void
}> = ({
  isOpen,
  onClose,
  onEditingMode,
  onDiscardChanges,
  onPublish,
  onPageCreate,
  onPageDelete,
  onPageMove,
  onPageUpdate
}) => {
  const btnRef = React.useRef<any>(null)

  return (
    <Drawer
      isFullHeight={true}
      isOpen={isOpen}
      placement="right"
      size="6xl"
      onClose={onClose}
      finalFocusRef={btnRef}>
      <DrawerOverlay />
      <DrawerContent>
        <SidebarWithHeader onCloseDashboard={onClose}>
          <Flex>
            <Box bg="white">
              <PageTree
                defaultSelection={'1-1'}
                height={500}
                templates={[
                  {
                    name: 'HomePage',
                    displayName: 'Home'
                  }
                ]}
                onItemSelect={() => {}}
                onItemCreate={onPageCreate}
                onItemDelete={onPageDelete}
                onItemMove={onPageMove}
                items={
                  {
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
                  } as any
                }
              />
            </Box>

            <Box flex="1">
              <PageContent
                template={{
                  name: 'page',
                  displayName: 'Page'
                }}
                values={{
                  slug: '',
                  title: '',
                  description: ''
                }}
                onSubmit={() => {}}
              />
            </Box>
          </Flex>
        </SidebarWithHeader>
      </DrawerContent>
    </Drawer>
  )
}

export default React.memo(Dashboard)
