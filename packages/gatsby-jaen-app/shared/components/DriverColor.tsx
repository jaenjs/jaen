/**
 * A driver's colour, the same one on every screen.
 *
 * The colour is a hex string from `getDriverColor`, or undefined when the
 * driver never chose one (the backend's silver default is mapped to undefined
 * upstream on purpose, painting every row the same silver says nothing). An
 * undefined colour draws a neutral dot and a neutral border, so a list stays
 * aligned whether or not everyone has picked.
 */
import {Box, type BoxProps} from '@chakra-ui/react'

export interface DriverColorDotProps extends Omit<BoxProps, 'color'> {
  color?: string | null
  /** Token size, defaults to 3 (12px). */
  size?: BoxProps['boxSize']
}

export function DriverColorDot({color, size = '3', ...rest}: DriverColorDotProps) {
  return (
    <Box
      as="span"
      display="inline-block"
      flexShrink={0}
      boxSize={size}
      rounded="full"
      bg={color || 'border.emphasized'}
      borderWidth="1px"
      borderColor="blackAlpha.200"
      _dark={{borderColor: 'whiteAlpha.300'}}
      aria-hidden
      {...rest}
    />
  )
}

export interface DriverColorBorderProps extends Omit<BoxProps, 'color'> {
  color?: string | null
}

/**
 * A left border in the driver's colour, for a row or a card. The driver's own
 * list uses it so a ride reads as "mine" at a glance, the dispatcher's board
 * uses it to tell drivers apart without reading names.
 */
export function DriverColorBorder({color, children, ...rest}: DriverColorBorderProps) {
  return (
    <Box
      borderStartWidth="4px"
      borderStartStyle="solid"
      borderStartColor={color || 'border.emphasized'}
      {...rest}>
      {children}
    </Box>
  )
}
