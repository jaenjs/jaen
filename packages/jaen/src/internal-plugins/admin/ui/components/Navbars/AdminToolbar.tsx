import {
  Box,
  Button,
  ButtonGroup,
  Circle,
  Flex,
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Stack,
  Text,
  useColorModeValue
} from '@chakra-ui/react'
import {FiChevronDown} from '@react-icons/all-files/fi/FiChevronDown'
import {FiHome} from '@react-icons/all-files/fi/FiHome'
import {FiTrash} from '@react-icons/all-files/fi/FiTrash'
import {Link} from 'gatsby'
import {SearchBar} from './SearchBar/SearchBar'
export default function AdminToolbar() {
  // check if current path is /jaen/admin, if so lower the z-index
  const isAdmin = window.location.pathname.includes('/jaen/admin')

  return (
    <Box position={'sticky'} top="0" zIndex={'banner'}>
      <Flex
        bg={useColorModeValue('gray.800', 'gray.800')}
        color={useColorModeValue('white', 'white')}
        minH={'20px'}
        py={{base: 2}}
        px={{base: 4}}
        borderBottom={1}
        borderStyle={'solid'}
        borderColor={useColorModeValue('gray.200', 'gray.900')}
        align={'center'}>
        <Flex flex={{base: 1}} justify={{base: 'center', md: 'start'}}>
          <Text textAlign={'left'} fontFamily={'heading'}>
            <Link to="/jaen/admin#/dashboard">Jaen</Link>
          </Text>

          <Flex display={{base: 'none', md: 'flex'}} ml={10}>
            <HStack spacing={2}>
              <Button size="xs" variant={'darkghost'} leftIcon={<FiHome />}>
                <Link to="/">AGT Guntrade</Link>
              </Button>
              <ButtonGroup isAttached variant="outline" size="xs">
                <Button
                  mr="-px"
                  variant={'darkghost'}
                  leftIcon={
                    <Circle
                      size="4"
                      bg={true ? 'orange' : 'gray.300'}
                      color="white"
                    />
                  }>
                  Edit
                </Button>
                <IconButton
                  variant={'darkghost'}
                  aria-label="Add to friends"
                  icon={<FiTrash color="orange" />}
                />
              </ButtonGroup>
              <Button size="xs" variant={'darkghost'}>
                Publish
              </Button>
            </HStack>
          </Flex>
        </Flex>

        <Flex display={{base: 'none', md: 'flex'}} justify={'flex-end'} ml={10}>
          <HStack spacing={2}>
            <SearchBar />
            <Menu size="sm">
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
                bg={'gray.900'}
                borderColor={'gray.700'}
                fontSize={'sm'}>
                <Link to="/jaen/admin#/dashboard">
                  <MenuItem
                    _focus={{bg: 'gray.8000'}}
                    _hover={{bg: 'gray.800'}}>
                    Admin
                  </MenuItem>
                </Link>
                <MenuItem _focus={{bg: 'gray.8000'}} _hover={{bg: 'gray.800'}}>
                  Help
                </MenuItem>
                <MenuDivider />
                <MenuItem _focus={{bg: 'gray.8000'}} _hover={{bg: 'gray.800'}}>
                  Sign out
                </MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </Flex>

        <Stack
          flex={{base: 1, md: 0}}
          justify={'flex-end'}
          direction={'row'}
          spacing={6}>
          foo
        </Stack>
      </Flex>
    </Box>
  )
}

const DesktopNav = () => {
  const linkColor = useColorModeValue('gray.600', 'gray.200')
  const linkHoverColor = useColorModeValue('gray.800', 'white')
  const popoverContentBgColor = useColorModeValue('white', 'gray.800')

  return <Flex></Flex>
}

const MobileNav = () => {
  return (
    <Stack
      bg={useColorModeValue('white', 'gray.800')}
      p={1}
      display={{md: 'none'}}>
      <Text>
        Not supported yet. Please use the desktop version of the site.
      </Text>
    </Stack>
  )
}

interface NavItem {
  label: string
  subLabel?: string
  children?: Array<NavItem>
  href?: string
}

const NAV_ITEMS: Array<NavItem> = [
  {
    label: 'Inspiration',
    children: [
      {
        label: 'Explore Design Work',
        subLabel: 'Trending Design to inspire you',
        href: '#'
      },
      {
        label: 'New & Noteworthy',
        subLabel: 'Up-and-coming Designers',
        href: '#'
      }
    ]
  },
  {
    label: 'Find Work',
    children: [
      {
        label: 'Job Board',
        subLabel: 'Find your dream design job',
        href: '#'
      },
      {
        label: 'Freelance Projects',
        subLabel: 'An exclusive list for contract work',
        href: '#'
      }
    ]
  },
  {
    label: 'Learn Design',
    href: '#'
  },
  {
    label: 'Hire Designers',
    href: '#'
  }
]
