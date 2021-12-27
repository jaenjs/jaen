import React from 'react'

import {JaenPageContext, JaenPageProvider} from '../providers/JaenPageProvider'
import {JaenPageOptions, JaenPageProps, JaenTemplateOptions} from '../types'

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
 *     templateName: 'blog-page',
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
  templateOptions: JaenTemplateOptions
): React.FC<P> => props => {
  return (
    <JaenPageProvider
      templateOptions={templateOptions}
      staticJaenPage={props.data ? props.data.jaenPage : null}>
      <Component {...props} />
    </JaenPageProvider>
  )
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
  pageOptions: JaenPageOptions
): React.FC<P> => props => {
  console.log('props', props)

  return (
    <JaenPageProvider
      templateOptions={pageOptions}
      staticJaenPage={props.data ? props.data.jaenPage : null}>
      <Component {...props} />
    </JaenPageProvider>
  )
}
