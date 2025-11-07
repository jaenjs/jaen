import { PageConfig, PageProps } from 'jaen'
import React from 'react'
import { graphql } from 'gatsby'
import Content from '../components/Content'

const IndexPage: React.FC<PageProps> = () => {
  return <Content />
}

export default IndexPage

export const pageConfig: PageConfig = {
  label: 'Home Page',
  icon: 'FaHome',
  childTemplates: ['BlogPage']
}

export const query = graphql`
  query ($jaenPageId: String!) {
    ...JaenPageQuery
    allJaenPage {
      nodes {
        ...JaenPageData
        children {
          ...JaenPageData
        }
        childPages {
          ...JaenPageChildrenData
          sections {
            fieldName
            items {
              id
              jaenFields
            }
          }
        }
      }
    }
  }
`

export { Head } from 'jaen'
