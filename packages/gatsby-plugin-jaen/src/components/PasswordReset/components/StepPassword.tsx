import React from 'react'
import {useIntl} from 'react-intl'
import {useForm, Controller} from 'react-hook-form'
import {Input, Button, Stack, Field} from '@chakra-ui/react'

interface FormData {
  password: string
  confirmPassword: string
}

export interface StepEmailProps {
  onSubmit: (data: FormData) => Promise<void>
}

const StepPassword: React.FC<StepEmailProps> = props => {
  const intl = useIntl()
  const {
    handleSubmit,
    control,
    watch,
    formState: {isSubmitting, errors}
  } = useForm<FormData>()

  const password = watch('password', '')

  const onSubmit = async (data: FormData) => {
    await props.onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack gap="5">
        <Input type="email" name="email" autoComplete="email" display="none" />

        <Field.Root id="password" required invalid={!!errors.password}>
          <Field.Label>
            {intl.formatMessage({
              id: 'PasswordResetStepPasswordPasswordLabel',
              defaultMessage: 'Password'
            })}
          </Field.Label>
          <Controller
            control={control}
            name="password"
            rules={{
              required: intl.formatMessage({
                id: 'PasswordResetStepPasswordRequiredError',
                defaultMessage: 'This field is required'
              })
            }}
            render={({field}) => (
              <Input
                autoFocus
                {...field}
                type="password"
                autoComplete="new-password"
              />
            )}
          />
        </Field.Root>

        <Field.Root
          id="confirmPassword"
          required
          invalid={!!errors.confirmPassword}>
          <Field.Label>
            {intl.formatMessage({
              id: 'PasswordResetStepPasswordConfirmPasswordLabel',
              defaultMessage: 'Confirm Password'
            })}
          </Field.Label>
          <Controller
            control={control}
            name="confirmPassword"
            rules={{
              required: intl.formatMessage({
                id: 'PasswordResetStepPasswordRequiredError',
                defaultMessage: 'This field is required'
              }),
              validate: value =>
                value === password ||
                intl.formatMessage({
                  id: 'PasswordResetStepPasswordMismatchError',
                  defaultMessage: 'Passwords do not match'
                })
            }}
            render={({field}) => (
              <Input {...field} type="password" autoComplete="new-password" />
            )}
          />

          <Field.ErrorText>
            {errors.confirmPassword && errors.confirmPassword.message}
          </Field.ErrorText>
        </Field.Root>

        {/* `primary` is jaen's own button recipe variant and resolves at
            runtime; the prop union stays at v3's built-ins until `chakra
            typegen` is run against src/theme, so the cast goes then. */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={isSubmitting}>
          {intl.formatMessage({
            id: 'PasswordResetStepPasswordSubmitButton',
            defaultMessage: 'Send password reset mail'
          })}
        </Button>
      </Stack>
    </form>
  )
}

export default StepPassword
