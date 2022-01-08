import React from 'react'

import {JaenPageProvider} from '@src/utils/providers/JaenPageProvider'

import {
  JaenConnection,
  JaenPageOptions,
  JaenPageProps,
  JaenTemplateOptions
} from '../types'

/**
 * @function connectTemplate Connects a gatsby template with Jaen.
 *
 * @param Component The template page to wrap
 * @param {JaenTemplateOptions} templateOptions Configuration for the page
 *
 * Warning: This component must be used in conjunction with the graphql`
 *   query($jaenPageId: String!) {
 *     ...JaenPageData
 *   }
 * ``
 *
 * @example
 * ```
 * export default connectTemplate(
 *   p => {
 *     return (
 *       <>
 *         <h1>Blog</h1>
 *         <p>{JSON.stringify(p)}</p>
 *       </>
 *     )
 *   },
 *   {
 *     name: 'blog-page',
 *     displayName: 'Simple Blog Page'
 *   }
 * )
 *
 * export const query = graphql`
 *   query($jaenPageId: String!) {
 *     ...JaenPageData
 *   }
 * `
 * ```
 */
export const connectTemplate = <P extends JaenPageProps>(
  Component: React.ComponentType<P>,
  options: JaenTemplateOptions
) => {
  const MyComp: JaenConnection<P, JaenTemplateOptions> = props => {
    return (
      <JaenPageProvider
        // @ts-ignore
        jaenPageId={props.pageContext.jaenPageId}
        staticJaenPage={props.data ? props.data.staticJaenPage : null}>
        <Component {...props} />
      </JaenPageProvider>
    )
  }

  MyComp.options = options

  return MyComp
}

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
