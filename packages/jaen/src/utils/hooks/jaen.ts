import React from 'react'

import {JaenContext} from '../providers/JaenProvider'

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
