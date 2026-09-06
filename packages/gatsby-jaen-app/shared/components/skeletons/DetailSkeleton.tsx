/**
 * A detail page before its row is there: the way back, the heading with its
 * subtitle, and the cards the page will draw, each with a title and three
 * label and value lines. The ride, the account and the booking pages all
 * have this shape, and the skeleton is theirs in grey so the page that lands
 * does not jump.
 */
import {Box, HStack, Skeleton, SkeletonCircle, Stack} from '@chakra-ui/react'

export interface DetailSkeletonProps {
  /** How many cards under the heading, three by default. */
  cards?: number
  /** A circle before the title, the account's avatar. */
  avatar?: boolean
  /** A line for the button back to the list. */
  back?: boolean
}

export function DetailSkeleton({cards = 3, avatar = false, back = false}: DetailSkeletonProps) {
  return (
    <Stack gap="6" p={{base: '4', md: '6'}} maxW="full" data-skeleton="detail" aria-busy="true">
      {back && <Skeleton h="8" w="36" rounded="md" />}
      <HStack gap="4" align="center">
        {avatar && <SkeletonCircle size="16" flexShrink={0} />}
        <Stack gap="2" flex="1">
          <Skeleton h="7" w={{base: '60%', md: '64'}} rounded="md" />
          <Skeleton h="4" w={{base: '40%', md: '40'}} rounded="sm" />
        </Stack>
      </HStack>
      {Array.from({length: cards}, (_, i) => (
        <Box key={i} rounded="lg" borderWidth="1px" borderColor="border.default" bg="bg.surface" p="4">
          <Skeleton h="5" w="40" rounded="sm" mb="4" />
          <Stack gap="3">
            {[0, 1, 2].map(r => (
              <HStack key={r} gap="4">
                <Skeleton h="4" w="24" rounded="sm" flexShrink={0} />
                <Skeleton h="4" w={r === 1 ? '50%' : '35%'} rounded="sm" />
              </HStack>
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  )
}
