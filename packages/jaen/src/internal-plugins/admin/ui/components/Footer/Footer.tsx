/*eslint-disable*/
import {Flex, List, Text} from '@chakra-ui/react'
import React from 'react'

export default function Footer(props: any) {
  // const linkTeal = useColorModeValue("teal.400", "red.200");=
  return (
    <Flex
      flexDirection={{
        base: 'column',
        xl: 'row'
      }}
      alignItems={{
        base: 'center',
        xl: 'start'
      }}
      justifyContent="space-between"
      px="30px"
      pb="20px">
      <Text
        color="gray.400"
        textAlign={{
          base: 'center',
          xl: 'start'
        }}
        mb={{base: '20px', xl: '0px'}}>
        &copy; {new Date().getFullYear()}{' '}
        <Text as="span">
          {document.documentElement.dir === 'rtl'
            ? ' مصنوع من ❤️ بواسطة'
            : 'snek'}
        </Text>
      </Text>
      <List display="flex"></List>
    </Flex>
  )
}
