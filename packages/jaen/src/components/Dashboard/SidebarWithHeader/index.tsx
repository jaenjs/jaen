import {
  IconButton,
  Avatar,
  Box,
  CloseButton,
  Flex,
  HStack,
  VStack,
  Icon,
  useColorModeValue,
  Link,
  Drawer,
  DrawerContent,
  Text,
  useDisclosure,
  BoxProps,
  FlexProps,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Spacer,
  useBreakpointValue,
  Button,
  Divider,
  ButtonGroup,
  IconProps
} from '@chakra-ui/react'
import React, {ReactNode} from 'react'
import {ReactText} from 'react'
import {IconType} from 'react-icons'
import {FiTrash, FiMenu, FiBell, FiChevronDown} from 'react-icons/fi'

export interface LinkItemProps {
  name: string
  icon: IconType
  onClick: () => void
}

export interface SidebarWithHeaderProps {
  sidebarItems: SidebarProps['sidebarItems']
  defaultSidebarItem?: SidebarItemKeys
  onSidebarItemClick: (id: SidebarItemKeys | null) => void
  onCloseDashboard: () => void
}

export const SidebarWithHeader: React.FC<SidebarWithHeaderProps> = ({
  sidebarItems,
  children,
  onSidebarItemClick,
  onCloseDashboard
}) => {
  const {isOpen, onOpen, onClose} = useDisclosure()
  return (
    <Box minH="100vh" bg={useColorModeValue('gray.100', 'gray.900')}>
      <SidebarContent
        sidebarItems={sidebarItems}
        onSidebarItemClick={onSidebarItemClick}
        onClose={() => onClose}
        display={{base: 'none', md: 'block'}}
      />
      <Drawer
        autoFocus={false}
        isOpen={isOpen}
        placement="left"
        onClose={onClose}
        returnFocusOnClose={false}
        onOverlayClick={onClose}
        size="full">
        <DrawerContent>
          <SidebarContent
            sidebarItems={sidebarItems}
            onSidebarItemClick={onSidebarItemClick}
            onClose={onClose}
          />
        </DrawerContent>
      </Drawer>
      <Nav onOpen={onOpen} onCloseDashboard={onCloseDashboard} />
      <Box ml={{base: 0, md: 60}} p="4">
        {children}
      </Box>
    </Box>
  )
}

export default SidebarWithHeader

export type SidebarItemKeys = keyof SidebarProps['sidebarItems']

interface SidebarProps extends BoxProps {
  sidebarItems: {
    [id: string]: {
      name: string
      icon: any
    }
  }
  defaultSidebarItem?: SidebarItemKeys
  onSidebarItemClick: (id: SidebarItemKeys | null) => void
  onClose: () => void
}

const SidebarContent = ({
  onClose,
  onSidebarItemClick,
  sidebarItems,
  ...rest
}: SidebarProps) => {
  const [selectedItem, setSelectedItem] = React.useState<
    keyof SidebarProps['sidebarItems'] | null
  >(null)

  const selectItem = (id: string | null) => {
    if (id === selectedItem) {
      id = null
    }

    setSelectedItem(id)
    onSidebarItemClick(id)
  }

  return (
    <Box
      transition="3s ease"
      bg={useColorModeValue('white', 'gray.900')}
      borderRight="1px"
      borderRightColor={useColorModeValue('gray.200', 'gray.700')}
      w={{base: 'full', md: 60}}
      pos="fixed"
      h="full"
      {...rest}>
      <Flex h="20" alignItems="center" mx="8" justifyContent="space-between">
        <Text fontSize="2xl" fontFamily="monospace" fontWeight="bold">
          Jaen Logo
        </Text>
        <CloseButton display={{base: 'flex', md: 'none'}} onClick={onClose} />
      </Flex>

      {Object.keys(sidebarItems).map(id => {
        const {name, icon} = sidebarItems[id]
        return (
          <NavItem
            key={id}
            icon={icon}
            onClick={() => selectItem(id)}
            selected={selectedItem === id}>
            {name}
          </NavItem>
        )
      })}

      <Spacer />
      <a onClick={onClose}>Leave dashboard</a>
    </Box>
  )
}

