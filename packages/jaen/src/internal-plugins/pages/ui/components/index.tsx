import {
  Button,
  ButtonGroup,
  Circle,
  Drawer,
  DrawerContent,
  DrawerOverlay,
  IconButton
} from '@chakra-ui/react'
import {navigate} from 'gatsby'
import * as React from 'react'
import {FiEye, FiTrash} from 'react-icons/fi'

import SidebarWithHeader, {SidebarItemKeys} from './SidebarWithHeader'

const Dashboard: React.FC<{
  tabs: {
    [key: string]: {
      name: string
      icon: any
      element: React.ReactNode
    }
  }
  isOpen: boolean
  isEditing: boolean
  onClose: () => void
  /**
   * The callback to be called when the user clicks the editing button.
   */
  onEditingMode: () => void
  /**
   * The callback to be called when the user clicks the discard button.
   */
  onDiscardChanges: () => void
  /**
   * The callback to be called when the user clicks the publish button.
   */
  onPublish: () => void
}> = ({
  tabs,
  isEditing,
  isOpen,
  onClose,
  onEditingMode,
  onDiscardChanges,
  onPublish
}) => {
  const btnRef = React.useRef<any>(null)

  const sidebarItems = React.useMemo(
    () =>
      Object.fromEntries(
        Object.entries(tabs).map(([k, {element, ...v}]) => [k, v])
      ),
    [tabs]
  )

  const defaultSidebarItem = React.useMemo(() => Object.keys(tabs)[0], [tabs])

  const [selectedTab, setSelectedTab] = React.useState<SidebarItemKeys | null>(
    defaultSidebarItem
  )

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
        <SidebarWithHeader
          onCloseDashboard={onClose}
          defaultSidebarItem={defaultSidebarItem}
          sidebarItems={sidebarItems}
          onSidebarItemClick={id => setSelectedTab(id)}
          hotbar={{
            startItems: [
              <Button leftIcon={<FiEye />} onClick={() => navigate('/')}>
                Home
              </Button>,
              <ButtonGroup isAttached variant="outline">
                <Button
                  mr="-px"
                  leftIcon={
                    <Circle
                      size="4"
                      bg={isEditing ? 'orange' : 'gray.300'}
                      color="white"
                    />
                  }
                  onClick={onEditingMode}>
                  Edit
                </Button>
                <IconButton
                  aria-label="Add to friends"
                  icon={<FiTrash color="orange" />}
                  onClick={onDiscardChanges}
                />
              </ButtonGroup>
            ],
            endItems: [
              <Button variant="outline" onClick={() => onPublish()}>
                Publish
              </Button>
            ]
          }}>
          {selectedTab ? tabs[selectedTab].element : <p>Default tab.</p>}
        </SidebarWithHeader>
      </DrawerContent>
    </Drawer>
  )
}

export default React.memo(Dashboard)
