import React, {useState, useEffect, useMemo, useCallback} from 'react'
import {graphql} from 'gatsby'
import {z} from 'zod'
import {useForm} from 'react-hook-form'
import {zodResolver} from '@hookform/resolvers/zod'
import {PageConfig, useNotificationsContext} from 'jaen'
import {useIntl, IntlShape} from 'react-intl'
import {intlText} from '../../../lib/intl'

// Tiptap
import {EditorContent, useEditor} from '@tiptap/react'
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

// Chakra UI
import {
  Box,
  Button,
  Card,
  CloseButton,
  Heading,
  Text,
  Input,
  Checkbox,
  HStack,
  IconButton,
  NativeSelect,
  Spinner,
  Alert,
  Field,
  Dialog,
  Portal
} from '@chakra-ui/react'

// GQty client (template listing)
import * as emailwerkClient from '../../../client'
import {GQtyError} from 'gqty'

// Public send helper of this package (maps the mailpress-shaped envelope
// onto emailwerk's sendTemplateMail args)
import {sendTemplateMail} from '../../../index'

// Sanitize HTML content
import DOMPurify from 'isomorphic-dompurify'

// Define the schema using Zod (built per locale so the validation messages
// go through react-intl)
const createEmailSendSchema = (intl: IntlShape) =>
  z.object({
    templateId: z.string().nonempty(
      intl.formatMessage({
        id: 'EmailwerkEmailValidationTemplateRequired',
        defaultMessage: 'Template is required'
      })
    ),
    subject: z.string().nonempty(
      intl.formatMessage({
        id: 'EmailwerkEmailValidationSubjectRequired',
        defaultMessage: 'Subject is required'
      })
    ),
    message: z.string().nonempty(
      intl.formatMessage({
        id: 'EmailwerkEmailValidationMessageRequired',
        defaultMessage: 'Message is required'
      })
    ),
    to: z
      .string()
      .nonempty(
        intl.formatMessage({
          id: 'EmailwerkEmailValidationToRequired',
          defaultMessage: 'To is required'
        })
      )
      .refine(
        val => {
          // Simple email validation
          const emails = val.split(',').map(email => email.trim())
          return emails.every(email => /\S+@\S+\.\S+/.test(email))
        },
        intl.formatMessage({
          id: 'EmailwerkEmailValidationInvalidEmail',
          defaultMessage: 'Invalid email address(es)'
        })
      ),
    bcc: z
      .string()
      .optional()
      .refine(
        val => {
          if (!val) return true
          const emails = val.split(',').map(email => email.trim())
          return emails.every(email => /\S+@\S+\.\S+/.test(email))
        },
        intl.formatMessage({
          id: 'EmailwerkEmailValidationInvalidBccEmail',
          defaultMessage: 'Invalid BCC email address(es)'
        })
      ),
    sendEmailOnSubmitConsent: z.boolean().refine(val => val === true, {
      message: intl.formatMessage({
        id: 'EmailwerkEmailValidationConsentRequired',
        defaultMessage: 'Consent is required.'
      })
    })
  })

