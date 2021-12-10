import React from 'react'

import {ConnectedPage} from '../types'

export interface JaenContext {
  templates: ConnectedPage[]
}

export const JaenContext = React.createContext<JaenContext | undefined>(
  undefined
)

export const JaenProvider: React.FC<{templates: JaenContext['templates']}> = ({
  children,
  templates
}) => {
  return (
    <JaenContext.Provider value={{templates}}>{children}</JaenContext.Provider>
  )
}
