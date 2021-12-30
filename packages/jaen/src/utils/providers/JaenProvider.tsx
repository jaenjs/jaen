import React from 'react'

import {JaenConnection, JaenPageOptions, JaenPluginOptions} from '../types'

export interface JaenContext {
  templatesPaths: JaenPluginOptions['templates']['paths']
  templateLoader: (name: string) => Promise<JaenConnection<{}, JaenPageOptions>>
}

export const JaenContext = React.createContext<JaenContext | undefined>(
  undefined
)

export const JaenProvider: React.FC<{
  templatesPaths: JaenContext['templatesPaths']
}> = ({children, templatesPaths}) => {
  const templateLoader = async (name: string) => {
    //@ts-ignore
    return import(`${___JAEN_TEMPLATES___}/${templatesPaths[name]}`).default
  }

  return (
    <JaenContext.Provider value={{templatesPaths, templateLoader}}>
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