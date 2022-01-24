import {Provider as ReduxProvider} from 'react-redux'

import {store} from './index'

export const withRedux =
  <P extends object>(Component: React.ComponentType<P>): React.FC<P> =>
  props => {
    return (
      <ReduxProvider store={store}>
        <Component {...props} />
      </ReduxProvider>
    )
  }
