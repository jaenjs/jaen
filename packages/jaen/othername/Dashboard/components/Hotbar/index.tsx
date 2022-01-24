import {Box, Flex, HStack, Spacer} from '@chakra-ui/react'
import * as React from 'react'

export interface HotbarProps {
  startItems: JSX.Element[]
  endItems: JSX.Element[]
}

const Hotbar: React.FC<HotbarProps> = ({startItems, endItems}) => {
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

export default Hotbar