type EmailPopupForm = z.infer<ReturnType<typeof createEmailSendSchema>>

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
  parentId?: string | null
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
  const intl = useIntl()
  const {toast} = useNotificationsContext()

  // Local state for controlling the "Preview" modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  // Local state for email templates
  const [emailTemplates, setEmailTemplates] = useState<
    Record<string, EmailTemplate>
  >({})
  const [isLoadingEmailTemplates, setIsLoadingEmailTemplates] = useState(false)
  const [fetchTemplatesError, setFetchTemplatesError] = useState<string | null>(
    null
  )

  // Function to fetch all email templates with necessary fields
  const getAllTemplates = useCallback(async () => {
    try {
      setIsLoadingEmailTemplates(true)
      setFetchTemplatesError(null)

      const result = await emailwerkClient.resolve(({query}) => {
        const templates = query.templates()

        return {
          allTemplates: templates.nodes.map(template => ({
            id: template.id,
            description: template.description,
            content: template.content,
            variables: template.variables.map(variable => ({
              name: variable.name,
              defaultValue: variable.defaultValue,
              description: variable.description
            })),
            envelope: {
              subject: template.envelope?.subject,
              to: template.envelope?.to?.slice(),
              replyTo: template.envelope?.replyTo
            },
            parentId: template.parentId
          }))
        }
      })

      const {allTemplates} = result

      if (!allTemplates) {
        throw new Error(
          intl.formatMessage({
            id: 'EmailwerkEmailTemplatesNotFound',
            defaultMessage: 'No templates found'
          })
        )
      }

      // Keep only "simple message" templates: every variable is named
      // `message`. emailwerk's TemplateView has no `links` field, so the old
      // "linked templates only" filter (links.length !== 0) is reproduced via
      // parentId chains: keep templates that at least one other template
      // references as its parent.
      const nodes = allTemplates
        .filter(template =>
          template.variables.every(variable => variable.name === 'message')
        )
        .filter(template =>
          allTemplates.some(other => other.parentId === template.id)
        )

      // Create a template dictionary with ID as key
      const templateDict: Record<string, EmailTemplate> = nodes.reduce(
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
        setFetchTemplatesError(
          intl.formatMessage({
            id: 'EmailwerkEmailTemplatesFetchGraphqlError',
            defaultMessage: 'Failed to fetch templates due to GraphQL error.'
          })
        )
      } else {
        setFetchTemplatesError(
          error.message ||
            intl.formatMessage({
              id: 'EmailwerkEmailTemplatesFetchUnknownError',
              defaultMessage:
                'An unknown error occurred while fetching templates.'
            })
        )
      }

      toast({
        title: intl.formatMessage({
          id: 'EmailwerkEmailTemplatesFetchErrorTitle',
          defaultMessage: 'Error fetching templates'
        }),
        description:
          error.message ||
          intl.formatMessage({
            id: 'EmailwerkEmailTemplatesFetchErrorDescription',
            defaultMessage: 'An error occurred while fetching templates.'
          }),
        status: 'error',
        duration: 5000,
        isClosable: true
      })
    } finally {
      setIsLoadingEmailTemplates(false)
    }
  }, [toast, intl])

  // Fetch email templates on component mount
  useEffect(() => {
    getAllTemplates()
  }, [getAllTemplates])

  // Initialize react-hook-form with Zod resolver
  const emailSendSchema = useMemo(() => createEmailSendSchema(intl), [intl])
  const form = useForm<EmailPopupForm>({
    resolver: zodResolver(emailSendSchema),
    defaultValues: {
      templateId: '', // Changed from undefined to empty string for Select component compatibility
      sendEmailOnSubmitConsent: false, // Changed to false as default
      subject: '',
      message: '',
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
        placeholder:
          emailTemplates[form.watch('templateId')]?.variables.find(
            variable => variable.name === 'message'
          )?.description ||
          intl.formatMessage({
            id: 'EmailwerkEmailMessagePlaceholder',
            defaultMessage: 'Enter your message here'
          })
      })
    ],
    content:
      emailTemplates[form.watch('templateId')]?.variables.find(
        variable => variable.name === 'message'
      )?.defaultValue || '',
    editorProps: {
      attributes: {
        // Only the focus ring stays a class; the frame around the editor is a
        // Chakra Box below. The rest used to be Tailwind utilities, which
        // resolved only because gatsby-plugin-jaen shipped tailwind to every
        // page of every consuming site.
        class: 'jaen-mdx-editor'
      }
    },
    onUpdate: ({editor}) => {
      form.setValue('message', editor.getHTML())
    }
  })

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
      return (
        form.watch('message') ||
        intl.formatMessage({
          id: 'EmailwerkEmailPreviewNoContent',
          defaultMessage: 'No content available'
        })
      )
    }

    // Create a variables mapping using defaultValue
    const variablesMap: Record<string, string> = {}
    selectedTemplate.variables.forEach(variable => {
      if (variable.name === 'message') {
        variablesMap[variable.name] =
          currentMessage || variable.defaultValue || ''
      } else if (variable.defaultValue) {
        variablesMap[variable.name] = variable.defaultValue
      } else {
        variablesMap[variable.name] = ''
      }
    })

    // Replace variables in the template content with a fallback
    const replacedMessage = replaceVariables(
      selectedTemplate.content || '',
      variablesMap
    )

    // Sanitize the replaced message
    return DOMPurify.sanitize(replacedMessage)
  }, [selectedTemplate, currentMessage, form, intl])

  // Handle form submission
  const onSubmit = async (values: EmailPopupForm) => {
    try {
      if (!values.templateId) {
        throw new Error(
          intl.formatMessage({
            id: 'EmailwerkEmailNoTemplateSelectedError',
            defaultMessage: 'No template selected.'
          })
        )
      }

      // Mailpress-era semantics kept on purpose: the form's `to` becomes the
      // reply-to; delivery recipients come from the template's STORED
      // envelope (the helper resolves them, since emailwerk requires `to`).
      const result = await sendTemplateMail(values.templateId, {
        envelope: {
          replyTo: values.to,
          subject: values.subject
          //bcc: (values.bcc || "").split(','),
        },
        values: {
          message: values.message
        }
      })

      if (!result.ok) {
        console.error('Mail failed:', result.errors ?? result.message)
        toast({
          title: intl.formatMessage({
            id: 'EmailwerkEmailSendFailedTitle',
            defaultMessage: 'Email Sending Failed'
          }),
          description: result.errors
            ? result.errors.map((err: any) => err.message).join(', ')
            : result.message,
          status: 'error',
          duration: 5000,
          isClosable: true
        })
      } else {
        console.log('Mail sent:', result.message)
        toast({
          title: intl.formatMessage({
            id: 'EmailwerkEmailSentTitle',
            defaultMessage: 'Email sent'
          }),
          description: intl.formatMessage({
            id: 'EmailwerkEmailSentDescription',
            defaultMessage: 'The email has been sent successfully.'
          }),
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
        title: intl.formatMessage({
          id: 'EmailwerkEmailSubmissionErrorTitle',
          defaultMessage: 'Submission Error'
        }),
        description:
          error.message ||
          intl.formatMessage({
            id: 'EmailwerkEmailUnexpectedError',
            defaultMessage: 'An unexpected error occurred.'
          }),
        status: 'error',
        duration: 5000,
        isClosable: true
      })
    }
  }

  return (
    <Box asChild>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card.Root variant="outline">
          <Card.Header>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center">
              <Box>
                <Heading size="sm">
                  {intl.formatMessage({
                    id: 'EmailwerkEmailFormHeading',
                    defaultMessage: 'Send Email'
                  })}
                </Heading>
              </Box>
              <Button variant="outline" onClick={() => setIsPreviewOpen(true)}>
                {intl.formatMessage({
                  id: 'EmailwerkEmailPreviewButton',
                  defaultMessage: 'Preview'
                })}
              </Button>
            </Box>
          </Card.Header>

          <Card.Body>
            {/* Email Template Select */}
            <Field.Root mb={5} invalid={!!form.formState.errors.templateId}>
              <Field.Label>
                {intl.formatMessage({
                  id: 'EmailwerkEmailTemplateLabel',
                  defaultMessage: 'Email Template'
                })}
              </Field.Label>
              {isLoadingEmailTemplates ? (
                <HStack>
                  <Spinner size="sm" />
                  <Text>
                    {intl.formatMessage({
                      id: 'EmailwerkEmailTemplatesLoading',
                      defaultMessage: 'Loading templates...'
                    })}
                  </Text>
                </HStack>
              ) : fetchTemplatesError ? (
                <Alert.Root status="error">
                  <Alert.Indicator />
                  <Alert.Title mr={2}>
                    {intl.formatMessage({
                      id: 'EmailwerkEmailErrorAlertTitle',
                      defaultMessage: 'Error!'
                    })}
                  </Alert.Title>
                  <Alert.Description>{fetchTemplatesError}</Alert.Description>
                </Alert.Root>
              ) : Object.keys(emailTemplates).length === 0 ? (
                <Alert.Root status="warning">
                  <Alert.Indicator />
                  <Alert.Title mr={2}>
                    {intl.formatMessage({
                      id: 'EmailwerkEmailNoTemplatesAlertTitle',
                      defaultMessage: 'No Templates Found!'
                    })}
                  </Alert.Title>
                  <Alert.Description>
                    {intl.formatMessage({
                      id: 'EmailwerkEmailNoTemplatesAlertDescription',
                      defaultMessage:
                        'There are no email templates available. Please create one first.'
                    })}
                  </Alert.Description>
                </Alert.Root>
              ) : (
                <NativeSelect.Root>
                  <NativeSelect.Field
                    placeholder={intl.formatMessage({
                      id: 'EmailwerkEmailTemplateSelectPlaceholder',
                      defaultMessage: 'Select an email template'
                    })}
                    {...form.register('templateId', {
                      required: intl.formatMessage({
                        id: 'EmailwerkEmailValidationTemplateRequired',
                        defaultMessage: 'Template is required'
                      }),
                      onChange: e => {
                        form.setValue('templateId', e.target.value)
                        if (editor) {
                          // and if the previous template message default value is equal to form.watch('message')
                          // then set the editor content to the new template message default value
                          if (
                            form.watch('message') == '' ||
                            form.watch('message') == '<p></p>'
                          ) {
                            editor.commands.setContent(
                              emailTemplates[e.target.value]?.variables.find(
                                variable => variable.name === 'message'
                              )?.defaultValue || ''
                            )
                          }
                          form.setValue(
                            'subject',
                            emailTemplates[e.target.value]?.envelope?.subject ||
                              ''
                          )
                        }
                      }
                    })}>
                    {Object.values(emailTemplates).map(
                      (template: EmailTemplate) => (
                        <option key={template.id} value={template.id}>
                          {template.description ||
                            intl.formatMessage({
                              id: 'EmailwerkEmailUnnamedTemplate',
                              defaultMessage: 'Unnamed Template'
                            })}
                        </option>
                      )
                    )}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              )}
              <Field.HelperText>
                {intl.formatMessage({
                  id: 'EmailwerkEmailTemplateHelperText',
                  defaultMessage: 'The template for the email.'
                })}
              </Field.HelperText>
              <Field.ErrorText>
                {form.formState.errors.templateId &&
                  form.formState.errors.templateId.message}
              </Field.ErrorText>
            </Field.Root>

            {/* To */}
            <Field.Root mb={5} invalid={!!form.formState.errors.to}>
              <Field.Label>
                {intl.formatMessage({
                  id: 'EmailwerkEmailToLabel',
                  defaultMessage: 'To'
                })}
              </Field.Label>
              <Input
                placeholder={intl.formatMessage({
                  id: 'EmailwerkEmailToPlaceholder',
                  defaultMessage: 'jane.doe@snek.at'
                })}
                bg="white !important"
                {...form.register('to')}
              />
              <Field.HelperText>
                {intl.formatMessage({
                  id: 'EmailwerkEmailToHelperText',
                  defaultMessage:
                    'The recipient(s) of the email. Add multiple recipients separated by a comma.'
                })}
              </Field.HelperText>
              <Field.ErrorText>
                {form.formState.errors.to && form.formState.errors.to.message}
              </Field.ErrorText>
            </Field.Root>

            {/* Subject */}
            <Field.Root mb={5} invalid={!!form.formState.errors.subject}>
              <Field.Label>
                {intl.formatMessage({
                  id: 'EmailwerkEmailSubjectLabel',
                  defaultMessage: 'Subject'
                })}
              </Field.Label>
              <Input
                placeholder={intl.formatMessage({
                  id: 'EmailwerkEmailSubjectPlaceholder',
                  defaultMessage: 'Hi there'
                })}
                bg="white !important"
                {...form.register('subject')}
              />
              <Field.HelperText>
                {intl.formatMessage({
                  id: 'EmailwerkEmailSubjectHelperText',
                  defaultMessage: 'The subject of the email.'
                })}
              </Field.HelperText>
              <Field.ErrorText>
                {form.formState.errors.subject &&
                  form.formState.errors.subject.message}
              </Field.ErrorText>
            </Field.Root>

            {/* Message + Tiptap Toolbar */}
            <Field.Root
              mb={5}
              invalid={!!form.formState.errors.message}
              css={{
                '& .tiptap p.is-empty::before': {
                  color: '#adb5bd',
                  content: 'attr(data-placeholder)',
                  float: 'left',
                  height: '0',
                  pointerEvents: 'none'
                }
              }}>
              <Field.Label>
                {intl.formatMessage({
                  id: 'EmailwerkEmailMessageLabel',
                  defaultMessage: 'Message'
                })}
              </Field.Label>
              {editor && (
                <HStack mb={2} gap={1}>
                  <IconButton
                    size="sm"
                    aria-label={intl.formatMessage({
                      id: 'EmailwerkEmailEditorBold',
                      defaultMessage: 'Bold'
                    })}
                    variant={editor.isActive('bold') ? 'solid' : 'outline'}
                    disabled={!editor.can().chain().focus().toggleBold().run()}
                    onClick={() => editor.chain().focus().toggleBold().run()}>
                    <Bold size="16" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    aria-label={intl.formatMessage({
                      id: 'EmailwerkEmailEditorItalic',
                      defaultMessage: 'Italic'
                    })}
                    variant={editor.isActive('italic') ? 'solid' : 'outline'}
                    disabled={
                      !editor.can().chain().focus().toggleItalic().run()
                    }
                    onClick={() => editor.chain().focus().toggleItalic().run()}>
                    <Italic size="16" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    aria-label={intl.formatMessage({
                      id: 'EmailwerkEmailEditorUnderline',
                      defaultMessage: 'Underline'
                    })}
                    variant={editor.isActive('underline') ? 'solid' : 'outline'}
                    disabled={
                      !editor.can().chain().focus().toggleUnderline().run()
                    }
                    onClick={() =>
                      editor.chain().focus().toggleUnderline().run()
                    }>
                    <UnderlineIcon size="16" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    aria-label={intl.formatMessage({
                      id: 'EmailwerkEmailEditorHeading1',
                      defaultMessage: 'Heading1'
                    })}
                    variant={
                      editor.isActive('heading', {level: 1})
                        ? 'solid'
                        : 'outline'
                    }
                    disabled={
                      !editor
                        .can()
                        .chain()
                        .focus()
                        .toggleHeading({level: 1})
                        .run()
                    }
                    onClick={() =>
                      editor.chain().focus().toggleHeading({level: 1}).run()
                    }>
                    <Heading1 size="16" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    aria-label={intl.formatMessage({
                      id: 'EmailwerkEmailEditorHeading2',
                      defaultMessage: 'Heading2'
                    })}
                    variant={
                      editor.isActive('heading', {level: 2})
                        ? 'solid'
                        : 'outline'
                    }
                    disabled={
                      !editor
                        .can()
                        .chain()
                        .focus()
                        .toggleHeading({level: 2})
                        .run()
                    }
                    onClick={() =>
                      editor.chain().focus().toggleHeading({level: 2}).run()
                    }>
                    <Heading2 size="16" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    aria-label={intl.formatMessage({
                      id: 'EmailwerkEmailEditorHeading3',
                      defaultMessage: 'Heading3'
                    })}
                    variant={
                      editor.isActive('heading', {level: 3})
                        ? 'solid'
                        : 'outline'
                    }
                    disabled={
                      !editor
                        .can()
                        .chain()
                        .focus()
                        .toggleHeading({level: 3})
                        .run()
                    }
                    onClick={() =>
                      editor.chain().focus().toggleHeading({level: 3}).run()
                    }>
                    <Heading3 size="16" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    aria-label={intl.formatMessage({
                      id: 'EmailwerkEmailEditorBulletList',
                      defaultMessage: 'Bullet List'
                    })}
                    variant={
                      editor.isActive('bulletList') ? 'solid' : 'outline'
                    }
                    disabled={
                      !editor.can().chain().focus().toggleBulletList().run()
                    }
                    onClick={() =>
                      editor.chain().focus().toggleBulletList().run()
                    }>
                    <List size="16" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    aria-label={intl.formatMessage({
                      id: 'EmailwerkEmailEditorOrderedList',
                      defaultMessage: 'Ordered List'
                    })}
                    variant={
                      editor.isActive('orderedList') ? 'solid' : 'outline'
                    }
                    disabled={
                      !editor.can().chain().focus().toggleOrderedList().run()
                    }
                    onClick={() =>
                      editor.chain().focus().toggleOrderedList().run()
                    }>
                    <ListOrdered size="16" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    aria-label={intl.formatMessage({
                      id: 'EmailwerkEmailEditorQuote',
                      defaultMessage: 'Quote'
                    })}
                    variant={
                      editor.isActive('blockquote') ? 'solid' : 'outline'
                    }
                    disabled={
                      !editor.can().chain().focus().toggleBlockquote().run()
                    }
                    onClick={() =>
                      editor.chain().focus().toggleBlockquote().run()
                    }>
                    <Quote size="16" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    aria-label={intl.formatMessage({
                      id: 'EmailwerkEmailEditorSetLink',
                      defaultMessage: 'Set Link'
                    })}
                    variant={editor.isActive('link') ? 'solid' : 'outline'}
                    disabled={
                      !editor.can().chain().focus().setLink({href: ''}).run()
                    }
                    onClick={() => {
                      const url = prompt(
                        intl.formatMessage({
                          id: 'EmailwerkEmailEditorLinkPrompt',
                          defaultMessage: 'Enter the URL'
                        })
                      )
                      if (url) {
                        editor.chain().focus().setLink({href: url}).run()
                      }
                    }}>
                    <LinkIcon size="16" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    aria-label={intl.formatMessage({
                      id: 'EmailwerkEmailEditorUnsetLink',
                      defaultMessage: 'Unset Link'
                    })}
                    variant="outline"
                    disabled={!editor.can().chain().focus().unsetLink().run()}
                    onClick={() => editor.chain().focus().unsetLink().run()}>
                    <Unlink size="16" />
                  </IconButton>
                </HStack>
              )}
              <Box
                // Increased min height, slim border
                minH="24rem"
                border="1px"
                borderColor="gray.300"
                rounded="md"
                p={2}
                // What the `prose` and `focus:outline-none` utilities did before,
                // stated here instead. tiptap emits plain HTML with no classes of
                // its own, so the block elements need to be given their shape
                // back or the message reads as one undifferentiated paragraph.
                css={{
                  '& .jaen-mdx-editor': {outline: 'none'},
                  '& h1': {fontSize: '2xl', fontWeight: 'bold', mt: 4, mb: 2},
                  '& h2': {fontSize: 'xl', fontWeight: 'bold', mt: 4, mb: 2},
                  '& h3': {
                    fontSize: 'lg',
                    fontWeight: 'semibold',
                    mt: 3,
                    mb: 2
                  },
                  '& p': {mb: 2},
                  '& ul, ol': {pl: 6, mb: 2},
                  '& ul': {listStyleType: 'disc'},
                  '& ol': {listStyleType: 'decimal'},

                  '& blockquote': {
                    borderLeft: '3px solid',
                    borderColor: 'gray.300',
                    pl: 3,
                    color: 'fg.muted',
                    my: 2
                  },

                  '& a': {color: 'brand.500', textDecoration: 'underline'}
                }}>
                <EditorContent editor={editor} />
              </Box>
              <Field.HelperText>
                {intl.formatMessage({
                  id: 'EmailwerkEmailMessageHelperText',
                  defaultMessage: 'The message of the email.'
                })}
              </Field.HelperText>
              <Field.ErrorText>
                {form.formState.errors.message &&
                  form.formState.errors.message.message}
              </Field.ErrorText>
            </Field.Root>

            {/* BCC DISABLED */}
            <Field.Root
              mb={5}
              invalid={!!form.formState.errors.bcc}
              display="none">
              <Field.Label>
                {intl.formatMessage({
                  id: 'EmailwerkEmailBccLabel',
                  defaultMessage: 'BCC'
                })}
              </Field.Label>
              <Input
                placeholder={intl.formatMessage({
                  id: 'EmailwerkEmailBccPlaceholder',
                  defaultMessage: 'john.doe@snek.at'
                })}
                bg="white"
                {...form.register('bcc')}
              />
              <Field.HelperText>
                {intl.formatMessage({
                  id: 'EmailwerkEmailBccHelperText',
                  defaultMessage:
                    'Additional hidden recipient(s) of the email. Add multiple recipients separated by a comma.'
                })}
              </Field.HelperText>
              <Field.ErrorText>
                {form.formState.errors.bcc && form.formState.errors.bcc.message}
              </Field.ErrorText>
            </Field.Root>

            {/* sendEmailOnSubmitConsent */}
            <Field.Root
              display="flex"
              alignItems="center"
              mb={5}
              invalid={!!form.formState.errors.sendEmailOnSubmitConsent}>
              <Checkbox.Root
                mr={2}
                {...form.register('sendEmailOnSubmitConsent')}
                checked={form.watch('sendEmailOnSubmitConsent')}>
                <Checkbox.HiddenInput />
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
              </Checkbox.Root>
              <Field.Label mb={0}>
                {intl.formatMessage({
                  id: 'EmailwerkEmailConsentLabel',
                  defaultMessage:
                    'By checking this box, you agree that clicking the "Send" button will send an email.'
                })}
              </Field.Label>
              <Field.ErrorText>
                {form.formState.errors.sendEmailOnSubmitConsent &&
                  form.formState.errors.sendEmailOnSubmitConsent.message}
              </Field.ErrorText>
            </Field.Root>
          </Card.Body>

          <Card.Footer>
            {/* Use Chakra theme color brand.500 */}
            <Button type="submit" colorPalette="brand">
              {intl.formatMessage({
                id: 'EmailwerkEmailSendButton',
                defaultMessage: 'Send'
              })}
            </Button>
          </Card.Footer>
        </Card.Root>

        {/* Preview Modal */}
        <Dialog.Root
          open={isPreviewOpen}
          size="xl"
          onOpenChange={e => {
            if (!e.open) {
              setIsPreviewOpen(false)
            }
          }}>
          <Portal>
            <Dialog.Backdrop />
            <Dialog.Positioner>
              <Dialog.Content>
                <Dialog.Header>
                  {intl.formatMessage({
                    id: 'EmailwerkEmailPreviewTitle',
                    defaultMessage: 'Email Preview'
                  })}
                </Dialog.Header>
                {/* v3's CloseTrigger draws nothing of its own, so the X that
                    v2's ModalCloseButton brought has to be handed to it, at
                    the 32px and neutral hover v2 gave it. */}
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="xs" colorPalette="gray" />
                </Dialog.CloseTrigger>
                <Dialog.Body>
                  {/* Display selected template name */}
                  <Heading size="sm" mb={2}>
                    {selectedTemplate?.description ||
                      intl.formatMessage({
                        id: 'EmailwerkEmailPreviewNoTemplate',
                        defaultMessage: 'No Template Selected'
                      })}
                  </Heading>
                  {/* Display email subject */}
                  <Heading size="md" mb={2}>
                    {form.watch('subject') ||
                      intl.formatMessage({
                        id: 'EmailwerkEmailPreviewNoSubject',
                        defaultMessage: 'No Subject'
                      })}
                  </Heading>
                  {/* Render the processed message with variables replaced */}
                  <Box
                    dangerouslySetInnerHTML={{__html: templateContent}}
                    border="1px solid"
                    borderColor="gray.100"
                    p={4}
                    rounded="md"
                    minH="12rem" // Adjusted for better visibility
                  />
                </Dialog.Body>
                <Dialog.Footer>
                  <Button onClick={() => setIsPreviewOpen(false)}>
                    {intl.formatMessage({
                      id: 'EmailwerkEmailPreviewCloseButton',
                      defaultMessage: 'Close'
                    })}
                  </Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
      </form>
    </Box>
  )
}

const Page: React.FC = () => {
  return <EmailSendFormComponent />
}

export default Page

export {Head} from 'jaen'

// Export the PageConfig
export const pageConfig: PageConfig = {
  label: intlText('EmailwerkEmailPageTitle', 'Email'),
  icon: 'FaEnvelope',
  menu: {
    type: 'app',
    group: 'emailwerk',
    groupLabel: intlText('EmailwerkMenuGroupLabel', 'Emailwerk'),
    order: 500
  },
  layout: {
    name: 'jaen'
  },
  breadcrumbs: [
    {
      label: intlText('EmailwerkBreadcrumbsRoot', 'Emailwerk'),
      path: '/emailwerk/'
    },
    {
      label: intlText('EmailwerkEmailBreadcrumbsEmail', 'Email'),
      path: '/emailwerk/email/'
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
