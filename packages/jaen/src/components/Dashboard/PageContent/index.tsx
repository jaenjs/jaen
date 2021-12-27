import {
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Box,
  Input,
  Text,
  Heading,
  InputGroup,
  InputLeftElement
} from '@chakra-ui/react'
import * as React from 'react'

/**
 * Component for displaying a page content.
 *
 * It includes Accordion that can be used to expand/collapse the page content.
 */
const PageContent: React.FC = () => {
  type Values = {
    slug: string
    title: string
  }

  const [values, setValues] = React.useState<Values>({
    slug: 'a',
    title: 'A title'
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues({...values, [e.target.name]: e.target.value})
  }

  const generateInput = (name: keyof Values) => (
    <Input name={name} value={values[name]} onChange={handleChange} />
  )

  // labledInput should be used to generate inputs that are wrapped in a Box with a label.
  // Box should have a border and padding.
  const labeledInput = (name: keyof Values) => (
    <Box borderWidth="1px" borderRadius="lg" overflow="hidden" p={2} m={1}>
      <Text fontSize="sm" my={1} fontWeight={"semibold"}>{name.toUpperCase()}</Text>
      {generateInput(name)}
      
    </Box>
  )

  return (
    <Accordion defaultIndex={0}>
      <AccordionItem>
        <h2>
          <AccordionButton>
            <Box flex="1" textAlign="left">
              General
            </Box>
            <AccordionIcon />
          </AccordionButton>
        </h2>
        <AccordionPanel pb={4}>
          <Box>
            {labeledInput('slug')}
            {labeledInput('title')}
          </Box>
        </AccordionPanel>
      </AccordionItem>

      <AccordionItem>
        <h2>
          <AccordionButton>
            <Box flex="1" textAlign="left">
              Section 2 title
            </Box>
            <AccordionIcon />
          </AccordionButton>
        </h2>
        <AccordionPanel pb={4}>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
          minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo consequat.
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  )
}

export default PageContent
