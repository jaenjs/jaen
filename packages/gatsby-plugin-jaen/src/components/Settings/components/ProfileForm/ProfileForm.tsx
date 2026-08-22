import {Button, ButtonGroup, Input, Stack, Field} from '@chakra-ui/react'
import React from 'react'
import {Controller, DeepPartial, useForm} from 'react-hook-form'
import {useIntl} from 'react-intl'

import {FieldGroup} from '../../../shared/FieldGroup'
import {FormImageChooser} from '../../../shared/FormImageChooser'

export interface ProfileFormData {
  firstName: string
  lastName: string
  displayName: string
  preferredLanguage: string
  gender: string
  avatarUrl: string
}

export interface ProfileFormDataUpdate {
  firstName: string
  lastName: string
  avatarURL?: string
  displayName: string
  preferredLanguage?: string
  gender?: string
  avatarUrl?: string
}

export interface ProfileFormProps {
  onSubmit: (data: ProfileFormDataUpdate) => Promise<void>
  defaultValues?: DeepPartial<ProfileFormData>
}

export const ProfileForm: React.FC<ProfileFormProps> = ({
  onSubmit,
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
  } = useForm<ProfileFormData>({
    defaultValues
  })

  const [avatarFile, setAvatarFile] = React.useState<File | null>(null)

  const onFormSubmit = handleSubmit(async data => {
    // promise to wait for image upload

    await onSubmit({
      ...data
    })

    reset(data)
  })

  return (
    <form onSubmit={onFormSubmit}>
      <FieldGroup
        title={intl.formatMessage({
          id: 'ProfileFormTitle',
          defaultMessage: 'Account'
        })}>
        <Stack width="full" gap="8" maxW="2xl">
          <Stack>
            {/* The details.* and username paths below do not exist on
                ProfileFormData, so these inputs bind to nothing. Broken the
                same way before the v3 port; renaming them would change what
                the form submits, which belongs in its own change. */}
            <Field.Root id="firstName" invalid={!!errors.details?.firstName}>
              <Field.Label>
                {intl.formatMessage({
                  id: 'ProfileFormFirstNameLabel',
                  defaultMessage: 'First Name'
                })}
              </Field.Label>
              <Input placeholder="" {...register('details.firstName', {})} />
              <Field.ErrorText>
                {errors.details?.firstName && errors.details.firstName.message}
              </Field.ErrorText>
            </Field.Root>

            <Field.Root id="lastName" invalid={!!errors?.details?.lastName}>
              <Field.Label>
                {intl.formatMessage({
                  id: 'ProfileFormLastNameLabel',
                  defaultMessage: 'Last Name'
                })}
              </Field.Label>
              <Input placeholder="" {...register('details.lastName', {})} />
              <Field.ErrorText>
                {errors.details?.lastName && errors.details.lastName.message}
              </Field.ErrorText>
            </Field.Root>
          </Stack>

          <Field.Root id="username" invalid={!!errors.username} disabled>
            <Field.Label>
              {intl.formatMessage({
                id: 'ProfileFormUsernameLabel',
                defaultMessage: 'Username'
              })}
            </Field.Label>
            <Input
              disabled
              maxW="xs"
              {...register('username', {
                required: intl.formatMessage({
                  id: 'ProfileFormRequiredError',
                  defaultMessage: 'This field is required'
                })
              })}
              autoComplete="false"
              color="fg.muted"
            />
            <Field.ErrorText>
              {errors.username && errors.username.message}
            </Field.ErrorText>
          </Field.Root>

          <Field.Root id="image">
            <Field.Label>
              {intl.formatMessage({
                id: 'ProfileFormImageLabel',
                defaultMessage: 'Image'
              })}
            </Field.Label>

            <Controller
              control={control}
              name="details.avatarURL"
              render={({field: {value}}) => {
                return (
                  <FormImageChooser
                    value={value}
                    onChoose={file => {
                      setAvatarFile(file)
                      setValue('details.avatarURL', URL.createObjectURL(file), {
                        shouldDirty: true
                      })
                    }}
                    onRemove={() => {
                      setAvatarFile(null)
                      setValue(
                        'details.avatarURL',
                        defaultValues?.details?.avatarURL || ''
                      )
                    }}
                    description={intl.formatMessage({
                      id: 'ProfileFormImageDescription',
                      defaultMessage:
                        'Upload a profile picture to make your account easier to recognize.'
                    })}
                  />
                )
              }}
            />
          </Field.Root>

          <ButtonGroup>
            <Button loading={isSubmitting} type="submit" variant="outline">
              {intl.formatMessage({
                id: 'ProfileFormUpdateButton',
                defaultMessage: 'Update account'
              })}
            </Button>
          </ButtonGroup>
        </Stack>
      </FieldGroup>
    </form>
  )
}

export default ProfileForm
