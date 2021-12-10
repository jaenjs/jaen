import React from 'react'

import {JaenPageContext, JaenPageProvider} from '../providers/JaenPageProvider'
import {JaenPageOptions, JaenPageProps} from '../types'

/**
 * @function connectPage Connects a gatsby page with Jaen.
 *
 * @param Component The page or template to wrap
 * @param {JaenPageOptions} pageOptions Configuration for the page
 *
 * Warning: This component must be used in conjunction with the graphql`
 *   query($sitePageId: String!) {
 *     ...JaenPageData
 *   }
 * ``
 *
 * @example
 * ```
 * export default withJaenPage(
 *   p => {
 *     return (
 *       <>
 *         <h1>Blog</h1>
 *         <p>{JSON.stringify(p)}</p>
 *       </>
 *     )
 *   },
 *   {
 *     template: 'blog-page',
 *     displayName: 'Simple Blog Page'
 *   }
 * )
 *
 * export const query = graphql`
 *   query($sitePageId: String!) {
 *     ...JaenPageData
 *   }
 * `
 * ```
 */
export const connectPage =
  <P extends JaenPageProps>(
    Component: React.ComponentType<P>,
    pageOptions: JaenPageOptions
  ): React.FC<P> =>
  props => {
    console.log(props.data)
    return (
      <JaenPageProvider
        pageOptions={pageOptions}
        staticJaenPage={props.data.jaenPage}>
        <Component {...props} />
      </JaenPageProvider>
    )
  }

/**
 * Access the JaenPageContext.
 *
 * @example
 * ```
 * const {jaenPage} = useJaenPageContext()
 * ```
 */
export const useJaenPageContext = () => {
  const context = React.useContext(JaenPageContext)

  if (context === undefined) {
    throw new Error('useJaenPageContext must be within JaenPageContext')
  }

  return context
}

/**
 * Access the JaenTextField.
 *
 * This is a convenience function for accessing the value of a text field.
 * It extracts the value from the JaenPageContext, thus it is only available
 * when the page is connected with Jaen (@see {@link connectPage}).
 *
 * @param {string} name The name of the field.
 * @returns {string} The value of the field.
 *
 * @example
 * ```
 * const title = useJaenTextField('title')
 * ```
 */
export const useTextField = (name: string): string | undefined => {
  const {jaenPage} = useJaenPageContext()
  const field = jaenPage?.jaenFields?.jaenTextFields.find(
    field => field.name === name
  )

  return field?.value
}
