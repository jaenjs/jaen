import {Center, Heading, HStack, VStack, WrapItem} from '@chakra-ui/layout'
import {Wrap} from '@chakra-ui/layout'
import {Box} from '@chakra-ui/layout'
import {Button, Skeleton} from '@chakra-ui/react'
import {BlockContainer, fields} from '@jaenjs/jaen'
import * as React from 'react'

import {PricingBlock} from '../blocks'
import {Navbar, Hero, Footer, BlogCard} from '../components'

// markup
const IndexPage: React.FC = () => {
  //const {toggleHideUI, hideUI} = useJaenCoreContext()

  return (
    <>
      <Navbar />
      <Hero />
      <Box px={125} py={100} minW="full" bg="lightblue">
        <VStack>
          <Heading as="h1" color="white" size="4xl">
            Explore our BlockContainer
          </Heading>

          <BlockContainer
            name="pricing"
            displayName="Pricing Section"
            blocks={[PricingBlock]}
            wrap={true}
          />
        </VStack>
      </Box>

      <VStack my="50">
        <Heading as="h1" size="4xl">
          The IndexField
        </Heading>
        <fields.IndexField
          onRender={page => (
            <>
              {page.children.map(e => (
                <>
                  <fields.TextField
                    fieldName="test"
                    initValue="test"
                    pageId={e.page.id}
                  />
                  <BlogCard></BlogCard>
                </>
              ))}
            </>
          )}
        />
      </VStack>

      <Footer />
    </>
  )
}

export default IndexPage
