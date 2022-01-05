import {graphql, useStaticQuery} from 'gatsby'

import {JaenTemplate} from '../../types'

/**
 * Access the JaenTemplates
 */
export const useJaenTemplates = (): JaenTemplate[] => {
  type QueryData = {
    allJaenTemplate: {
      nodes: JaenTemplate[]
    }
  }

  let data: QueryData

  try {
    data = useStaticQuery<QueryData>(graphql`
      query {
        allJaenTemplate {
          nodes {
            name
            displayName
            children: childrenJaenTemplate {
              name
              displayName
            }
          }
        }
      }
    `)
  } catch {
    data = {
      allJaenTemplate: {
        nodes: []
      }
    }
  }

  return data.allJaenTemplate.nodes
}
