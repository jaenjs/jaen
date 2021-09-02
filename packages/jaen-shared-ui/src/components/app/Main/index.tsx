import {
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  Divider,
  Box,
  useDisclosure,
  Portal
} from '@chakra-ui/react'
import React, {useRef} from 'react'

import {JaenToggleButton, SnekButton} from '../../molecules/buttons'
import {
  HeaderMain,
  HotbarMain,
  FooterMain,
  HotbarMainProps,
  TabsMainProps,
  TabsMain,
  LoginMain,
  LoginMainProps,
  HeaderMainProps
} from '../../organisms/main'

export type MainProps = {
  hotbar: HotbarMainProps
  tabs: TabsMainProps
  authenticated: boolean
  login: LoginMainProps
  header: HeaderMainProps
}

const Main: React.FC<MainProps> = props => {
  const {isOpen, onOpen, onClose} = useDisclosure()
  const btnRef = useRef<HTMLButtonElement | null>()

  return (
    <>
      <Box pos="fixed" bottom={5} right={5} ref={btnRef as any}>
        <JaenToggleButton ref={btnRef as any} onClick={onOpen} />
      </Box>
      <Drawer
        placement="right"
        size="6xl"
        isOpen={isOpen}
        onClose={onClose}
        finalFocusRef={btnRef as any}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />

          {props.authenticated ? (
            <>
              <DrawerHeader>
                <HeaderMain {...props.header} />
              </DrawerHeader>
              <Divider />
              <DrawerBody pd={0} mt={2}>
                <HotbarMain {...props.hotbar} />
                <TabsMain {...props.tabs} />
              </DrawerBody>
              <Divider />
              <DrawerFooter py={2}>
                <FooterMain />
              </DrawerFooter>
            </>
          ) : (
            <>
              <DrawerHeader>
                <SnekButton />
              </DrawerHeader>
              <DrawerBody pd={0} mt={2}>
                <LoginMain {...props.login} />
              </DrawerBody>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </>
  )
}

export default Main