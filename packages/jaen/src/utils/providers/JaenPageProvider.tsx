import {graphql} from 'gatsby'
import React from 'react'

import {JaenPage, JaenPageOptions} from '../types'

export const JaenPageContext = React.createContext<
  {jaenPage: JaenPage | null} | undefined
>(undefined)

export const JaenPageProvider: React.FC<{
  pageOptions: JaenPageOptions
  staticJaenPage: JaenPage | null
}> = ({children, staticJaenPage}) => {
  const jaenPage = staticJaenPage

  return (
    <JaenPageContext.Provider value={{jaenPage}}>
      {children}
    </JaenPageContext.Provider>
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
