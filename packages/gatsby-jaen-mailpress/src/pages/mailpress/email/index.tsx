import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { graphql } from 'gatsby'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { PageConfig } from 'jaen'

// Tiptap
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'

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

// GQty client
import * as gqtyMailpressClient from '../../../client'
import { GQtyError } from 'gqty'

// Sanitize HTML content
import DOMPurify from 'isomorphic-dompurify'

// Function to send template mail
const sendTemplateMail = async (
  id: string,
  options?: {
    envelope?: Partial<gqtyMailpressClient.EnvelopeInput>
    values?: Record<string, any>
  }
) => {
  try {
    await gqtyMailpressClient.resolve(
      ({ mutation }) => {
        const mail = mutation.sendTemplateMail({
          id,
          envelope: options?.envelope,
          values: options?.values
        })

        return mail
      },
      {
        cachePolicy: 'no-store'
      }
    )

    return {
      ok: true,
      message: 'Mail sent successfully'
    }
  } catch (error: any) {
    if (error instanceof GQtyError) {
      return {
        ok: false,
        message: 'Failed to send mail',
        errors: error.graphQLErrors
      }
    }

    return {
      ok: false,
      message: error.message
    }
  }
}

// Define the schema using Zod
const EmailSendSchema = z.object({
  templateId: z.string().nonempty('Template is required'),
  subject: z.string().nonempty('Subject is required'),
  message: z.string().nonempty('Message is required'),
  schedule: z
    .date()
    .or(z.string().transform(val => new Date(val)))
    .optional(),
  to: z
    .string()
    .nonempty('To is required')
    .refine(val => {
      // Simple email validation
      const emails = val.split(',').map(email => email.trim())
      return emails.every(email => /\S+@\S+\.\S+/.test(email))
    }, 'Invalid email address(es)'),
  bcc: z
    .string()
    .optional()
    .refine(val => {
      if (!val) return true
      const emails = val.split(',').map(email => email.trim())
      return emails.every(email => /\S+@\S+\.\S+/.test(email))
    }, 'Invalid BCC email address(es)'),
  sendEmailOnSubmitConsent: z.boolean().refine(val => val === true, {
    message: 'Consent is required.'
  })
})

type EmailPopupForm = z.infer<typeof EmailSendSchema>

// Define the EmailTemplate interface
interface EmailTemplate {
  id: string
  description: string
  content: string
  envelope?: {
    subject?: string | null
    to?: string[] | null // Adjusted to match actual data
    replyTo?: string | null
  } | null
  links: Array<any> // Assuming links are also EmailTemplates
  variables: Array<{
    name: string
    defaultValue?: string | null
    description?: string | null
  }>
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
const EmailSendFormComponent: React.FC = () => {
  const toast = useToast()

  // Local state for controlling the "Preview" modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  // Local state for email templates
  const [emailTemplates, setEmailTemplates] = useState<Record<string, EmailTemplate>>({})
  const [isLoadingEmailTemplates, setIsLoadingEmailTemplates] = useState(false)
  const [fetchTemplatesError, setFetchTemplatesError] = useState<string | null>(null)

  // Function to fetch all email templates with necessary fields
  const getAllTemplates = useCallback(async () => {
    try {
      setIsLoadingEmailTemplates(true)
      setFetchTemplatesError(null)

      const result = await gqtyMailpressClient.resolve(({ query }) => {
        const allTemplate = query.allTemplate({
          // Add any necessary arguments or filters here
        })

        return {
          allTemplate: {
            nodes: allTemplate.nodes.map(template => ({
              id: template.id,
              description: template.description,
              content: template.content,
              variables: template.variables.map(variable => ({
                name: variable.name,
                defaultValue: variable.defaultValue
              })),
              envelope: {
                subject: template.envelope?.subject,
                to: template.envelope?.to,
                replyTo: template.envelope?.replyTo
              },
              links: template.links.map(link => ({
                id: link.id
              }))
            })).filter(template => template.variables.every(variable => variable.name === 'message')).filter(template => template.links.length !== 0),
          }
        }
      })

      const { allTemplate } = result

      if (!allTemplate || !allTemplate.nodes) {
        throw new Error('No templates found')
      }

      // Create a template dictionary with ID as key
      const templateDict: Record<string, EmailTemplate> = allTemplate.nodes.reduce(
        (acc, template) => {
          acc[template.id] = template
          return acc
        },
        {} as Record<string, EmailTemplate>
      )

      setEmailTemplates(templateDict)
    } catch (error: any) {
      console.error('Failed to fetch templates:', error)
      if (error instanceof GQtyError) {
        setFetchTemplatesError('Failed to fetch templates due to GraphQL error.')
      } else {
        setFetchTemplatesError(error.message || 'An unknown error occurred while fetching templates.')
      }

      toast({
        title: 'Error fetching templates',
        description: error.message || 'An error occurred while fetching templates.',
        status: 'error',
        duration: 5000,
        isClosable: true
      })
    } finally {
      setIsLoadingEmailTemplates(false)
    }
  }, [gqtyMailpressClient, toast])

  // Fetch email templates on component mount
  useEffect(() => {
    getAllTemplates()
  }, [getAllTemplates])

  // Initialize react-hook-form with Zod resolver
  const form = useForm<EmailPopupForm>({
    resolver: zodResolver(EmailSendSchema),
    defaultValues: {
      templateId: '', // Changed from undefined to empty string for Select component compatibility
      sendEmailOnSubmitConsent: false, // Changed to false as default
      subject: '',
      message: '',
      schedule: undefined,
      to: '',
      bcc: ''
    }
  })

  // Initialize Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link,
      Underline,
      Placeholder.configure({
        placeholder: emailTemplates[form.watch('templateId')]?.variables.find(
          variable => variable.name === 'message',
        )?.description || 'Enter your message here'
      }),
    ],
    content: emailTemplates[form.watch('templateId')]?.variables.find(
      variable => variable.name === 'message',
    )?.defaultValue || '',
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
  const selectedEmailTemplateId = form.watch('templateId')
  const currentMessage = form.watch('message') // Added to watch 'message'

