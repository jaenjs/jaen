/**
 * The one heading every app screen starts with.
 *
 * Before this, every view drew its own: a Heading of one size here, another
 * there, a subtitle under some, the actions wrapped in a different Flex on
 * each screen, and the shell added a title bar under the frame that repeated
 * the word. The frame is the chrome, this is the title, and it looks the same
 * on every screen.
 *
 * The size is Chakra's 2xl text style, pinned as a style prop on purpose:
 * jaen's heading recipe remaps the `size` axis to v2's scale (size 2xl is
 * fontSize 7xl there, size md is 4xl), which is how the board's title came to
 * be 72px tall under a 4rem bar. A style prop is merged over the recipe, so
 * the title is 24px whichever recipe is in scope.
 *
 * The horizontal rhythm is the board's: the view's outer box carries
 * `p={{base: '4', md: '6'}} maxW="full"`, and the header sits inside it as
 * the first child, without padding of its own and without a maxW. Actions go
 * to the end of the line, the subtitle under the title in fg.muted, and
 * `meta` (a status badge, chips) under both. `leading` is an avatar or the
 * like before the title.
 *
 * The action row wraps, at every width (design-consistency.md rule 13). Owner,
 * 2026-09-08: "Transferdetails, wenn das Fenster auf halber Breite ist, Bug".
 * The row used to be `flexShrink={0}` with `w={{base: 'full', md: 'auto'}}`,
 * and those two together are what broke a window at half a desktop screen. A
 * flex item that may not shrink is laid out at its max-content width, which
 * for a wrapping row is every button on one line, and `flexWrap` then never
 * gets a chance to wrap: the row stays as wide as its buttons, the title
 * beside it shrinks to nothing first, and the rest leaves the page. The
 * transfer detail's seven actions measured 1053 px on the live booklimo.at,
 * so at 768 "Stornieren" stood 321 px past the window's right edge, at 900
 * 189 px and at 1024 65 px, and because the app's body is `overflow-x: clip`
 * (rule 12) they were not merely off screen, they were cut away with no way
 * to scroll to them. Below `md` the same row was `w="full"`, which is a
 * stretched item rather than a max-content one, which is exactly why the
 * phone was always right.
 *
 * So the row shrinks like any other flex item and wraps into as many lines as
 * it needs, right aligned. The title takes the rest and keeps a floor of 14rem
 * from `md` up, because two shrinkable items share a shortfall in proportion
 * to their content and the title, being the shorter of the two, would
 * otherwise be squeezed to a couple of characters while the buttons kept
 * nearly all their width.
 */
import React from 'react'
import {Box, Flex, Heading, HStack, Text} from '@chakra-ui/react'

export interface PageHeaderProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Buttons, at the end of the line, wrapping under the title on a phone. */
  actions?: React.ReactNode
  /** Something before the title, an avatar. */
  leading?: React.ReactNode
  /** Under the title and the subtitle: badges, chips. */
  meta?: React.ReactNode
  /** Monospace title, for a code. */
  mono?: boolean
}

export function PageHeader({
  title,
  subtitle,
  actions,
  leading,
  meta,
  mono = false
}: PageHeaderProps) {
  return (
    <Flex
      as="header"
      justify="space-between"
      align={{base: 'flex-start', md: 'center'}}
      direction={{base: 'column', md: 'row'}}
      gap="3"
      w="full">
      <HStack
        gap="4"
        align="center"
        flex={{md: '1 1 auto'}}
        minW={{base: '0', md: '56'}}>
        {leading}
        <Box minW="0">
          <Heading
            as="h1"
            textStyle="2xl"
            fontWeight="semibold"
            letterSpacing="normal"
            lineHeight="1.25"
            fontFamily={mono ? 'mono' : undefined}
            overflowWrap="anywhere">
            {title}
          </Heading>
          {subtitle ? (
            <Text color="fg.muted" mt="1">
              {subtitle}
            </Text>
          ) : null}
          {meta ? (
            <HStack mt="2" gap="2" flexWrap="wrap">
              {meta}
            </HStack>
          ) : null}
        </Box>
      </HStack>
      {actions ? (
        <HStack
          gap="2"
          flexWrap="wrap"
          minW="0"
          justify={{base: 'flex-start', md: 'flex-end'}}
          w={{base: 'full', md: 'auto'}}>
          {actions}
        </HStack>
      ) : null}
    </Flex>
  )
}
