import {graphql} from 'gatsby'
import React from 'react'

import {JaenPage} from '../types'

export interface JaenPageContext {
  jaenPageId: string
  staticJaenPage: JaenPage | null
}

export const JaenPageContext = React.createContext<JaenPageContext | undefined>(
  undefined
)

export const JaenPageProvider: React.FC<JaenPageContext> = ({
  children,
  jaenPageId,
  staticJaenPage
}) => {
  return (
    <JaenPageContext.Provider value={{jaenPageId, staticJaenPage}}>
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

export const pageQuery = graphql`
  fragment JaenPageData on Query {
    staticJaenPage: jaenPage(id: {eq: $jaenPageId}) {
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
      chapters
    }
  }
`
