import {DuplicateSlugError, JaenTemplate, useAuth} from 'jaen'
import {
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Grid,
  Heading,
  HStack,
  Icon,
  IconButton,
  Input,
  Stack,
  StackDivider,
  Text,
  Textarea
} from '@chakra-ui/react'
import {useEffect, useState} from 'react'
import {Controller, SubmitHandler, useForm} from 'react-hook-form'
import {FaEdit} from '@react-icons/all-files/fa/FaEdit'
import {FaEye} from '@react-icons/all-files/fa/FaEye'
import {FaImage} from '@react-icons/all-files/fa/FaImage'
import {FaNewspaper} from '@react-icons/all-files/fa/FaNewspaper'

import {FaEyeLowVision} from '@react-icons/all-files/fa6/FaEyeLowVision'
import slugify from 'slugify'

import FormMediaChooser from '../../../../../containers/form-media-chooser'
import {Link} from '../../../../shared/Link'
import {ChooseButton, ChooseButtonProps} from '../ChooseButton/ChooseButton'
import {FaClone} from '@react-icons/all-files/fa/FaClone'
import {useJaenI18n} from '../../../../../hooks/use-jaen-i18n'

interface FormValues {
  title: string
  slug: string
  description: string
  parentPage: string
  template: string | null
  blogPost?: {
    date?: string
    author?: string
    category?: string
  }
  image?: {
    src?: string
  }
  isExcludedFromIndex?: boolean
}

export interface PageContentFormProps {
  parentPages: {
    [pageId: string]: {
      label: string
      templates: ChooseButtonProps['items']
    }
  }
  jaenTemplates?: JaenTemplate[]
  onSubmit: (data: FormValues) => void
  path?: string
  values?: Partial<FormValues>
  disableSlug?: boolean
  mode?: 'create' | 'edit'
}

