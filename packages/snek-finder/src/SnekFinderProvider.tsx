import * as React from 'react'
import {Backend} from './backends/backend'
import {FinderData} from './components/organisms/Finder/types'

interface ISnekFinderContext {
  backend: Backend
  initData: FinderData
  rootFileId: string
}

const SnekFinderContext = React.createContext<ISnekFinderContext | undefined>(
  undefined
)

export const SnekFinderProvider: React.FC<ISnekFinderContext> = ({
  backend,
  initData,
  rootFileId,
  children
}) => (
  <SnekFinderContext.Provider
    value={{
      backend,
      initData,
      rootFileId
    }}>
    {children}
  </SnekFinderContext.Provider>
)

export const useSnekFinderContext = () => {
  const context = React.useContext(SnekFinderContext)

  if (!context) {
    throw new Error('useSnekFinder must be used within a SnekFinderProvider')
  }

  return context
}
