import {store} from '@store/index'
import * as React from 'react'

import MainUI from '../containers/UI'

export type JaenCoreContextType = {
  getAuthState: () => any
  toggleHideUI: () => void
  hideUI: boolean
  remote: string
}
export const JaenCoreContext = React.createContext<
  JaenCoreContextType | undefined
>(undefined)

export const useJaenCoreContext = (): JaenCoreContextType => {
  const context = React.useContext(JaenCoreContext)

  if (context === undefined) {
    throw new Error('useJaenCoreContext must be within JaenCoreContext')
  }

  return context
}

type JaenCoreProviderProps = {
  remote: string
  initialHideUI?: boolean
}

export const JaenCoreProvider: React.FC<JaenCoreProviderProps> = ({
  children,
  remote,
  initialHideUI = false
}) => {
  const getAuthState = () => store.getState().auth

  const hideUIKey = 'jaen-core-hide-ui'
  const [hideUI, setHideUI] = React.useState<boolean>(initialHideUI)

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const localStorage = window.localStorage
      const hideUIFromLocalStorage = localStorage.getItem(hideUIKey)

      if (hideUIFromLocalStorage !== null) {
        setHideUI(hideUIFromLocalStorage === 'true')
      }
    } else {
      setHideUI(true)
    }
  }, [])

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const hideUIFromLocalStorage = localStorage.getItem(hideUIKey)
      if (hideUIFromLocalStorage === initialHideUI.toString()) {
        window.localStorage.removeItem(hideUIKey)
      }
    }
  }, [hideUI])

  const toggleHideUI = () => {
    if (typeof window !== 'undefined') {
      // check current main ui status in local storage and reverse it

      const notHideUI = !hideUI

      setHideUI(notHideUI)

      window.localStorage.setItem(hideUIKey, notHideUI.toString())
    }
  }

  const ui = {}

  return (
    <JaenCoreContext.Provider
      value={{getAuthState, toggleHideUI, hideUI, remote}}>
      {!hideUI && <MainUI />}
      {children}
    </JaenCoreContext.Provider>
  )
}

export default JaenCoreProvider
