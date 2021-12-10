import {JaenTemplate} from '@src/types'
import {graphql, useStaticQuery} from 'gatsby'
import React from 'react'

export interface JaenContext {
  siteMetadata: {
    title: string
    siteUrl: string
    image: string
    description: string
    categories: {slug: string; name: string}[]
    author: {
      minibio: string
      name: string
    }
    organization: {
      logo: string
      name: string
      url: string
    }
    social: {
      fbAppID: string
      twitter: string
    }
  }
  templates: JaenTemplate[]
}

const JaenContext = React.createContext<JaenContext | undefined>(undefined)

export const useJaenContext = (): JaenContext => {
  const context = React.useContext(JaenContext)

  if (context === undefined) {
    throw new Error('useJaenContext must be within JaenContext')
  }

  return context
}

interface JaenProviderProps {
  templates: JaenContext['templates']
}

export const JaenProvider: React.FC<JaenProviderProps> = ({
  children,
  templates
}) => {
  const data = useStaticQuery(graphql`
    {
      site {
        siteMetadata {
          title
          siteUrl
          image
          description
          categories {
            slug
            name
          }
          author {
            minibio
            name
          }
          organization {
            logo
            name
            url
          }
          social {
            fbAppID
            twitter
          }
        }
      }
    }
  `)

  const {siteMetadata} = data.site

  return (
    <JaenContext.Provider value={{siteMetadata, templates}}>
      {children}
    </JaenContext.Provider>
  )
}
