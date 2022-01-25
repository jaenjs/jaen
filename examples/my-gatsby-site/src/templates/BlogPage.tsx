import {connectTemplate, Field} from '@jaenjs/jaen'
import {graphql} from 'gatsby'
import React from 'react'

const BlogPage = connectTemplate(
  () => {
    return <Field.Text name="test" defaultValue="<p>Hello World</p>" />
  },
  {displayName: 'Blog Page', children: ['BlogPage']}
)

export const query = graphql`
  query($jaenPageId: String!) {
    ...JaenPageData
  }
`

export default BlogPage
