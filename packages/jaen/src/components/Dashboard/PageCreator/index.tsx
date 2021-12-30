import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Input,
  FormControl,
  FormLabel,
  Button,
  FormHelperText,
  FormErrorMessage,
  toast,
  useToast
} from '@chakra-ui/react'
import {template} from 'lodash'
import * as React from 'react'

export type Templates = {name: string; displayName: string}[]

type TemplateSelectorProps = {
  templates: Templates
  onSelect: (templateName: string) => void
}

const TemplateSelector = ({templates, onSelect}: TemplateSelectorProps) => {
  const [selectedTemplate, setSelectedTemplate] = React.useState<string>('')

  const handleSelect = (templateName: string) => {
    let newSelectedTemplate = templateName

    // Clear selection if the same template is selected
    if (newSelectedTemplate === selectedTemplate) {
      newSelectedTemplate = ''
    }

    setSelectedTemplate(newSelectedTemplate)
    onSelect(newSelectedTemplate)
  }

  return (
    <>
      {templates.map(({name, displayName}, key) => (
        <Button
          key={key}
          variant="outline"
          colorScheme={selectedTemplate === name ? 'blue' : 'gray'}
          mr={2}
          onClick={() => handleSelect(name)}>
          {displayName}
        </Button>
      ))}
    </>
  )
}

export type CreateValues = {
  slug: string
  title: string
  templateName: string
}

type PageCreatorProps = {
  templates: TemplateSelectorProps['templates']
  finalFocusRef: React.RefObject<any>
  isOpen: boolean
  onClose: () => void
  onCreate: (values: CreateValues) => boolean
}

/**
 * Modal to create a new page.
 * Renders a list of templates to choose from.
 */
export const PageCreator = ({
  templates,
  finalFocusRef,
  isOpen,
  onClose,
  onCreate
}: PageCreatorProps) => {
  const initialFocusRef = React.useRef<any>()

  const toast = useToast()

  const [errors, setErrors] = React.useState<{uniqueSlugRequired: boolean}>({
    uniqueSlugRequired: false
  })

  const [values, setValues] = React.useState<CreateValues>({
    slug: '',
    title: '',
    templateName: ''
  })

  React.useEffect(() => {
    setValues({
      slug: '',
      title: '',
      templateName: ''
    })
    setErrors({
      uniqueSlugRequired: false
    })
  }, [isOpen])

  const cleanedValues = React.useMemo(() => {
    const cleanTitle = values.title.replace(/\s{2,}/g, ' ').trim()
    // replace two consecutive spaces with one
    const cleanSlug = values.slug
      .replace(/\s+/g, '-')
      .replace(/-{2,}/g, '-')
      .toLowerCase()
      .trim()

    const cleanTemplateName = values.templateName.trim()

    return {
      slug: cleanSlug,
      title: cleanTitle,
      templateName: cleanTemplateName
    }
  }, [values])

  const updateValues = (newValues: Partial<CreateValues>) => {
    // newValues.title = newValues?.title?.replace(/\s{2,}/g, ' ')
    // newValues.slug = newValues?.slug
    //   ?.replace(/\s+/g, '-')
    //   .replace(/-{2,}/g, '-')
    //   .toLowerCase()

    // newValues.templateName = newValues?.templateName?.trim()

    setValues({...values, ...newValues})
  }

  const handleChange = (name: keyof CreateValues) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    updateValues({[name]: event.target.value})
  }

  const validate = () => {
    const {slug, title, templateName} = values
    return !!(slug && title && templateName)
  }

  const handleSubmit = () => {
    if (validate()) {
      if (onCreate(cleanedValues)) {
        onClose()
        toast({
          title: 'Page created',
          description: `Page "${cleanedValues.title}" created`,
          status: 'success'
        })
      } else {
        setErrors({uniqueSlugRequired: true})
      }
    }
  }

  return (
    <Modal
      initialFocusRef={initialFocusRef}
      finalFocusRef={finalFocusRef}
      isOpen={isOpen}
      onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Create a page</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <FormControl>
            <FormLabel>Title</FormLabel>
            <Input
              ref={finalFocusRef}
              placeholder="Title"
              value={values['title']}
              onChange={handleChange('title')}
            />
          </FormControl>

          <FormControl mt={4} isInvalid={errors.uniqueSlugRequired}>
            <FormLabel>Slug</FormLabel>
            <Input
              placeholder="the-slug"
              value={values['slug']}
              onChange={handleChange('slug')}
            />
            {!errors.uniqueSlugRequired ? (
              <FormHelperText>
                Make sure the slug is unique between siblings.
              </FormHelperText>
            ) : (
              <FormErrorMessage>Slug already exists.</FormErrorMessage>
            )}
          </FormControl>

          <FormControl mt={4}>
            <FormLabel>Template</FormLabel>
            <TemplateSelector
              templates={templates}
              onSelect={templateName => updateValues({templateName})}
            />
          </FormControl>
        </ModalBody>

        <ModalFooter>
          <Button
            colorScheme="blue"
            mr={3}
            disabled={!validate()}
            onClick={handleSubmit}>
            Create
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
