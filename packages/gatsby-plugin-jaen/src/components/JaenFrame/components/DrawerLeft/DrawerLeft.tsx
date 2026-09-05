import {
  Box,
  CloseButton,
  Drawer,
  HStack,
  Icon,
  IconButton,
  Text,
  useDisclosure,
  Portal
} from '@chakra-ui/react'
import {useRef} from 'react'
import {FaBars} from '@react-icons/all-files/fa/FaBars'
import {JaenFullLogo} from '../../../shared/JaenLogo/JaenLogo'
import {
  NavigationGroups,
  NavigationGroupsProps
} from '../NavigationGroups/index'

export interface DrawerLeftProps {
  navigationGroups: NavigationGroupsProps['groups']
  logo?: JSX.Element
  version: string
}

export const DrawerLeft: React.FC<DrawerLeftProps> = ({
  navigationGroups,
  logo,
  version
}) => {
  const {open, onClose, onToggle} = useDisclosure()

  const initialFocusRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <IconButton
        aria-label="Open main menu"
        size="sm"
        onClick={onToggle}
        variant="outline">
        <Icon fontSize="lg" color="brand.500 !important" asChild>
          <FaBars />
        </Icon>
      </IconButton>
      <Drawer.Root
        placement="start"
        size="xs"
        open={open}
        initialFocusEl={() => initialFocusRef.current}
        onOpenChange={e => {
          if (!e.open) {
            onClose()
          }
        }}>
        <Portal>
          <Drawer.Backdrop bg="rgba(0,0,0,0.1)" />

          {/* v2 hung id="momo" on the portal container here, because the
              provider scoped its variables to that selector and a portal
              lands outside the header that carries it. v3 emits them globally
              behind the `jaen` prefix instead (see gatsby/wrap-root-element),
              so the drawer needs no root of its own, and v3 offers no
              containerProps to put one on either way. */}
          <Drawer.Positioner>
            <Drawer.Content borderRightRadius="xl">
              <Drawer.Header p="4">
                <HStack justifyContent="space-between">
                  {/* Bounded the same way as the bar's slot, see JaenFrame. */}
                  <Box
                    h="12"
                    maxW="12rem"
                    display="flex"
                    alignItems="center"
                    css={{'& > svg, & > img': {height: '100%', width: 'auto', maxWidth: '12rem'}}}>
                    {logo || <JaenFullLogo />}
                  </Box>
                  {/* v3's CloseTrigger renders whatever it is handed and
                      nothing otherwise, where v2's DrawerCloseButton brought
                      its own X.
                      
                      size="md", measured rather than assumed: v2's
                      DrawerCloseButton drew 40x40 here, not the 32 an earlier
                      comment claimed, and md is the 40px entry in jaen's
                      button sizes. The gray palette keeps the hover neutral
                      against the brand one the recipe pins in `base`. */}
                  <Drawer.CloseTrigger asChild pos="static" onClick={onClose}>
                    <CloseButton
                      ref={initialFocusRef}
                      size="md"
                      colorPalette="gray"
                      // v3 scales the glyph with the box and draws 20px inside
                      // a 40px button. v2 drew 16px in the same box, measured.
                      css={{'& svg': {width: '16px', height: '16px'}}}
                    />
                  </Drawer.CloseTrigger>
                </HStack>
              </Drawer.Header>
              <Drawer.Body p="4" display="flex" flexDirection="column">
                <NavigationGroups groups={navigationGroups} onClick={onClose} />
              </Drawer.Body>
              <Drawer.Footer display="flex" justifyContent="space-between">
                <JaenFullLogo h="8" w="auto" cursor="pointer" />

                {/* fg.muted, not muted: the old code named a token that has never
                    existed in this theme, so the version string rendered in the
                    inherited colour rather than the quiet one it was meant to
                    have. */}
                <Text fontSize="xs" color="fg.muted">
                  {version}
                </Text>
              </Drawer.Footer>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    </>
  )
}
