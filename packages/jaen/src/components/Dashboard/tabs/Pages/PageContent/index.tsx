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
  InputLeftElement,
  FormControl,
  FormLabel,
  Textarea,
  Skeleton,
  Flex,
  Spacer,
  Button,
  ButtonGroup,
  VStack,
  useToast,
  FormHelperText,
  FormErrorMessage,
  Badge,
  Img
} from '@chakra-ui/react'
import * as React from 'react'
import {useForm} from 'react-hook-form'

import {FormProps, JaenTemplate} from '../../../../../utils/types'

export type ContentValues = {
  title: string
  slug: string
  description?: string
}

export interface PageContentProps extends FormProps<ContentValues> {
  template: JaenTemplate | null
}

/**
 * Component for displaying a page content.
 *
 * It includes Accordion that can be used to expand/collapse the page content.
 */
export const PageContent = (props: PageContentProps) => {
  const toast = useToast()

  const [defaultValues, setDefaultValues] = React.useState<ContentValues>(
    props.values
  )

  React.useEffect(() => {
    setDefaultValues(props.values)
  }, [props.values])

  const {
    register,
    reset,
    handleSubmit,
    formState: {errors, isSubmitting, isDirty, isValid}
  } = useForm<ContentValues>({
    defaultValues
  })

  const onSubmit = (values: ContentValues) => {
    props.onSubmit(values)

    setDefaultValues(values)
    reset(values)

    toast({
      title: 'Saved',
      description: 'Your changes have been saved.',
      status: 'success',
      duration: 5000
    })
  }

  const onReset = () => {
    reset(defaultValues)
  }

  return (
    <Flex flexDirection={'column'}>
      <Heading as={'h3'} size={'lg'} mb="4">
        Content {props.template && <Badge>{props.template.displayName}</Badge>}
      </Heading>
      <form onSubmit={handleSubmit(onSubmit)}>
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
                <FormControl isInvalid={!!errors.title}>
                  <FormLabel>Title</FormLabel>
                  <Input
                    // id="title"
                    placeholder="Title"
                    {...register('title', {
                      required: 'This is required',
                      minLength: {
                        value: 4,
                        message: 'Minimum length should be 4'
                      }
                    })}
                  />
                  <FormErrorMessage>{errors.title?.message}</FormErrorMessage>
                </FormControl>
                <FormControl mt={4} isInvalid={!!errors.slug}>
                  <FormLabel>Slug</FormLabel>
                  <Input
                    // id="slug"
                    placeholder="the-slug"
                    disabled={!props.template}
                    {...register('slug', {
                      required: 'This is required',
                      minLength: {
                        value: 4,
                        message: 'Minimum length should be 4'
                      },
                      pattern: {
                        value: /^[a-z0-9-]+$/,
                        message:
                          'Only lowercase letters, numbers and hyphens are allowed'
                      },
                      validate: (value: string) => {
                        const {externalValidation} = props

                        if (externalValidation) {
                          const validation = externalValidation('slug', value)

                          if (validation) {
                            return validation
                          }
                        }
                      }
                    })}
                  />
                  {!errors.slug && (
                    <FormHelperText>
                      Make sure the slug is unique between siblings.
                    </FormHelperText>
                  )}
                  <FormErrorMessage>{errors.slug?.message}</FormErrorMessage>
                </FormControl>
                <FormControl mt={4}>
                  <FormLabel>Description</FormLabel>
                  <Textarea
                    // id="description"
                    placeholder="This is a sample description used for this page."
                    {...register('description', {})}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Image</FormLabel>
                  <Img
                    boxSize="200px"
                    src="https://bit.ly/dan-abramov"
                    alt="Dan Abramov"
                  />
                </FormControl>
              </Box>
            </AccordionPanel>
          </AccordionItem>

          <AccordionItem>
            <h2>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  Fields
                </Box>
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
              <Skeleton h="200"></Skeleton>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>

        <Spacer flex="1" />
        <ButtonGroup isDisabled={!isDirty}>
          <Button
            colorScheme="blue"
            mr={4}
            isLoading={isSubmitting}
            type="submit">
            Save
          </Button>
          <Button onClick={onReset}>Cancel</Button>
        </ButtonGroup>
      </form>
    </Flex>
  )
}
