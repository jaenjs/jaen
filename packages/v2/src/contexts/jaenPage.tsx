import {graphql, PageProps} from 'gatsby'
import React from 'react'

//> Jaen Page Context

interface JaenTextField {
  name: string
  value: string
}

interface JaenFileField {
  name: string
  value: object
}

export interface JaenPage {
  id: string
  jaenFields: {
    jaenTextFields: JaenTextField[]
    jaenFileFields: JaenFileField[]
  }
  jaenPageMetadata: {
    title: string
    isBlogPost: boolean
    image: string
    description: string
    datePublished: string
    canonical: string
  }
}

export interface JaenPageContext {
  jaenPage: JaenPage
}

export interface JaenPageOptions {
  /**
   * A unique identifier for the page.
   *
   * @example `ArticlePage`
   *
   * Warning: This should only be used on template pages (`src/templates/` and not `src/pages/`).
   */
  template?: string
  /**
   * Specifies how the JaenPage is displayed in the the UI.
   */
  displayName: string
}

const JaenPageContext = React.createContext<JaenPageContext | undefined>(
  undefined
)

export const useJaenPageContext = (): JaenPageContext => {
  const context = React.useContext(JaenPageContext)

  if (context === undefined) {
    throw new Error('useJaenPageContext must be within JaenPageContext')
  }

  return context
}

interface JaenPageProviderProps {
  pageOptions: JaenPageOptions
  staticJaenPage: JaenPage
}

export const JaenPageProvider: React.FC<JaenPageProviderProps> = ({
  children,
  staticJaenPage
}) => {
  const jaenPage = staticJaenPage

  console.log('children', children, jaenPage.jaenFields.jaenTextFields)

  return (
    <JaenPageContext.Provider value={{jaenPage}}>
      <>{children}</>
    </JaenPageContext.Provider>
  )
}

////

export const useTextField = (name: string): string | undefined => {
  const {jaenPage} = useJaenPageContext()
  const field = jaenPage.jaenFields.jaenTextFields.find(
    field => field.name === name
  )

  return field?.value
}

export const useFileField = (name: string): object | undefined => {
  const {jaenPage} = useJaenPageContext()
  const field = jaenPage.jaenFields.jaenFileFields.find(
    field => field.name === name
  )

  return field?.value
}

////

type JaenPageQueryProps = {jaenPage: JaenPage}
type JaenPageProps = PageProps<JaenPageQueryProps>

/**
 * Connects a Gatsby Page with Jaen.
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
export const withJaenPage = <P extends JaenPageProps>(
  Component: React.ComponentType<P>,
  pageOptions: JaenPageOptions
): React.FC<P> => props => {
  console.log(props)
  return (
    <JaenPageProvider
      pageOptions={pageOptions}
      staticJaenPage={props.data.jaenPage}>
      <Component {...props} />
    </JaenPageProvider>
  )
}

export const pageQuery = graphql`
  fragment JaenPageData on Query {
    jaenPage(sitePageId: {eq: $sitePageId}) {
      id
      jaenFields {
        jaenTextFields {
          name
          value
        }
      }
      jaenPageMetadata {
        title
        isBlogPost
        image
        description
        datePublished
        canonical
      }
    }
  }
`
