import React from 'react'

import {ConnectedPage, JaenPluginOptions} from '../types'

export interface JaenContext {
  templatesPaths: JaenPluginOptions['templates']['paths']
}

export const JaenContext = React.createContext<JaenContext | undefined>(
  undefined
)

export const JaenProvider: React.FC<{
  templatesPaths: JaenContext['templatesPaths']
}> = ({children, templatesPaths}) => {
  return (
    <JaenContext.Provider value={{templatesPaths}}>
      {children}
    </JaenContext.Provider>
  )
}

/**
 * Access the JaenContext.
 *
 * @example
 * ```
 * const { jaen } = useJaenContext()
 * ```
 */
export const useJaenContext = () => {
  const context = React.useContext(JaenContext)

  if (context === undefined) {
    throw new Error('useJaenContext must be within JaenContextProvider')
  }

  return context
}
