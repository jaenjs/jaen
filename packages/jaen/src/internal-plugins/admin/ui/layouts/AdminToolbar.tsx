import {ChakraProvider} from '@chakra-ui/react'
import AdminToolbar from '../components/Navbars/AdminToolbar'
import theme from '../theme/theme'

const AToolbar = () => {
  return (
    <ChakraProvider theme={theme} resetCSS={false}>
      <AdminToolbar />
    </ChakraProvider>
  )
}

export default AToolbar
