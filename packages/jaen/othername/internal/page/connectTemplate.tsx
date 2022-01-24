import React from 'react'

import {
  JaenConnection,
  JaenPageProps,
  JaenTemplateOptions
} from '@src/internal/types'

import {JaenPageProvider} from './JaenPageProvider'

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
