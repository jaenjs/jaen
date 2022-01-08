import React from 'react'

import {
  JaenConnection,
  JaenPageOptions,
  JaenPageProps
} from '@src/internal/types'

import {JaenPageProvider} from './JaenPageProvider'

/**
 * @function connectPage Connects a gatsby page with Jaen.
 *
 * @see {@link connectTemplate} for more information.
 *
 * Warning: This component must be used to wrap a page, not a template.
 */
export const connectPage = <P extends JaenPageProps>(
  Component: React.ComponentType<P>,
  options: JaenPageOptions
) => {
  const MyComp: JaenConnection<P, JaenPageOptions> = props => (
    <JaenPageProvider
      // @ts-ignore
      jaenPageId={props.pageContext.jaenPageId}
      staticJaenPage={props.data ? props.data.staticJaenPage : null}>
      <Component {...props} />
    </JaenPageProvider>
  )

  MyComp.options = options

  return MyComp
}
