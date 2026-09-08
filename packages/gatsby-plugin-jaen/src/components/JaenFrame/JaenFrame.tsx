import {Box, Flex, HStack, Icon} from '@chakra-ui/react'
import {FaPlus} from '@react-icons/all-files/fa/FaPlus'
import React from 'react'

import {Toolbar} from '../Toolbar'

import {Link} from '../../components/shared/Link'
import {JaenLogo} from '../shared/JaenLogo/JaenLogo'
import {MenuButton, MenuButtonProps} from '../shared/MenuButton/MenuButton'
import {
  Breadcrumbs,
  BreadcrumbsProps
} from './components/Breadcrumbs/Breadcrumbs'
import {DrawerLeft, DrawerLeftProps} from './components/DrawerLeft/DrawerLeft'
import {
  DrawerRight,
  DrawerRightProps
} from './components/DrawerRight/DrawerRight'
import {useJaenFrameDrawerRouter} from './drawer-state'

export interface JaenFrameProps {
  logo?: JSX.Element
  navigation: {
    isStickyDisabled?: boolean
    app: {
      navigationGroups: DrawerLeftProps['navigationGroups']
      version: DrawerLeftProps['version']
      logo: DrawerLeftProps['logo']
    }
    user: {
      user: DrawerRightProps['user']
      navigationGroups: DrawerRightProps['navigationGroups']
      isBadgeVisible: DrawerRightProps['isBadgeVisible']
    }
    addMenu: {
      items: MenuButtonProps['items']
    }
    breadcrumbs: {
      links: BreadcrumbsProps['links']
    }
  }
}

/**
 * The bar across the top of every CMS surface.
 *
 * `id="momo"` is load bearing, not decoration. The provider mounts as
 * `<ChakraProvider cssVarsRoot="#momo">`, so every Chakra custom property is
 * emitted onto that selector rather than onto `:root`. The frame renders as a
 * sibling of the page layout, which owns the only other `#momo`, so without
 * its own the header sits outside the variable scope entirely: `bg.subtle`,
 * `border.emphasized` and `brand.500` all resolve against nothing, and the
 * children that inherit from here go with it. That is what happened when this
 * header was rewritten without the id, and why the colours ended up written
 * out by hand.
 *
 * `backdropBlur` sets a custom property nobody reads: no backdrop-filter is
 * declared here, in v3 any more than in v2, so this header has never actually
 * blurred. The value only grew a unit because v3's typing insists on one.
 * Making the blur real would be a visual change rather than a migration.
 */
/**
 * The logo slot is bounded by the bar, whatever the site hands in.
 *
 * A site's Logo is an <svg> with a viewBox and width="full" height="full",
 * and the slot used to give it a width (12rem) but no height: "full" of an
 * inline link is nothing, so the height followed the aspect ratio, and a
 * crest that is taller than it is wide came out 118px tall in a 64px bar,
 * hanging over the page below. The slot is a flex box of the bar's height
 * with a little breathing room now, and the logo inside it, svg or img, is
 * sized by height with the width following, capped at the slot's width.
 * The frame never asks the site to size its own logo for the bar.
 */
const logoSlotCss = {
  display: 'flex',
  alignItems: 'center',
  height: '100%',
  paddingBlock: '0.625rem',
  '& > svg, & > img': {
    height: '100%',
    width: 'auto',
    maxWidth: '12rem'
  }
} as const

export const JaenFrame: React.FC<JaenFrameProps> = React.memo(props => {
  // The frame owns the gesture on its own two drawer buttons while a drawer
  // stands, because the page is inert then and the buttons are not reachable.
  // See drawer-state.ts for the measurement this answers.
  useJaenFrameDrawerRouter()

  return (
    <HStack
      id="momo"
      as="header"
      bg="bg.subtle"
      {...(!props.navigation.isStickyDisabled && {
        pos: 'sticky',
        top: '0',
        zIndex: 'sticky',
        transition: 'top 0.3s'
      })}
      h="16"
      px="16px"
      borderBottom="1px"
      borderColor="border.emphasized"
      backdropBlur="8px"
      justifyContent="space-between"
      zIndex="sticky">
      <HStack gap="5" w="full" h="full">
        <HStack
          h="full"
          gap="4"
          w={{
            base: '24',
            md: 'full'
          }}>
          <DrawerLeft
            navigationGroups={props.navigation.app.navigationGroups}
            version={props.navigation.app.version}
            logo={props.navigation.app.logo}
          />

          <Flex
            maxW="12rem"
            h="full"
            display={{
              base: 'none',
              md: 'flex'
            }}>
            {/* css, not sx: the prop is gone in v3, and Link's props are
                typed `any`, so leaving it would have silently restored the
                underline bar the link recipe paints in `_before`. */}
            <Link
              to="/"
              textDecoration="none"
              css={{
                ...logoSlotCss,
                _before: {
                  content: 'none'
                }
              }}>
              {props.logo || <JaenLogo />}
            </Link>
          </Flex>

          <Box
            display={{
              base: 'none',
              md: 'block'
            }}>
            <Breadcrumbs links={props.navigation.breadcrumbs.links} />
          </Box>
        </HStack>

        {/* The same logo again, centred, for the widths where the left group
            collapses to the drawer button alone. */}
        <Flex mx="auto" alignItems="center" h="full">
          <Box
            h="full"
            maxW="12rem"
            display={{
              base: 'flex',
              md: 'none'
            }}>
            <Link
              to="/"
              textDecoration="none"
              css={{
                ...logoSlotCss,
                _before: {
                  content: 'none'
                }
              }}>
              {props.logo || <JaenLogo h="full" w="auto" />}
            </Link>
          </Box>
        </Flex>

        <HStack
          gap={4}
          w={{
            base: '24',
            md: 'full'
          }}
          h="full"
          justifyContent="end">
          <Toolbar />

          {/* leftIcon is gone in v3, so the plus becomes the trigger's only
              child; the caret to its right still comes from MenuButton. */}
          <MenuButton
            display={{
              base: 'none',
              md: 'flex'
            }}
            variant="outline"
            items={props.navigation.addMenu.items}>
            <Icon color="brand.500" asChild>
              <FaPlus />
            </Icon>
          </MenuButton>

          <DrawerRight
            user={props.navigation.user.user}
            navigationGroups={props.navigation.user.navigationGroups}
            isBadgeVisible={props.navigation.user.isBadgeVisible}
          />
        </HStack>
      </HStack>
    </HStack>
  )
})

export default JaenFrame
