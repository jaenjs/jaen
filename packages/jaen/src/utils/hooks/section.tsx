import {SectionOptionsContext} from 'utils/providers/JaenSectionProvider'

import {registry} from '../../registry'
import {JaenSectionOptions} from '../types'

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
): React.FC<P> => props => {
  return (
    <SectionOptionsContext.Provider value={options}>
      <Component {...props} />
    </SectionOptionsContext.Provider>
  )
}
