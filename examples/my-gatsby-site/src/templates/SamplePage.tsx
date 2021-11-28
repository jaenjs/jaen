import {Heading} from '@chakra-ui/layout'
import {fields} from '@jaenjs/jaen'
import {JaenTemplate} from '@jaenjs/jaen/src/types'
import * as React from 'react'

const SamplePage: JaenTemplate = () => {
  return (
    <>
      <Heading>Sample Page</Heading>
      <fields.TextField fieldName="1" initValue="Sample Page TextField 1" />
    </>
  )
}

SamplePage.TemplateName = 'SamplePage'

export default SamplePage