export const PageContentForm: React.FC<PageContentFormProps> = ({
  mode = 'create',
  ...props
}) => {
  const {strings} = useJaenI18n()
  const cmsPages = (strings?.cms?.pages as Record<string, any>) ?? {}
  const texts = cmsPages.form ?? {}
  const labels = cmsPages.labels ?? {}
  const formErrors = texts.errors ?? {}
  const placeholders = texts.placeholders ?? {}
  const helper = texts.helper ?? {}
  const buttons = texts.buttons ?? {}

  const {
    handleSubmit,
    watch,
    register,
    setValue,
    reset,
    setError,
    control,
    formState: {errors, isSubmitting}
  } = useForm<FormValues>({
    defaultValues: props.values
  })

  useEffect(() => {
    // set default values

    reset(props.values)

    if (mode === 'edit') {
      // lock the form
      setIsEditFormLocked(true)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(props.values)])

  const [isEditFormLocked, setIsEditFormLocked] = useState<boolean>(true)

  const handleReset = () => {
    // Reset the form to the default values
    reset(props.values)

    // Lock the form
    setIsEditFormLocked(true)
  }

  const onSubmit: SubmitHandler<FormValues> = data => {
    try {
      // make blogPost undefined if not in use or empty
      if (!isBlogPostInUse || !data.blogPost?.date) {
        data.blogPost = undefined
      }

      return props.onSubmit(data)
    } catch (e) {
      if (e instanceof DuplicateSlugError) {
        setError('slug', {
          type: 'manual',
          message: formErrors.slugInUse ?? 'Slug is already in use'
        })
      }
    }
  }

  const title = watch('title', '') // Get the value of the 'title' field

  useEffect(() => {
    // only run when mode is create
    if (mode !== 'create') {
      return
    }

    const slug = slugify(title, {lower: true}) // Generate the slug from the title
    setValue('slug', slug) // Set the value of the 'slug' field using setValue from react-hook-form
  }, [mode, title, setValue])

  const parentPage = watch('parentPage', '') // Get the value of the 'parent' field

  const template = watch('template', '') // Get the value of the 'template' field

  const jaenTemplate = props.jaenTemplates?.find(
    jaenTemplate => jaenTemplate.id === template
  )

  const [isBlogPostInUse, setIsBlogPostInUse] = useState<boolean>(
    !!props.values?.blogPost
  )

  const [isImageInUse, setIsImageInUse] = useState<boolean>(
    !!props.values?.image?.src
  )

  const auth = useAuth()

  useEffect(() => {
    setIsBlogPostInUse(!!props.values?.blogPost)
  }, [props.values?.blogPost])

  useEffect(() => {
    setIsImageInUse(!!props.values?.image?.src)
  }, [props.values?.image?.src])

  // watch blogPost.date and
  const blogPost = watch('blogPost', undefined)

  useEffect(() => {
    if (blogPost && isBlogPostInUse) {
      if (!blogPost.date) {
        setValue('blogPost.date', new Date().toISOString().slice(0, 16))
      }

      if (!blogPost.author) {
        const defaultAuthor =
          auth.user?.profile?.nickname ||
          auth.user?.profile?.name ||
          auth.user?.profile?.email

        if (defaultAuthor) {
          setValue('blogPost.author', defaultAuthor)
        }
      }
    }
  }, [blogPost?.date])

  // reset blogPost.date if isBlogPostInUse is false
  useEffect(() => {
    if (!isBlogPostInUse) {
      setValue('blogPost', props.values?.blogPost || undefined)
    }
  }, [isBlogPostInUse])

  if (mode === 'edit' && isEditFormLocked) {
    return (
      <Stack w="full" divider={<StackDivider />} spacing="4">
        <Stack>
          <HStack justifyContent="space-between">
            <HStack>
              <Heading as="h2" size="sm">
                {props.values?.title || labels.fallbackTitle || 'Page'}
              </Heading>

              <Text fontSize="sm" color="fg.muted">
                {jaenTemplate?.label}
              </Text>
            </HStack>

            <ButtonGroup variant="outline">
              <Link as={Button} leftIcon={<FaEye />} to={props.path}>
                {buttons.preview ?? 'Preview'}
              </Link>

              <Button
                variant="outline"
                leftIcon={<FaEdit />}
                onClick={() => {
                  setIsEditFormLocked(false)
                }}>
                {buttons.edit ?? 'Edit page'}
              </Button>
            </ButtonGroup>
          </HStack>

          <Text fontSize="sm" color="fg.muted" maxW="70%">
            {props.values?.description}
          </Text>
        </Stack>

        {/* {(isImageInUse ||
          isBlogPostInUse ||
          props.values?.isExcludedFromIndex) && (
          <Stack spacing="4" divider={<StackDivider />}>
            {isImageInUse && (
              <Stack spacing="4">
                <HStack>
                  <Icon as={FaImage} color="brand.500" />
                  <Text fontWeight="semibold">{texts.image[mode]}</Text>
                </HStack>

                <Image
                  boxSize={36}
                  minW="36"
                  borderRadius="lg"
                  bg="bg.subtle"
                  src={props.values?.image?.src}
                  fallback={<Skeleton borderRadius="lg" boxSize="100%" />}
                />
              </Stack>
            )}

            {isBlogPostInUse && (
              <Stack spacing="4">
                <HStack>
                  <Icon as={FaNewspaper} color="brand.500" />
                  <Text fontWeight="semibold">{texts.post[mode]}</Text>
                </HStack>

                <Stack spacing="4">
                  <Stack>
                    <FormLabel as="legend">{texts.postDate[mode]}</FormLabel>

                    <Input
                      variant="unstyled"
                      type="datetime-local"
                      defaultValue={props.values?.blogPost?.date}
                      isReadOnly
                    />
                  </Stack>

                  <Stack>
                    <FormLabel as="legend">{texts.postAuthor[mode]}</FormLabel>
                    <Input
                      variant="unstyled"
                      defaultValue={props.values?.blogPost?.author}
                      isReadOnly
                    />
                  </Stack>

                  <Stack>
                    {props.values?.blogPost?.category && (
                      <>
                        <FormLabel as="legend">
                          {texts.postCategory[mode]}
                        </FormLabel>

                        <Input
                          defaultValue={props.values?.blogPost?.category}
                          isReadOnly
                        />
                      </>
                    )}
                  </Stack>
                </Stack>
              </Stack>
            )}

            {props.values?.isExcludedFromIndex && (
              <Stack spacing="4">
                <HStack>
                  <Icon as={FaEyeLowVision} color="brand.500" />
                  <Text fontWeight="semibold">
                    {texts.excludeFromIndex[mode]}
                  </Text>
                </HStack>

                <Tag w="fit-content">{labels.yes ?? 'Yes'}</Tag>
              </Stack>
            )}
          </Stack>
        )} */}
      </Stack>
    )
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault()

        void handleSubmit(onSubmit)()
      }}>
      <Stack w="full" divider={<StackDivider />} spacing="4">
        <Stack>
          <Heading as="h2" size="sm">
            {texts.heading[mode]}
          </Heading>

          <Text fontSize="sm" color="fg.muted">
            {texts.lead[mode]}
          </Text>
        </Stack>

        {mode == 'create' && (
          <FormControl as="fieldset" isInvalid={!!errors.parentPage} isRequired>
            <FormLabel as="legend">{texts.parentPage[mode]}</FormLabel>

            <Controller
              control={control}
              name="parentPage"
              rules={{
                required: true
              }}
              render={({field}) => {
                return (
                  <ChooseButton
                    defaultValue={field.value}
                    onChange={field.onChange}
                    items={props.parentPages}
                  />
                )
              }}
            />

            <FormHelperText>{texts.parentHelperText[mode]}</FormHelperText>
            <FormErrorMessage>
              {errors.parentPage &&
                (formErrors.parentRequired ?? 'Parent is required')}
            </FormErrorMessage>
          </FormControl>
        )}

        <Stack spacing="4">
          {props.disableSlug ? (
            <FormControl as="fieldset" isRequired isInvalid={!!errors.slug}>
              <FormLabel as="legend">{texts.title[mode]}</FormLabel>
              <Input
                {...register('title', {
                  required: true
                })}
                placeholder={placeholders.title ?? 'Title'}
              />
              <FormHelperText>{texts.titleHelperText[mode]}</FormHelperText>
            </FormControl>
          ) : (
            <FormControl
              as="fieldset"
              isRequired
              isInvalid={!!errors.title || !!errors.slug}>
              <FormLabel as="legend">{texts.title[mode]}</FormLabel>
              <Grid templateColumns="70% 30%" gap="2">
                <Input
                  {...register('title', {required: true})}
                  placeholder={placeholders.title ?? 'Title'}
                />
                <Stack>
                  <Input
                    {...register('slug', {required: true})}
                    placeholder={placeholders.slug ?? 'slug'}
                    onBlur={e => {
                      const slug = slugify(e.target.value, {lower: true})
                      setValue('slug', slug, {
                        shouldDirty: true
                      })
                    }}
                  />
                  <FormErrorMessage>
                    {errors.slug && errors.slug.message}
                  </FormErrorMessage>
                </Stack>
              </Grid>
              <FormHelperText>{texts.titleHelperText[mode]}</FormHelperText>
            </FormControl>
          )}

          <FormControl
            as="fieldset"
            isRequired
            isInvalid={!!errors.description}>
            <FormLabel as="legend">{texts.description[mode]}</FormLabel>
            <Textarea
              {...register('description', {required: true})}
              placeholder={placeholders.description ?? 'Description'}
            />
            <FormHelperText as={HStack} justifyContent="space-between">
              <Text>{texts.descriptionHelperText[mode]}</Text>
              <Text>{watch('description')?.length || 0}</Text>
            </FormHelperText>
          </FormControl>
        </Stack>

        {!(mode === 'edit' && !props.values?.template) && (
          <FormControl as="fieldset" isRequired isInvalid={!!errors.template}>
            <FormLabel as="legend">{texts.template[mode]}</FormLabel>
            {mode === 'create' ? (
              <Controller
                control={control}
                name="template"
                rules={{
                  required: true
                }}
                render={({field}) => {
                  return (
                    <ChooseButton
                      isDisabled={!props.parentPages[parentPage]?.templates}
                      onChange={field.onChange}
                      items={props.parentPages[parentPage]?.templates || {}}
                    />
                  )
                }}
              />
            ) : (
              <Button variant="outline" bgColor="bg.subtle" isDisabled>
                {jaenTemplate?.label}
              </Button>
            )}
            <FormHelperText>{texts.templateHelperText[mode]}</FormHelperText>

            <FormErrorMessage>
              {errors.template &&
                (formErrors.templateRequired ?? 'Template is required')}
            </FormErrorMessage>
          </FormControl>
        )}

        <FormControl as="fieldset">
          <Stack spacing="4">
            <Checkbox
              isChecked={isImageInUse}
              onChange={e => {
                setIsImageInUse(e.target.checked)

                if (!e.target.checked) {
                  setValue('image.src', undefined)
                }
              }}>
              <HStack>
                <Icon as={FaImage} color="brand.500" />
                <Stack spacing="0.5">
                  <Text fontWeight="semibold">{texts.image[mode]}</Text>
                  <Text fontSize="sm" color="fg.muted">
                    {texts.imageHelperText[mode]}
                  </Text>
                </Stack>
              </HStack>
            </Checkbox>

            <Box
              display={
                // If the checkbox is checked, display the fields
                isImageInUse ? 'flex' : 'none'
              }>
              <Controller // Controller is used to integrate external inputs into the react-hook-form
                control={control}
                name="image.src"
                render={({field}) => {
                  return (
                    <FormMediaChooser
                      value={field.value}
                      onChoose={media => {
                        setValue('image.src', media.url, {
                          shouldDirty: true
                        })
                      }}
                      onRemove={() => {
                        setValue('image.src', '', {
                          shouldDirty: true
                        })
                      }}
                      description={
                        helper.mediaDescription ??
                        'Upload a photo to represent the organization.'
                      }
                    />
                  )
                }}
              />
            </Box>
          </Stack>
        </FormControl>

        <FormControl
          as="fieldset"
          isInvalid={!!errors.blogPost?.date || !!errors.blogPost?.author}>
          <Stack spacing="4">
            <Checkbox
              isChecked={isBlogPostInUse}
              onChange={e => {
                setIsBlogPostInUse(e.target.checked)

                if (!e.target.checked) {
                  setValue('blogPost', undefined)
                }
              }}>
              <HStack>
                <Icon as={FaNewspaper} color="brand.500" />
                <Stack spacing="0.5">
                  <Text fontWeight="semibold">{texts.post[mode]}</Text>
                  <Text fontSize="sm" color="fg.muted">
                    {texts.postHelperText[mode]}
                  </Text>
                </Stack>
              </HStack>
            </Checkbox>

            <Stack
              spacing="4"
              display={
                // If the checkbox is checked, display the fields
                isBlogPostInUse ? 'flex' : 'none'
              }>
              <FormControl
                as="fieldset"
                isInvalid={!!errors.blogPost?.date}
                isRequired={isBlogPostInUse}
                isDisabled={!isBlogPostInUse}>
                <FormLabel as="legend">{texts.postDate[mode]}</FormLabel>
                <Input
                  {...register('blogPost.date', {
                    validate: value => {
                      if (!value && isBlogPostInUse) {
                        return (
                          formErrors.dateRequired ??
                          'Date is required for blog posts'
                        )
                      }

                      return true
                    }
                  })}
                  type="datetime-local"
                />
                <FormHelperText>
                  {texts.postDateHelperText[mode]}
                </FormHelperText>
              </FormControl>

              <FormControl
                as="fieldset"
                isInvalid={!!errors.blogPost?.author}
                isRequired={isBlogPostInUse}
                isDisabled={!isBlogPostInUse}>
                <FormLabel as="legend">{texts.postAuthor[mode]}</FormLabel>
                <Input
                  {...register('blogPost.author', {
                    validate: value => {
                      if (!value && isBlogPostInUse) {
                        return (
                          formErrors.authorRequired ??
                          'Author is required for blog posts'
                        )
                      }

                      return true
                    }
                  })}
                  placeholder={placeholders.author ?? 'Author'}
                />
                <FormHelperText>
                  {texts.postAuthorHelperText[mode]}
                </FormHelperText>
              </FormControl>

              <FormControl
                as="fieldset"
                isInvalid={!!errors.blogPost?.category}
                isDisabled={!isBlogPostInUse}>
                <FormLabel as="legend">{texts.postCategory[mode]}</FormLabel>
                <Input
                  {...register('blogPost.category')}
                  placeholder={placeholders.category ?? 'Category'}
                />
                <FormHelperText>
                  {texts.postCategoryHelperText[mode]}
                </FormHelperText>
              </FormControl>
            </Stack>
          </Stack>
        </FormControl>

        <FormControl as="fieldset" isInvalid={!!errors.isExcludedFromIndex}>
          <Checkbox
            {...register('isExcludedFromIndex', {
              required: false
            })}>
            <HStack>
              <Icon as={FaEyeLowVision} color="brand.500" />
              <Stack spacing="0.5">
                <Text fontWeight="semibold">
                  {texts.excludeFromIndex[mode]}
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  {texts.excludeFromIndexHelperText[mode]}
                </Text>
              </Stack>
            </HStack>
          </Checkbox>
        </FormControl>

        <HStack justifyContent="right">
          <ButtonGroup>
            {mode === 'edit' && (
              <Button variant="outline" onClick={handleReset}>
                {buttons.cancel ?? 'Cancel'}
              </Button>
            )}
            <Button type="submit" isLoading={isSubmitting}>
              {mode === 'create'
                ? buttons.create ?? 'Create page'
                : buttons.save ?? 'Save page'}
            </Button>
          </ButtonGroup>
        </HStack>
      </Stack>
    </form>
  )
}
