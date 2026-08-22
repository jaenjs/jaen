import {
  Button,
  ButtonGroup,
  Card,
  HStack,
  IconButton,
  Input,
  Stack,
  Text,
  List,
  StackSeparator
} from '@chakra-ui/react'
import React from 'react'
import {useForm} from 'react-hook-form'
import {useIntl} from 'react-intl'
import {FaTrash} from '@react-icons/all-files/fa/FaTrash'

import {Link} from '../../../../components/shared/Link'
import {FieldGroup} from '../../../../components/shared/FieldGroup'

interface EmailData {
  id: string
  emailAddress: string
  isVerified?: boolean
  isPrimary?: boolean
}

export interface EmailFormData {
  emailAddress: string
}

export interface EmailFormProps {
  onSubmit: (email: EmailFormData) => Promise<void>
  onRemove: (emailId: string) => Promise<void>
  onResendVerification: (emailId: string) => Promise<void>
  defaultValues?: {
    emails: EmailData[]
  }
}

export const EmailForm: React.FC<EmailFormProps> = ({
  onSubmit,
  onRemove,
  onResendVerification,
  defaultValues
}) => {
  const intl = useIntl()

  const {
    handleSubmit,
    register,
    control,
    formState: {errors, isSubmitting},
    setValue,
    reset
  } = useForm<EmailFormData>()

  const onFormSubmit = handleSubmit(async data => {
    await onSubmit(data)

    reset()
  })

  return (
    <FieldGroup
      title={intl.formatMessage({
        id: 'EmailFormTitle',
        defaultMessage: 'Emails'
      })}>
      <Stack gap="6">
        <Card.Root maxW="full">
          <Card.Body>
            <Stack separator={<StackSeparator />} gap="4">
              {defaultValues?.emails
                .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
                .map(email => {
                  return (
                    <Stack key={email.id}>
                      <HStack justify="space-between">
                        <HStack>
                          <Text fontSize="sm" fontWeight="bold">
                            {email.emailAddress}
                          </Text>
                          -{' '}
                          <Text>
                            {email.isPrimary && (
                              <>
                                -{'  '}
                                <Text fontSize="sm" as="span" color="green.500">
                                  {intl.formatMessage({
                                    id: 'EmailFormPrimaryLabel',
                                    defaultMessage: 'Primary'
                                  })}
                                </Text>
                              </>
                            )}
                          </Text>
                        </HStack>
                        <IconButton
                          size="xs"
                          aria-label={intl.formatMessage({
                            id: 'EmailFormDeleteAriaLabel',
                            defaultMessage: 'Delete email address'
                          })}
                          variant="ghost"
                          color="red.500"
                          visibility={email.isPrimary ? 'hidden' : 'visible'}
                          onClick={() => onRemove(email.id)}>
                          <FaTrash />
                        </IconButton>
                      </HStack>

                      <List.Root as="ul">
                        {email.isPrimary && (
                          <List.Item fontSize="sm" color="muted">
                            {intl.formatMessage({
                              id: 'EmailFormPrimaryHelpText',
                              defaultMessage:
                                'Primary email addresses are used for account-related communications (e.g. password resets).'
                            })}
                          </List.Item>
                        )}

                        {!email.isVerified && (
                          <List.Item fontSize="sm" color="muted">
                            <HStack>
                              <Text>
                                {intl.formatMessage({
                                  id: 'EmailFormUnverifiedLabel',
                                  defaultMessage: 'Unverified'
                                })}
                              </Text>
                              <Link
                                onClick={() => {
                                  onResendVerification(email.id)
                                }}>
                                {intl.formatMessage({
                                  id: 'EmailFormResendVerificationLink',
                                  defaultMessage: 'Resend verification email'
                                })}
                              </Link>
                            </HStack>
                          </List.Item>
                        )}
                      </List.Root>
                    </Stack>
                  )
                })}
            </Stack>
          </Card.Body>
        </Card.Root>

        <Stack gap="4">
          <Text fontSize="sm" color="muted">
            {intl.formatMessage({
              id: 'EmailFormAddDescription',
              defaultMessage: 'Add an email address to your account.'
            })}
          </Text>
          <form onSubmit={onFormSubmit}>
            <Stack direction="row" gap="4">
              <Input
                maxW="xs"
                {...register('emailAddress', {
                  required: intl.formatMessage({
                    id: 'EmailFormRequiredError',
                    defaultMessage: 'This field is required'
                  }),
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: intl.formatMessage({
                      id: 'EmailFormInvalidEmailError',
                      defaultMessage: 'Invalid email address'
                    })
                  }
                })}
                type="email"
                placeholder={intl.formatMessage({
                  id: 'EmailFormEmailPlaceholder',
                  defaultMessage: 'Email'
                })}
              />
              <ButtonGroup>
                <Button
                  type="submit"
                  loading={isSubmitting}
                  loadingText={intl.formatMessage({
                    id: 'EmailFormAddingLoadingText',
                    defaultMessage: 'Adding...'
                  })}
                  variant="outline">
                  {intl.formatMessage({
                    id: 'EmailFormAddButton',
                    defaultMessage: 'Add'
                  })}
                </Button>
              </ButtonGroup>
            </Stack>
          </form>
        </Stack>
      </Stack>
    </FieldGroup>
  )
}
