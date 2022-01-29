import {graphql} from 'gatsby'
import React from 'react'
import {IJaenPage} from '../../../types'

export interface JaenPageContext {
  jaenPageId: string
  staticJaenPage: IJaenPage | null
}

export const JaenPageContext =
  React.createContext<JaenPageContext | undefined>(undefined)

export const JaenPageProvider: React.FC<JaenPageContext> = ({
  children,
  jaenPageId,
  staticJaenPage
}) => {
  return (
    <JaenPageContext.Provider
      value={{
        jaenPageId,
        staticJaenPage
      }}>
      {children}
    </JaenPageContext.Provider>
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
 * @type {Fragment}
 *
 * @example
 * ```
 * export const query = graphql`
 *  query ($jaenPageId: String!) {
 *   ...JaenPageQuery
 *  }
 * `
 * ```
 */
export const JaenPageQuery = graphql`
  fragment JaenPageQuery on Query {
    jaenPage(id: {eq: $jaenPageId}) {
      ...JaenPageData
    }
  }
`

/**
 * @type {Fragment}
 *
 * @example
 * ```
 * export const query = graphql`
 *  query ($jaenPageId: String!) {
 *   jaenPage(id: {eq: $jaenPageId}) {
 *    ...JaenPageData
 *    }
 *  }
 * `
 * ```
 */
export const JaenPageData = graphql`
  fragment JaenPageData on JaenPage {
    id
    jaenFields
    jaenPageMetadata {
      title
      isBlogPost
      image
      description
      datePublished
      canonical
    }
    jaenFiles {
      file {
        id
        childImageSharp {
          gatsbyImageData(placeholder: BLURRED, formats: [AUTO, WEBP, AVIF])
        }
      }
    }
    chapters
  }
`
