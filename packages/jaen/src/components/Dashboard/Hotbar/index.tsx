import {Flex, Box, Spacer, HStack} from '@chakra-ui/react'
import * as React from 'react'

const Hotbar: React.FC<{
  startItems: JSX.Element[]
  endItems: JSX.Element[]
}> = ({startItems, endItems}) => {
  return (
    <Flex>
      <HStack>
        {startItems.map((item, index) => (
          <Box key={index}>{item}</Box>
        ))}
      </HStack>
      <Spacer />
      <HStack>
        {endItems.map((item, index) => (
          <Box key={index}>{item}</Box>
        ))}
      </HStack>
    </Flex>
  )
}

// Get type of Hotbar props
export type HotbarProps = React.ComponentProps<typeof Hotbar>

export default Hotbar
