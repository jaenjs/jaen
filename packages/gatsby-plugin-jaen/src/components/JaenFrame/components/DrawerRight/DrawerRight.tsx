import {useColorMode} from 'jaen'
import {
  Avatar,
  Box,
  CloseButton,
  Drawer,
  HStack,
  Icon,
  IconButton,
  Spacer,
  Stack,
  Text,
  useDisclosure,
  Portal
} from '@chakra-ui/react'
import {useRef} from 'react'
import {FaMoon} from '@react-icons/all-files/fa/FaMoon'
import {FaSun} from '@react-icons/all-files/fa/FaSun'

import {
  NavigationGroups,
  NavigationGroupsProps
} from '../NavigationGroups/index'

export interface DrawerRightProps {
  user: {
    username: string
    firstName?: string
    lastName?: string
    avatarURL?: string
  }
  navigationGroups: NavigationGroupsProps['groups']

  isBadgeVisible?: boolean
}

export const DrawerRight: React.FC<DrawerRightProps> = ({
  navigationGroups,
  user,
  isBadgeVisible
}) => {
  const {open, onClose, onToggle} = useDisclosure()

  const initialFocusRef = useRef<HTMLButtonElement>(null)

  const colorMode = useColorMode()

  return (
    <>
      {/* No fallback initials to compute: Chakra derives them from `name`,
          which is the same username the replaced code was splitting by hand. */}
      <Avatar.Root
        as="button"
        aria-label="Open user menu"
        p="0"
        m="0"
        size="sm"
        cursor="pointer"
        onClick={onToggle}>
        <Avatar.Fallback name={user.username} />
        <Avatar.Image src={user.avatarURL} />

        {/* v3 has no AvatarBadge, and Float, the pattern that replaces it,
            hangs the dot half outside the avatar where v2's badge sat a
            quarter outside. The v2 geometry, including the ring colour the
            avatar theme used to supply, is written out so the badge does not
            move. */}
        <Box
          pos="absolute"
          bottom="0"
          insetEnd="0"
          boxSize="1.25em"
          bg="pink.500"
          rounded="full"
          border="0.2em solid"
          // bg.subtle is the bar's own surface in both modes, white and jaen's
          // gray.800, the literals that stood here.
          borderColor={{base: 'white', _dark: 'bg.subtle'}}
          transform="translate(25%, 25%)"
          visibility={isBadgeVisible ? 'visible' : 'hidden'}
        />
      </Avatar.Root>
      <Drawer.Root
        placement="end"
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

          {/* No id="momo" on the portal any more, for the reason spelled out
              in DrawerLeft: v3 emits the variables globally. */}
          <Drawer.Positioner>
            <Drawer.Content borderLeftRadius="xl">
              <Drawer.Header p="4">
                <HStack justifyContent="space-between">
                  <Stack>
                    <HStack>
                      <Avatar.Root size="sm">
                        <Avatar.Fallback name={user.username} />
                        <Avatar.Image src={user.avatarURL} />
                      </Avatar.Root>
                      <Stack gap="0.5">
                        <Text fontSize="sm" fontWeight="bold" lineHeight="none">
                          {user.username}
                        </Text>
                        <Text fontSize="sm" color="fg.muted" lineHeight="none">
                          {user.firstName} {user.lastName}
                        </Text>
                      </Stack>
                    </HStack>
                  </Stack>

                  {/* Same as DrawerLeft: v3's CloseTrigger draws nothing of
                      its own, so the X v2's DrawerCloseButton carried has to
                      be handed to it. */}
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
                <Spacer />
              </Drawer.Body>

              {/* The colour-mode switch. It went missing with the rewrite, which
                  is why dark mode has been unreachable ever since even though the
                  theme carries a _dark value for every semantic token. */}
              <Drawer.Footer>
                <IconButton
                  size="sm"
                  variant="outline"
                  onClick={colorMode.toggleColorMode}
                  aria-label="Toggle color mode">
                  <Icon
                    as={colorMode.colorMode === 'light' ? FaSun : FaMoon}
                    color="brand.500"
                  />
                </IconButton>
              </Drawer.Footer>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    </>
  )
}
