import {ChakraProvider} from '@chakra-ui/react'
import theme from '../../../../theme/theme'
import AdminToolbar from '../components/Navbars/AdminToolbar'

const AToolbar = () => {
  return (
    <ChakraProvider theme={theme} resetCSS={false}>
      <AdminToolbar />
    </ChakraProvider>
  )
}

export default AToolbar
