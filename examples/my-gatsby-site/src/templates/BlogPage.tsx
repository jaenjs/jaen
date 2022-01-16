import {connectTemplate, Field} from '@jaenjs/jaen'
import {graphql} from 'gatsby'
import React from 'react'

const BlogPage = connectTemplate(
  () => {
    return <Field.Text name="test" defaultValue="<p>Hello World</p>" />
  },
  {name: 'BlogPage', displayName: 'Blog Page', children: []}
)

export const query = graphql`
  query($jaenPageId: String!) {
    ...JaenPageData
  }
`

export default BlogPage
