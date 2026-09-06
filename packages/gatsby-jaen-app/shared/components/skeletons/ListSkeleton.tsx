/**
 * Rows of cards before they are there: the board's cards below `md`, the
 * users and the fleet as cards, the dashboard's two day lists.
 *
 * Each row is the card's frame, the driver stripe on the left in the
 * skeleton's grey, and inside it an avatar circle when the rows are people
 * and two lines of grey, one short and bold, one longer and muted, the shape
 * a card's title and its second line make.
 */
import {Box, HStack, Skeleton, SkeletonCircle, Stack, type StackProps} from '@chakra-ui/react'

export interface ListSkeletonProps extends StackProps {
  /** How many rows, six by default. */
  rows?: number
  /** A circle before the lines, for a list of people or cars. */
  avatar?: boolean
  /** The height of one row, `16` (64 px) by default, a card's two lines. */
  rowHeight?: StackProps['h']
}

export function ListSkeleton({rows = 6, avatar = false, rowHeight = '16', ...rest}: ListSkeletonProps) {
  return (
    <Stack gap="3" data-skeleton="list" aria-busy="true" {...rest}>
      {Array.from({length: rows}, (_, i) => (
        <Box
          key={i}
          h={rowHeight}
          rounded="lg"
          borderWidth="1px"
          borderColor="border.default"
          borderInlineStartWidth="4px"
          borderInlineStartColor="bg.emphasized"
          bg="bg.surface"
          px="3"
          display="flex"
          alignItems="center">
          <HStack gap="3" w="full">
            {avatar && <SkeletonCircle size="10" flexShrink={0} />}
            <Stack gap="2" flex="1">
              <Skeleton h="4" w={i % 2 ? '40%' : '32%'} rounded="sm" />
              <Skeleton h="3" w={i % 3 ? '60%' : '72%'} rounded="sm" />
            </Stack>
          </HStack>
        </Box>
      ))}
    </Stack>
  )
}
