import {
  Box,
  Button,
  Heading,
  SimpleGrid,
  Text,
  useColorModeValue,
  VisuallyHidden
} from '@chakra-ui/react'
import * as React from 'react'
import {FaFacebook, FaGithub, FaGoogle} from 'react-icons/fa'
import {JaenLogo} from '../icons'
import {Card} from './Card'
import {DividerWithText} from './DividerWithText'
import {Link} from './Link'
import {LoginForm} from './LoginForm'
import {Logo} from './Logo'

export interface AdminLoginProps {
  onLogin: (email: string, password: string) => void
  onLiveDemo: () => void
}

export const AdminLogin = (props: AdminLoginProps) => (
  <Box
    bg={useColorModeValue('gray.50', 'inherit')}
    minH="100vh"
    py="12"
    px={{base: '4', lg: '8'}}>
    <Box maxW="md" mx="auto">
      <JaenLogo
        mx={'auto'}
        boxSize={'16'}
        display={'block'}
        mb={{base: '10', md: '15'}}
      />
      <Heading textAlign="center" size="xl" fontWeight="extrabold">
        Sign in to Jaen Admin
      </Heading>
      <Text mt="4" mb="8" align="center" maxW="md" fontWeight="medium">
        <Text as="span">Don&apos;t have an account?</Text>
        <Link onClick={props.onLiveDemo}>Use the live demo</Link>
      </Text>
      <Card>
        <LoginForm onLogin={props.onLogin} />
      </Card>
    </Box>
  </Box>
)

export default AdminLogin