  // Find the selected template's description for preview
  const selectedTemplate = useMemo(() => {
    if (selectedEmailTemplateId && selectedEmailTemplateId.trim() !== '') {
      return emailTemplates[selectedEmailTemplateId] || null
    }
    return null
  }, [emailTemplates, selectedEmailTemplateId])

  // Generate the template content for preview
  const templateContent = useMemo(() => {
    if (!selectedTemplate) {
      return form.watch('message') || 'No content available'
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
  }, [selectedTemplate, currentMessage, form])

  // Handle form submission
  const onSubmit = async (values: EmailPopupForm) => {
    try {
      if (!values.templateId) {
        throw new Error('No template selected.')
      }

      const { ok, message, errors } = await sendTemplateMail(
        values.templateId,
        {
          envelope: {
            replyTo: values.to,
            subject: values.subject,
            //bcc: (values.bcc || "").split(','),
            //schedule: values.schedule
          },
          values: {
            message: values.message,
          },
        }
      )

      if (!ok) {
        console.error('Mail failed:', errors || message)
        toast({
          title: 'Email Sending Failed',
          description: errors
            ? errors.map((err: any) => err.message).join(', ')
            : message,
          status: 'error',
          duration: 5000,
          isClosable: true
        })
      } else {
        console.log('Mail sent:', message)
        toast({
          title: 'Email sent',
          description: 'The email has been sent successfully.',
          status: 'success',
          duration: 3000,
          isClosable: true
        })

        // Optionally, reset the form or perform other actions
        form.reset()
        if (editor) {
          editor.commands.clearContent()
        }
      }
    } catch (error: any) {
      console.error('Submission Error:', error)
      toast({
        title: 'Submission Error',
        description: error.message || 'An unexpected error occurred.',
        status: 'error',
        duration: 5000,
        isClosable: true
      })
    }
  }

  return (
    <Box as="form" onSubmit={form.handleSubmit(onSubmit)}>
      <Card variant="outline">
        <CardHeader>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Heading size="sm">Send Email</Heading>
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
            {isLoadingEmailTemplates ? (
              <HStack>
                <Spinner size="sm" />
                <Text>Loading templates...</Text>
              </HStack>
            ) : fetchTemplatesError ? (
              <Alert status="error">
                <AlertIcon />
                <AlertTitle mr={2}>Error!</AlertTitle>
                <AlertDescription>
                  {fetchTemplatesError}
                </AlertDescription>
              </Alert>
            ) : Object.keys(emailTemplates).length === 0 ? (
              <Alert status="warning">
                <AlertIcon />
                <AlertTitle mr={2}>No Templates Found!</AlertTitle>
                <AlertDescription>
                  There are no email templates available. Please create one first.
                </AlertDescription>
              </Alert>
            ) : (
              <Select
                placeholder="Select an email template"
                {...form.register('templateId', {
                  required: 'Template is required',
                  onChange: (e) => {
                    form.setValue('templateId', e.target.value);
                    if (editor) {
                      // and if the previous template message default value is equal to form.watch('message')
                      // then set the editor content to the new template message default value
                      if (form.watch('message') == '' || form.watch('message') == '<p></p>') {
                        editor.commands.setContent(emailTemplates[e.target.value]?.variables.find(
                          variable => variable.name === 'message',
                        )?.defaultValue || '');
                      }
                      form.setValue('subject', emailTemplates[e.target.value]?.envelope?.subject || '');
                    }
                  },
                })}
              >
                {Object.values(emailTemplates).map((template: EmailTemplate) => (
                  <option key={template.id} value={template.id}>
                    {template.description || 'Unnamed Template'}
                  </option>
                ))}
              </Select>
            )}
            <FormHelperText>The template for the email.</FormHelperText>
            <FormErrorMessage>
              {form.formState.errors.templateId && form.formState.errors.templateId.message}
            </FormErrorMessage>
          </FormControl>

          {/* To */}
          <FormControl mb={5} isInvalid={!!form.formState.errors.to}>
            <FormLabel>To</FormLabel>
            <Input
              placeholder="jane.doe@snek.at"
              bg="white !important"
              {...form.register('to')}
            />
            <FormHelperText>
              The recipient(s) of the email. Add multiple recipients separated by a comma.
            </FormHelperText>
            <FormErrorMessage>
              {form.formState.errors.to && form.formState.errors.to.message}
            </FormErrorMessage>
          </FormControl>

          {/* Subject */}
          <FormControl mb={5} isInvalid={!!form.formState.errors.subject}>
            <FormLabel>Subject</FormLabel>
            <Input
              placeholder="Hi there"
              bg="white !important"
              {...form.register('subject')}
            />
            <FormHelperText>The subject of the email.</FormHelperText>
            <FormErrorMessage>
              {form.formState.errors.subject && form.formState.errors.subject.message}
            </FormErrorMessage>
          </FormControl>

          {/* Message + Tiptap Toolbar */}
          <FormControl mb={5} isInvalid={!!form.formState.errors.message}
            sx={{
              '.tiptap p.is-empty::before': {
                color: '#adb5bd',
                content: 'attr(data-placeholder)',
                float: 'left',
                height: '0',
                pointerEvents: 'none',
              }
            }}>
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
            <FormHelperText>The message of the email.</FormHelperText>
            <FormErrorMessage>
              {form.formState.errors.message && form.formState.errors.message.message}
            </FormErrorMessage>
          </FormControl>

          {/* Schedule DISABLED */}
          <FormControl mb={5} isInvalid={!!form.formState.errors.schedule} display="none">
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
                  {currentSchedule ? format(new Date(currentSchedule), 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <Portal>
                <PopoverContent w="auto">
                  <Calendar
                    mode="single"
                    selected={currentSchedule ? new Date(currentSchedule) : undefined}
                    onSelect={date => form.setValue('schedule', date || undefined)}
                    initialFocus
                  />
                </PopoverContent>
              </Portal>
            </Popover>

            <FormHelperText>
              The email will be sent <b>at 8:00</b> on this date.
            </FormHelperText>
            <FormErrorMessage>
              {form.formState.errors.schedule && String(form.formState.errors.schedule.message)}
            </FormErrorMessage>
          </FormControl>

          {/* BCC DISABLED */}
          <FormControl mb={5} isInvalid={!!form.formState.errors.bcc} display="none">
            <FormLabel>BCC</FormLabel>
            <Input
              placeholder="john.doe@snek.at"
              bg="white"
              {...form.register('bcc')}
            />
            <FormHelperText>
              Additional hidden recipient(s) of the email. Add multiple recipients separated by a comma.
            </FormHelperText>
            <FormErrorMessage>
              {form.formState.errors.bcc && form.formState.errors.bcc.message}
            </FormErrorMessage>
          </FormControl>

          {/* sendEmailOnSubmitConsent */}
          <FormControl
            display="flex"
            alignItems="center"
            mb={5}
            isInvalid={!!form.formState.errors.sendEmailOnSubmitConsent}
          >
            <Checkbox
              mr={2}
              {...form.register('sendEmailOnSubmitConsent')}
              isChecked={form.watch('sendEmailOnSubmitConsent')}
            />
            <FormLabel mb={0}>
              By checking this box, you agree that clicking the "Send" button will send an email.
            </FormLabel>
            <FormErrorMessage>
              {form.formState.errors.sendEmailOnSubmitConsent && form.formState.errors.sendEmailOnSubmitConsent.message}
            </FormErrorMessage>
          </FormControl>
        </CardBody>

        <CardFooter>
          {/* Use Chakra theme color brand.500 */}
          <Button type="submit" colorScheme="brand">
            Send
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
              {form.watch('subject') || 'No Subject'}
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
  return <EmailSendFormComponent />
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
