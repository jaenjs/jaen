import {graphql} from 'gatsby'
import React from 'react'

import {JaenPage, JaenPageOptions, JaenTemplateOptions} from '../types'

export const JaenPageContext = React.createContext<
  {jaenPage: JaenPage | null; staticJaenPage: JaenPage | null} | undefined
>(undefined)

export const JaenPageProvider: React.FC<{
  templateOptions: Omit<JaenTemplateOptions, 'templateName'>
  staticJaenPage: JaenPage | null
}> = ({children, staticJaenPage}) => {
  const jaenPage = staticJaenPage

  return (
    <JaenPageContext.Provider value={{jaenPage, staticJaenPage}}>
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
    jaenPage(id: {eq: $jaenPageId}) {
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
    }
  }
`
