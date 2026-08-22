import React from 'react'
import {Input, Stack, Text, Button, ButtonGroup, Field} from '@chakra-ui/react'
import {useForm, Controller} from 'react-hook-form'
import {useIntl} from 'react-intl'

import {FieldGroup} from '../../../../components/shared/FieldGroup'

export interface PasswordFormData {
  password: string
  confirmPassword: string
}

export interface PasswordFormProps {
  onSubmit: (data: PasswordFormData) => Promise<void>
}

export const PasswordForm: React.FC<PasswordFormProps> = ({onSubmit}) => {
  const intl = useIntl()

  const {
    handleSubmit,
    control,
    formState: {isSubmitting, errors},
    watch
  } = useForm<PasswordFormData>()

  const onFormSubmit = handleSubmit(async data => {
    await onSubmit(data)
  })

  const password = watch('password', '')

  return (
    <form onSubmit={onFormSubmit}>
      <FieldGroup
        title={intl.formatMessage({
          id: 'PasswordFormTitle',
          defaultMessage: 'Password'
        })}>
        <Stack width="full" gap="6" maxW="2xl">
          <Input
            type="email"
            name="email"
            autoComplete="email"
            display="none"
          />

          <Field.Root id="password">
            <Field.Label>
              {intl.formatMessage({
                id: 'PasswordFormPasswordLabel',
                defaultMessage: 'Password'
              })}
            </Field.Label>
            <Controller
              control={control}
              name="password"
              rules={{
                required: intl.formatMessage({
                  id: 'PasswordFormRequiredError',
                  defaultMessage: 'This field is required'
                })
              }}
              render={({field}) => (
                <Input
                  maxW="xs"
                  {...field}
                  type="password"
                  autoComplete="new-password"
                />
              )}
            />
          </Field.Root>

          <Field.Root id="confirmPassword" invalid={!!errors.confirmPassword}>
            <Field.Label>
              {intl.formatMessage({
                id: 'PasswordFormConfirmPasswordLabel',
                defaultMessage: 'Confirm Password'
              })}
            </Field.Label>
            <Controller
              control={control}
              name="confirmPassword"
              rules={{
                required: intl.formatMessage({
                  id: 'PasswordFormRequiredError',
                  defaultMessage: 'This field is required'
                }),
                validate: value =>
                  value === password ||
                  intl.formatMessage({
                    id: 'PasswordFormMismatchError',
                    defaultMessage: 'Passwords do not match'
                  })
              }}
              render={({field}) => (
                <Input
                  maxW="xs"
                  {...field}
                  type="password"
                  autoComplete="new-password"
                />
              )}
            />

            <Field.ErrorText>
              {errors.confirmPassword && errors.confirmPassword.message}
            </Field.ErrorText>
          </Field.Root>

          {
            // update password or forgot password link
          }
          <Stack>
            <Text fontSize="sm" color="muted">
              {intl.formatMessage({
                id: 'PasswordFormHelpText',
                defaultMessage:
                  'Make sure your password is at least 15 characters OR at least 8 characters including a number and a lowercase letter.'
              })}
            </Text>

            <ButtonGroup>
              <Button loading={isSubmitting} type="submit" variant="outline">
                {intl.formatMessage({
                  id: 'PasswordFormUpdateButton',
                  defaultMessage: 'Update password'
                })}
              </Button>
            </ButtonGroup>
          </Stack>
        </Stack>
      </FieldGroup>
    </form>
  )
}
