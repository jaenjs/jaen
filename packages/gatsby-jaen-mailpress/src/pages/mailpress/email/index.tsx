import React, { useMemo, useState, useEffect } from 'react'
import { graphql } from 'gatsby'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'

// Tiptap
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'

// Icons (lucide-react or your own)
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Underline as UnderlineIcon,
  Unlink
} from 'lucide-react'

// Calendar from Jaen UI
import { Calendar } from 'gatsby-plugin-jaen/src/components/ui/calendar'

// Chakra UI
import {
  Box,
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Heading,
  Text,
  FormControl,
  FormLabel,
  FormHelperText,
  FormErrorMessage,
  Input,
  Checkbox,
  HStack,
  IconButton,
  useToast,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Portal,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Select,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription
} from '@chakra-ui/react'
import { CalendarIcon } from '@radix-ui/react-icons'

// Additional imports for fetching templates
import { useQuery } from '../../../client/index' // Adjust the import path as necessary
import DOMPurify from 'isomorphic-dompurify' // Corrected import
import { sendTemplateMail } from "../../../index"

// Define the PageConfig interface locally
interface PageConfig {
  label: string
  icon: string
  menu: {
    type: string
    group: string
    groupLabel: string
    order: number
  }
  layout: {
    name: string
  }
  breadcrumbs: Array<{
    label: string
    path: string
  }>
  auth: {
    isRequired: boolean
    isAdminRequired: boolean
  }
}

// Define the schema using Zod
const NotificationPopupSchema = z.object({
  templateId: z.string().nonempty('Template is required'),
  subject: z.string().nonempty('Subject is required'),
  message: z.string().nonempty('Message is required'),
  schedule: z
    .date()
    .or(z.string().transform(val => new Date(val)))
    .optional(),
  to: z.string().nonempty('To is required'),
  bcc: z.string().optional(),
  sendEmailOnSubmitConsent: z.literal(true)
})

type EmailPopupForm = z.infer<typeof NotificationPopupSchema>

// Define the EmailTemplate interface
interface EmailTemplate {
  id: string
  description: string
  content: string
  variables: Array<{
    name: string
    defaultValue?: string | null
  }>
  envelope?: {
    subject?: string | null
    to?: string[] | null // Adjusted to match actual data
    replyTo?: string | null
  } | null
  links: Array<EmailTemplate> // Assuming links are also EmailTemplates
}

// Utility function to replace variables in content
const replaceVariables = (
  content: string = '',
  variables: Record<string, string>
): string => {
  let replacedContent = content
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    replacedContent = replacedContent.replace(regex, value)
  }
  return replacedContent
}

