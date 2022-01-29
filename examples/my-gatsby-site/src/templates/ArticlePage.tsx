import {Heading} from '@chakra-ui/react'
import {connectTemplate, Field} from '@jaenjs/jaen'
import {graphql} from 'gatsby'
import React from 'react'

export default connectTemplate(
  () => {
    return (
      <>
        <Heading size="xl" as="h1">
          This is a Article
        </Heading>
        <Field.Text name="test" defaultValue="<p>Hello World</p>" />
      </>
    )
  },
  {displayName: 'Articles Page', children: ['BlogPage']}
)

export const query = graphql`
  query ($jaenPageId: String!) {
    ...JaenPageQuery
  }
`
