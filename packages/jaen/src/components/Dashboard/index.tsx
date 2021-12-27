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

import PageContent from './PageContent'
import PageTree from './PageTree'
import SidebarWithHeader from './SidebarWithHeader'

const Dashboard: React.FC<{
  /**
   * The callback to be called when the user clicks the editing button.
   */
  onEditingMode: () => void
  /**
   * The callback to be called when the user clicks the discard button.
   */
  onDiscardChanges: () => void
  onPublish: () => void
}> = () => {
  const {isOpen, onOpen, onClose} = useDisclosure()
  const btnRef = React.useRef<any>(null)

  return (
    <>
      <Button ref={btnRef} colorScheme="teal" onClick={onOpen}>
        Open
      </Button>
      <Drawer
        isFullHeight={true}
        isOpen={true}
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
                  rootItemIds={['SitePage /test', '1-1', '1-2']}
                  defaultSelection={'1-1'}
                  height={500}
                  templates={['HomePage']}
                  onItemSelect={() => {}}
                  onItemCreate={() => {}}
                  onItemDelete={() => {}}
                  onItemMove={() => {}}
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
                <PageContent />
              </Box>
            </Flex>
          </SidebarWithHeader>
        </DrawerContent>
      </Drawer>
    </>
  )
}

export default Dashboard
