import {ReactNode} from 'react'

import {SectionOptionsContext} from '../providers/JaenSectionProvider'
import {JaenConnection, JaenSectionOptions} from '../types'

export type ConnectedFC<P> = React.FC<P> & {
  name: string
  displayName: string
}

/**
 * @function connectSection Connects a section with Jaen.
 *
 * @param Component The component to wrap
 */
export const connectSection = <P extends {}>(
  Component: React.ComponentType<P>,
  options: JaenSectionOptions
) => {
  const MyComp: JaenConnection<P, JaenSectionOptions> = props => {
    return (
      <SectionOptionsContext.Provider value={options}>
        <Component {...props} />
      </SectionOptionsContext.Provider>
    )
  }

  MyComp.options = options

  return MyComp
}
