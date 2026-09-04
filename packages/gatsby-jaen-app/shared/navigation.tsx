import React from 'react'

interface NavigationContextValue {
  navigate: (path: string) => void
  params: Record<string, string>
}

const NavigationContext = React.createContext<NavigationContextValue>({
  navigate: () => {},
  params: {}
})

export const useAppNavigate = () => React.useContext(NavigationContext).navigate
export const useAppParams = () => React.useContext(NavigationContext).params
export const NavigationProvider = NavigationContext.Provider
export type { NavigationContextValue }
