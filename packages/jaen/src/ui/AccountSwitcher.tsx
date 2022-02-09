import {
  Menu,
  MenuDivider,
  MenuItem,
  MenuItemOption,
  MenuList,
  MenuOptionGroup,
  Text,
  useColorModeValue
} from '@chakra-ui/react'
import {Link, navigate} from 'gatsby'
import * as React from 'react'
import {AccountSwitcherButton} from './components/AccountSwitcherButton'

export const AccountSwitcher = () => {
  const handleSignOut = () => {}
  const handleHelpClick = () => {}

  const email = 'nicoschett@icloud.com'

  return (
    <Menu>
      <AccountSwitcherButton
        name="Nico Schett"
        imageSrc="https://images.unsplash.com/photo-1564564321837-a57b7070ac4f?ixid=MXwxMjA3fDB8MHxzZWFyY2h8MzV8fG1hbiUyMHNpbWxpbmd8ZW58MHx8MHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=100"
      />
      <MenuList
        fontSize={'sm'}
        shadow="md"
        py="4"
        color={useColorModeValue('gray.600', 'gray.200')}
        px="3">
        <Text fontWeight="medium" mb="2">
          {email}
        </Text>
        <MenuDivider />
        <MenuItem rounded="md" onClick={() => navigate('/jaen/admin')}>
          Admin
        </MenuItem>
        <MenuItem
          rounded="md"
          onClick={() => navigate('/jaen/admin#/settings')}>
          Settings
        </MenuItem>
        <MenuDivider />
        <MenuItem rounded="md">Help</MenuItem>
        <MenuItem rounded="md">Logout</MenuItem>
      </MenuList>
    </Menu>
  )
}
