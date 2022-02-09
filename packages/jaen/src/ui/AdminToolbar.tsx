import {Box, ChakraProvider} from '@chakra-ui/react'
import {
  EditButtonGroup,
  HomeButton,
  PublishButton
} from '@jaen/internal-plugins/pages/ui/toolbar'
import theme from '@jaen/theme/theme'
import {AccountSwitcher} from './AccountSwitcher'
import {AdminToolbar} from './components/AdminToolbar'

export interface IAdminToolbarProps {
  sticky?: boolean
}

const AdminToolbarContainer = ({sticky = false}) => {
  const logoText = 'Jaen Admin'
  const toolbarItems = {
    left: [<HomeButton />, <EditButtonGroup />, <PublishButton />],
    right: [
      <Box w="48">
        <AccountSwitcher />
      </Box>
    ]
  }
  return (
    <ChakraProvider theme={theme} resetCSS={false}>
      <AdminToolbar
        logoText={logoText}
        toolbarItems={toolbarItems}
        sticky={sticky}
      />
    </ChakraProvider>
  )
}

export default AdminToolbarContainer