// Define the component
const NotificationPopupFormComponent: React.FC = () => {
  const toast = useToast()

  // Local state for controlling the "Preview" modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  // Initialize react-hook-form with Zod resolver
  const form = useForm<EmailPopupForm>({
    resolver: zodResolver(NotificationPopupSchema),
    defaultValues: {
      templateId: undefined, // Changed from '' to undefined
      sendEmailOnSubmitConsent: undefined,
      subject: '',
      message: '',
      schedule: undefined,
      to: '',
      bcc: ''
    }
  })

  // Initialize Tiptap editor
  const editor = useEditor({
    extensions: [StarterKit, Link, Underline],
    content: form.getValues().message ?? '',
    editorProps: {
      attributes: {
        // Chakra styling: bigger min-height, slimmer border
        class: 'focus:outline-none min-h-96 rounded-md border border-input bg-background px-3 py-2 prose max-w-full max-h-full'
      }
    },
    onUpdate: ({ editor }) => {
      form.setValue('message', editor.getHTML())
    }
  })

  const currentSchedule = form.watch('schedule')
  //const currentTo = form.watch('to')
  //const currentBcc = form.watch('bcc')
  const selectedTemplateId = form.watch('templateId')
  const currentMessage = form.watch('message') // Added to watch 'message'

  // Fetch email templates using useQuery
  const templateQuery = useQuery({
    // Define your query parameters if needed
    // Example: pass variables or options based on your backend
  })

  // Refetch templates on mount
  useEffect(() => {
    templateQuery.$refetch()
  }, [templateQuery])

  // Handle errors in fetching templates
  useEffect(() => {
    if (templateQuery.$state.error) {
      toast({
        title: `Failed to load templates (${templateQuery.$state.error.name})`,
        description: templateQuery.$state.error.message,
        status: 'error',
        duration: 5000,
        isClosable: true
      })
    }
  }, [templateQuery.$state.error, toast])

  // Find the selected template's description for preview
  const selectedTemplate = useMemo(() => {
    if (selectedTemplateId && selectedTemplateId.trim() !== '') {
      return templateQuery.template({ id: selectedTemplateId })
    }
    return null
  }, [templateQuery, selectedTemplateId])

  // Generate the template content for preview
  const templateContent = useMemo(() => {
    if (!selectedTemplate) {
      return form.watch('message') || ''
    }

    // Create a variables mapping using defaultValue
    const variablesMap: Record<string, string> = {}
    selectedTemplate.variables.forEach((variable) => {
      if (variable.name === 'message') {
        variablesMap[variable.name] = currentMessage || variable.defaultValue || ''
      } else if (variable.defaultValue) {
        variablesMap[variable.name] = variable.defaultValue
      } else {
        variablesMap[variable.name] = ''
      }
    })

    // Replace variables in the template content with a fallback
    const replacedMessage = replaceVariables(selectedTemplate.content || '', variablesMap)

    // Sanitize the replaced message
    return DOMPurify.sanitize(replacedMessage)
  }, [selectedTemplate, currentMessage, form.watch('message')])

  // Handle form submission
  const onSubmit = async (values: EmailPopupForm) => {
    try {
      const { message, errors } = await sendTemplateMail(
        "68d4c136-7d75-40cc-ba74-079a0dca4044",
        {
          envelope: { replyTo: values.to },
          values: {
            email: values.to,
            message: values.message,
          },
        }
      )
      if (errors) {
        console.error("Mail failed:", errors)
      } else {
        console.log("Mail sent:", message)
      }

      toast({
        title: 'Email sent',
        description: 'The email has been sent successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true
      })
    } catch (error: any) {
      toast({
        title: 'Submission Error',
        description: error.message || 'An unexpected error occurred.',
        status: 'error',
        duration: 5000,
        isClosable: true
      })
    }
  }

  useEffect(() => {
    const sendMail = async () => {
      // ...existing mail sending code...
    };
    sendMail();
  }, []); // <-- Make sure you only call this once

  useEffect(() => {
    const fetchTemplates = async () => {
      // ...template fetch logic...
    }
    // Called once
    fetchTemplates();
  }, []);

  return (
    <Box as="form" onSubmit={form.handleSubmit(onSubmit)}>
      <Card variant="outline">
        <CardHeader>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Heading size="sm">Send Email</Heading>
              <Text fontSize="sm" color="gray.600">
                Configure the notification popup. The notification will be shown
                when the user visits the page.
              </Text>
            </Box>
            <Button variant="outline" onClick={() => setIsPreviewOpen(true)}>
              Preview
            </Button>
          </Box>
        </CardHeader>

        <CardBody>
          {/* Email Template Select */}
          <FormControl mb={5} isInvalid={!!form.formState.errors.templateId}>
            <FormLabel>Email Template</FormLabel>
            {templateQuery.$state.isLoading ? (
              <HStack>
                <Spinner size="sm" />
                <Text>Loading templates...</Text>
              </HStack>
            ) : templateQuery.$state.error ? (
              <Alert status="error">
                <AlertIcon />
                <AlertTitle mr={2}>Error!</AlertTitle>
                <AlertDescription>
                  Failed to load email templates.
                </AlertDescription>
              </Alert>
            ) : (
              <Select
                placeholder="Select an email template"
                {...form.register('templateId', { required: 'Template is required' })}
              >
                {templateQuery.allTemplate().nodes.map((template: EmailTemplate) => (
                  <option key={template.id} value={template.id}>
                    {template.description || template.envelope?.subject || 'Unnamed Template'}
                  </option>
                ))}
              </Select>
            )}
            <FormHelperText>The template for the email.</FormHelperText>
            <FormErrorMessage>
              {form.formState.errors.templateId && form.formState.errors.templateId.message}
            </FormErrorMessage>
          </FormControl>

          {/* Subject */}
          <FormControl mb={5} isInvalid={!!form.formState.errors.subject}>
            <FormLabel>Subject</FormLabel>
            {/* No gray background => default is white */}
            <Input placeholder="Hi there" bg="white" {...form.register('subject')} />
            <FormHelperText>The subject of the email.</FormHelperText>
            <FormErrorMessage>
              {form.formState.errors.subject && form.formState.errors.subject.message}
            </FormErrorMessage>
          </FormControl>

          {/* Message + Tiptap Toolbar */}
          <FormControl mb={5} isInvalid={!!form.formState.errors.message}>
            <FormLabel>Message</FormLabel>
            {editor && (
              <HStack mb={2} spacing={1}>
                <IconButton
                  size="sm"
                  aria-label="Bold"
                  icon={<Bold size="16" />}
                  variant={editor.isActive('bold') ? 'solid' : 'outline'}
                  isDisabled={!editor.can().chain().focus().toggleBold().run()}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                />
                <IconButton
                  size="sm"
                  aria-label="Italic"
                  icon={<Italic size="16" />}
                  variant={editor.isActive('italic') ? 'solid' : 'outline'}
                  isDisabled={!editor.can().chain().focus().toggleItalic().run()}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                />
                <IconButton
                  size="sm"
                  aria-label="Underline"
                  icon={<UnderlineIcon size="16" />}
                  variant={editor.isActive('underline') ? 'solid' : 'outline'}
                  isDisabled={
                    !editor.can().chain().focus().toggleUnderline().run()
                  }
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                />
                <IconButton
                  size="sm"
                  aria-label="Heading1"
                  icon={<Heading1 size="16" />}
                  variant={
                    editor.isActive('heading', { level: 1 }) ? 'solid' : 'outline'
                  }
                  isDisabled={
                    !editor.can().chain().focus().toggleHeading({ level: 1 }).run()
                  }
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 1 }).run()
                  }
                />
                <IconButton
                  size="sm"
                  aria-label="Heading2"
                  icon={<Heading2 size="16" />}
                  variant={
                    editor.isActive('heading', { level: 2 }) ? 'solid' : 'outline'
                  }
                  isDisabled={
                    !editor.can().chain().focus().toggleHeading({ level: 2 }).run()
                  }
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 2 }).run()
                  }
                />
                <IconButton
                  size="sm"
                  aria-label="Heading3"
                  icon={<Heading3 size="16" />}
                  variant={
                    editor.isActive('heading', { level: 3 }) ? 'solid' : 'outline'
                  }
                  isDisabled={
                    !editor.can().chain().focus().toggleHeading({ level: 3 }).run()
                  }
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 3 }).run()
                  }
                />
                <IconButton
                  size="sm"
                  aria-label="Bullet List"
                  icon={<List size="16" />}
                  variant={editor.isActive('bulletList') ? 'solid' : 'outline'}
                  isDisabled={
                    !editor.can().chain().focus().toggleBulletList().run()
                  }
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                />
                <IconButton
                  size="sm"
                  aria-label="Ordered List"
                  icon={<ListOrdered size="16" />}
                  variant={editor.isActive('orderedList') ? 'solid' : 'outline'}
                  isDisabled={
                    !editor.can().chain().focus().toggleOrderedList().run()
                  }
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                />
                <IconButton
                  size="sm"
                  aria-label="Quote"
                  icon={<Quote size="16" />}
                  variant={editor.isActive('blockquote') ? 'solid' : 'outline'}
                  isDisabled={
                    !editor.can().chain().focus().toggleBlockquote().run()
                  }
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                />
                <IconButton
                  size="sm"
                  aria-label="Set Link"
                  icon={<LinkIcon size="16" />}
                  variant={editor.isActive('link') ? 'solid' : 'outline'}
                  isDisabled={
                    !editor.can().chain().focus().setLink({ href: '' }).run()
                  }
                  onClick={() => {
                    const url = prompt('Enter the URL')
                    if (url) {
                      editor.chain().focus().setLink({ href: url }).run()
                    }
                  }}
                />
                <IconButton
                  size="sm"
                  aria-label="Unset Link"
                  icon={<Unlink size="16" />}
                  variant="outline"
                  isDisabled={
                    !editor.can().chain().focus().unsetLink().run()
                  }
                  onClick={() => editor.chain().focus().unsetLink().run()}
                />
              </HStack>
            )}
            <Box
              // Increased min height, slim border
              minH="24rem"
              border="1px"
              borderColor="gray.300"
              rounded="md"
              p={2}
            >
              <EditorContent editor={editor} />
            </Box>
            <FormHelperText>The message of the notification.</FormHelperText>
            <FormErrorMessage>
              {form.formState.errors.message && form.formState.errors.message.message}
            </FormErrorMessage>
          </FormControl>

          {/* From Date */}
          <FormControl mb={5} isInvalid={!!form.formState.errors.schedule}>
            <FormLabel>Schedule</FormLabel>

            <Popover placement="bottom-start">
              <PopoverTrigger>
                <Button
                  variant="outline"
                  w="240px"
                  justifyContent="flex-start"
                  // If no date is selected, show muted text
                  color={currentSchedule ? 'inherit' : 'gray.500'}
                  rightIcon={
                    <CalendarIcon style={{ opacity: 0.5, marginLeft: 'auto' }} />
                  }
                >
                  {currentSchedule ? format(currentSchedule as Date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <Portal>
                <PopoverContent w="auto">
                  <Calendar
                    mode="single"
                    selected={currentSchedule}
                    onSelect={date => form.setValue('schedule', date || undefined)}
                    initialFocus
                  />
                </PopoverContent>
              </Portal>
            </Popover>

            <FormHelperText>
              The email will be send <b>at 8:00</b> this date.
            </FormHelperText>
            <FormErrorMessage>
              {form.formState.errors.schedule && String(form.formState.errors.schedule.message)}
            </FormErrorMessage>
          </FormControl>

          {/* To */}
          <FormControl mb={5} isInvalid={!!form.formState.errors.to}>
            <FormLabel>To</FormLabel>
            {/* No gray background => default is white */}
            <Input placeholder="jane.doe@snek.at" bg="white" {...form.register('to')} />
            <FormHelperText>The recipient(s) of the email. Add multiple recipients separated by a comma.</FormHelperText>
            <FormErrorMessage>
              {form.formState.errors.to && form.formState.errors.to.message}
            </FormErrorMessage>
          </FormControl>

          {/* BCC */}
          <FormControl mb={5}>
            <FormLabel>BCC</FormLabel>
            {/* No gray background => default is white */}
            <Input placeholder="john.doe@snek.at" bg="white" {...form.register('bcc')} />
            <FormHelperText>Additional hidden recipient(s) of the email. Add multiple recipients separated by a comma.</FormHelperText>
            <FormErrorMessage>
              {form.formState.errors.bcc && form.formState.errors.bcc.message}
            </FormErrorMessage>
          </FormControl>

          {/* sendEmailOnSubmitConsent */}
          <FormControl display="flex" alignItems="center" mb={5}>
            <Checkbox
              mr={2}
              {...form.register('sendEmailOnSubmitConsent')}
              isChecked={form.watch('sendEmailOnSubmitConsent')}
              isInvalid={!!form.formState.errors.sendEmailOnSubmitConsent}
            />
            <FormLabel mb={0}>
              By checking this box, you agree that clicking the "Submit" button will send an email.
            </FormLabel>
          </FormControl>
        </CardBody>

        <CardFooter>
          {/* Use Chakra theme color brand.500 */}
          <Button type="submit" colorScheme="brand">
            Submit
          </Button>
        </CardFooter>
      </Card>

      {/* Preview Modal */}
      <Modal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} size="2xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Email Preview</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {/* Display selected template name */}
            <Heading size="sm" mb={2}>
              {selectedTemplate?.description || 'No Template Selected'}
            </Heading>
            {/* Display email subject */}
            <Heading size="md" mb={2}>
              {form.watch('subject') || ''}
            </Heading>
            {/* Render the processed message with variables replaced */}
            <Box
              dangerouslySetInnerHTML={{ __html: templateContent }}
              border="1px solid"
              borderColor="gray.100"
              p={4}
              rounded="md"
              minH="12rem" // Adjusted for better visibility
            />
            {/* Display additional notification details */}
            <Text mt={4} fontSize="sm" color="gray.600">
              {form.watch('sendEmailOnSubmitConsent')
                ? 'This notification is currently enabled.'
                : 'This notification is currently disabled.'}
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}

const Page: React.FC = () => {
  return <NotificationPopupFormComponent />
}

export default Page

export { Head } from 'jaen'

// Export the PageConfig
export const pageConfig: PageConfig = {
  label: 'Email',
  icon: 'FaEnvelope',
  menu: {
    type: 'app',
    group: 'mailpress',
    groupLabel: 'Mailpress',
    order: 500
  },
  layout: {
    name: 'jaen'
  },
  breadcrumbs: [
    {
      label: 'Mailpress',
      path: '/mailpress/'
    },
    {
      label: 'Templates',
      path: '/mailpress/email/'
    }
  ],
  auth: {
    isRequired: true,
    isAdminRequired: true
  }
}

export const query = graphql`
  query ($jaenPageId: String!) {
    ...JaenPageQuery
    allJaenPage {
      nodes {
        ...JaenPageData
        children {
          ...JaenPageData
        }
      }
    }
  }
`
