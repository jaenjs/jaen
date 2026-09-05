import {Box, BoxProps} from '@chakra-ui/react'

// bg.subtle is gray.50 in light and bg.muted gray.700 in dark, the two
// literals this used to name, so jaen renders as before and a site's own dark
// surfaces reach the placeholder.
export const Placeholder: React.FC<BoxProps> = props => (
  <Box
    bg={{base: 'bg.subtle', _dark: 'bg.muted'}}
    width="full"
    height="32"
    rounded="xl"
    {...props}
  />
)
