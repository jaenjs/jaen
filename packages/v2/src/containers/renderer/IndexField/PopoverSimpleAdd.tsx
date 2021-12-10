import {Button, IconButton} from '@chakra-ui/button'
import {AddIcon, SmallAddIcon} from '@chakra-ui/icons'
import {
  Box,
  BoxProps,
  Center,
  Divider,
  Flex,
  HStack,
  SimpleGrid,
  Spacer,
  Text
} from '@chakra-ui/layout'
import {Select} from '@chakra-ui/select'
import type {IndexRenderFn} from '@containers/fields/IndexField/renderer'
import {FaFile} from '@react-icons/all-files/fa/FaFile'
import {useCMSContext} from '@src/contexts/cms'
import React from 'react'

const PopoverTemplateBox: React.FC<{
  template: string
  onClick: () => void
}> = ({template, onClick}) => {
  return (
    <Flex color="white">
      <Center>
        <FaFile size={24} />
      </Center>
      <Center flex="1">
        <Text size="md">{template}</Text>
      </Center>
      <Center>
        <IconButton
          aria-label="add page"
          icon={<SmallAddIcon />}
          onClick={onClick}
        />
      </Center>
    </Flex>
  )
}

export const PopoverSimpleAdd: IndexRenderFn = ({templates, addPage}) => {
  // Render a scrollable list of boxes to select the template
  return (
    <Box>
      <SimpleGrid columns={1} spacing={4}>
        {templates.map(template => (
          <>
            <PopoverTemplateBox
              key={template}
              template={template}
              onClick={() =>
                addPage({
                  template: template,
                  pageMetadata: {
                    title: template,
                    description: '',
                    image: '',
                    canonical: '',
                    isBlogPost: false
                  }
                })
              }
            />
            {templates.length > 1 && <Divider />}
          </>
        ))}
      </SimpleGrid>

      <Flex color="white" mt={4}>
        <Center>
          <Box fontSize="sm">Step 1 of 1</Box>
        </Center>
        <Spacer />
      </Flex>
    </Box>
  )
}