interface NavItemProps extends FlexProps {
  selected: boolean
  icon: any
  children: ReactText
  onClick: () => void
}
const NavItem = ({
  selected,
  icon,
  children,
  onClick,
  ...rest
}: NavItemProps) => {
  return (
    <Box style={{textDecoration: 'none'}} onClick={onClick}>
      <Flex
        align="center"
        p="4"
        mx="4"
        borderRadius="lg"
        role="group"
        cursor="pointer"
        _hover={{
          bg: 'cyan.400',
          color: 'white'
        }}
        bg={selected ? 'cyan.400' : undefined}
        color={selected ? 'white' : undefined}
        {...rest}>
        {icon && (
          <Icon
            mr="4"
            fontSize="16"
            _groupHover={{
              color: 'white'
            }}
            as={icon}
          />
        )}
        {children}
      </Flex>
    </Box>
  )
}

interface MobileProps extends FlexProps {
  onOpen: () => void
  onCloseDashboard: () => void
}
const Nav = ({onOpen, onCloseDashboard, ...rest}: MobileProps) => {
  const closeButton = <CloseButton onClick={onCloseDashboard} />

  const hotbar = (
    <Flex h="20" alignItems="center" mx="8" justifyContent="space-between">
      <ButtonGroup isAttached variant="outline">
        <Button mr="-px">Edit</Button>
        <IconButton
          aria-label="Add to friends"
          icon={<FiTrash color="orange" />}
        />
      </ButtonGroup>
      <Button variant="outline">Publish</Button>
    </Flex>
  )

  const mobile = (
    <Flex
      px={{base: 4}}
      height="20"
      alignItems="center"
      bg={useColorModeValue('white', 'gray.900')}
      borderBottomWidth="1px"
      borderBottomColor={useColorModeValue('gray.200', 'gray.700')}
      justifyContent={{base: 'space-between'}}
      {...rest}>
      <IconButton
        display={{base: 'flex'}}
        onClick={onOpen}
        variant="outline"
        aria-label="open menu"
        icon={<FiMenu />}
      />
      <Text
        display={{base: 'flex'}}
        fontSize="2xl"
        fontFamily="monospace"
        fontWeight="bold">
        Jaen Logo
      </Text>
      <HStack spacing={{base: '0'}}>login</HStack>
    </Flex>
  )

  const desktop = (
    <Flex
      ml={{base: 0, md: 60}}
      px={{md: 4}}
      height="20"
      alignItems="center"
      bg={useColorModeValue('white', 'gray.900')}
      borderBottomWidth="1px"
      borderBottomColor={useColorModeValue('gray.200', 'gray.700')}
      {...rest}>
      <Box>
        {hotbar}
        <Divider />
      </Box>
      <Spacer />
      <HStack spacing={{md: '6'}}>
        {' '}
        <IconButton
          size="lg"
          variant="ghost"
          aria-label="open menu"
          icon={<FiBell />}
        />
        <Flex alignItems={'center'}>
          <Menu>
            <MenuButton
              py={2}
              transition="all 0.3s"
              _focus={{boxShadow: 'none'}}>
              <HStack>
                <Text fontSize="sm">Emilia Clarke</Text>

                <Box display={{base: 'none', md: 'flex'}}>
                  <FiChevronDown />
                </Box>
              </HStack>
            </MenuButton>
            <MenuList
              bg={useColorModeValue('white', 'gray.900')}
              borderColor={useColorModeValue('gray.200', 'gray.700')}>
              <MenuItem>Help</MenuItem>
              <MenuDivider />
              <MenuItem>Sign out</MenuItem>
            </MenuList>
          </Menu>
        </Flex>
      </HStack>
    </Flex>
  )

  const nav = useBreakpointValue({
    base: mobile,
    md: desktop
  })

  return <>{nav}</>
}
