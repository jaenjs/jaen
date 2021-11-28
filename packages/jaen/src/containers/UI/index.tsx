//const LoadableUI = loadable(() => import('../../components/app/Main'))
import LoadableUI from '@components/app/Main'
import loadable from '@loadable/component'
import {useAppDispatch, useAppSelector} from '@store/index'
import {withRedux} from '@store/withRedux'

import {UI} from './ui'

const MainUI: React.FC = () => {
  const dispatch = useAppDispatch()
  const authenticated = useAppSelector(state => state.auth.authenticated)

  const login = async (
    username: string,
    password: string,
    isGuest: boolean
  ) => {
    const {login} = await import('../../store/actions/authActions')

    const res = (await dispatch(
      login({creds: {username, password}, isGuest})
    )) as any

    if (res.error) {
      return false
    }

    return true
  }

  const handleLogin = async (username: string, password: string) => {
    return login(username, password, username === 'snekman')
  }

  const handleGuestLogin = async () => {
    return login('snekman', 'ciscocisco', true)
  }

  const handleLogout = async () => {
    const {logout} = await import('../../store/actions/authActions')

    dispatch(logout())
  }

  return (
    <LoadableUI
      hotbar={UI.hotbar}
      tabs={UI.tabs}
      footer={{onLogout: handleLogout}}
      authenticated={authenticated}
      login={{onLogin: handleLogin, onGuestLogin: handleGuestLogin}}
    />
  )
}

export default withRedux(MainUI)
