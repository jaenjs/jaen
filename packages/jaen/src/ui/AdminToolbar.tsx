import {Box, ChakraProvider} from '@chakra-ui/react'
import {
  EditButtonGroup,
  HomeButton,
  PublishButton
} from '@jaen/internal-plugins/pages/ui/toolbar'
import {useAppSelector, withRedux} from '@jaen/redux'
import theme from '@jaen/theme/theme'
import {navigate} from 'gatsby'
import {AccountSwitcher} from './AccountSwitcher'
import {AdminToolbar} from './components/AdminToolbar'
import JaenActivationButton from './components/JaenActivationButton'

export interface IAdminToolbarProps {
  sticky?: boolean
}

const AdminToolbarContainer = withRedux<IAdminToolbarProps>(
  ({sticky = false}) => {
    const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated)

    let element = (
      <JaenActivationButton onClick={() => navigate('/jaen/admin')} />
    )

    if (isAuthenticated) {
      const logoText = 'Jaen Admin'
      const toolbarItems = {
        left: [<HomeButton />, <EditButtonGroup />, <PublishButton />],
        right: [
          <Box w="48">
            <AccountSwitcher />
          </Box>
        ]
      }

      element = (
        <AdminToolbar
          logoText={logoText}
          toolbarItems={toolbarItems}
          sticky={sticky}
        />
      )
    }

    return (
      <ChakraProvider theme={theme} resetCSS={false}>
        {element}
      </ChakraProvider>
    )
  }
)

export default AdminToolbarContainer
