import {
  PageConfig,
  useAuth,
  useColorModeValue,
  useNotificationsContext,
  zitadelGql
} from 'jaen'
import {intlText} from '../../../lib/intl'
import {Link as GatsbyLink, PageProps} from 'gatsby'
import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {useIntl} from 'react-intl'

import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  CloseButton,
  Flex,
  Heading,
  HStack,
  Input,
  InputGroup,
  SimpleGrid,
  Skeleton,
  SkeletonCircle,
  SkeletonText,
  Stack,
  Text,
  useDisclosure,
  Field,
  Dialog,
  Portal
} from '@chakra-ui/react'
import {FaPlus} from '@react-icons/all-files/fa/FaPlus'
import {useForm} from 'react-hook-form'

interface UserSummary {
  id: string
  userName: string
  preferredLoginName?: string | null
  loginNames: string[]
  state?: string | null
  displayName?: string | null
  email?: string | null
}

interface CreateFormValues {
  username: string
  email: string
  firstName?: string
  lastName?: string
  password?: string
  sendPasswordReset: boolean
}

const stateLabel = (state?: string | null): string =>
  (state ?? '').replace('USER_STATE_', '').toLowerCase()

const AccountsPage: React.FC = () => {
  const intl = useIntl()
  const auth = useAuth()
  const {toast} = useNotificationsContext()

  const [users, setUsers] = useState<UserSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const accessToken = auth.user?.access_token

  const fetchUsers = useCallback(async () => {
    if (!accessToken) return

    setIsLoading(true)
    setError(null)

    try {
      const {users: fetched} = await zitadelGql.fetchUsers({accessToken})

      setUsers(
        fetched.map(user => {
          const profile = zitadelGql.primaryProfile(user)

          return {
            id: user.id,
            userName: user.userName ?? '',
            preferredLoginName: user.preferredLoginName,
            loginNames: (user.loginNames ?? []).filter(
              (loginName): loginName is string => typeof loginName === 'string'
            ),
            state: user.state,
            displayName: profile?.displayName,
            email: profile?.email
          }
        })
      )
    } catch (err) {
      if (err instanceof zitadelGql.ZitadelGqlError) {
        setError(
          intl.formatMessage({
            id: 'CmsAccountsErrorsLoadService',
            defaultMessage: 'Failed to load users from the identity service.'
          })
        )
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError(
          intl.formatMessage({
            id: 'CmsAccountsErrorsLoadGeneric',
            defaultMessage: 'Failed to load users.'
          })
        )
      }
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, intl])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  const filteredUsers = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase()

    if (!needle) return users

    return users.filter(user => {
      const haystack = [
        user.userName,
        user.preferredLoginName ?? '',
        user.displayName ?? '',
        user.email ?? '',
        ...user.loginNames
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(needle)
    })
  }, [users, searchTerm])

  // -------------------------------------------------------------------------
  // account creation
  // -------------------------------------------------------------------------

  const createModal = useDisclosure()

  const {
    register,
    handleSubmit,
    reset,
    formState: {errors, isSubmitting}
  } = useForm<CreateFormValues>({
    defaultValues: {sendPasswordReset: true}
  })

  const onCreate = handleSubmit(async values => {
    if (!accessToken) return

    try {
      const result = await zitadelGql.createUser({
        accessToken,
        emailAddress: values.email,
        username: values.username,
        password: values.password || undefined,
        firstName: values.firstName || undefined,
        lastName: values.lastName || undefined
      })

      if (!result.ok) {
        throw new Error(result.message || 'createUser failed')
      }

      if (values.sendPasswordReset && !values.password && result.userId) {
        await zitadelGql
          .requestUserPasswordReset({accessToken, userId: result.userId})
          .catch(() => undefined)
      }

      toast({
        title: intl.formatMessage({
          id: 'CmsAccountsNotificationsCreated',
          defaultMessage: 'Account created'
        }),
        description: intl.formatMessage(
          {
            id: 'CmsAccountsNotificationsCreatedDescription',
            defaultMessage: 'Account {username} has been created'
          },
          {username: values.username}
        ),
        status: 'success'
      })

      createModal.onClose()
      reset()
      await fetchUsers()
    } catch (err) {
      toast({
        title: intl.formatMessage({
          id: 'CmsAccountsNotificationsCreateFailed',
          defaultMessage: 'Could not create account'
        }),
        description: err instanceof Error ? err.message : undefined,
        status: 'error'
      })
    }
  })

  // The semantic names whose jaen values are the greys that were picked by
  // mode here: bg.subtle is gray.50 and gray.800, border.default gray.200 in
  // light, border.emphasized gray.700 in dark.
  const emptyBg = 'bg.subtle'
  const emptyBorder = useColorModeValue('border.default', 'border.emphasized')

  return (
    <Stack gap="6">
      <Flex justifyContent="space-between" alignItems="flex-start" wrap="wrap">
        <Box>
          <Heading size="lg">
            {intl.formatMessage({
              id: 'CmsAccountsTitle',
              defaultMessage: 'Accounts'
            })}
          </Heading>
          <Text color="fg.muted">
            {intl.formatMessage({
              id: 'CmsAccountsSubtitle',
              defaultMessage:
                'Browse and manage the user accounts of your identity tenant.'
            })}
          </Text>
        </Box>

        <Button variant="outline" onClick={createModal.onOpen}>
          <FaPlus />
          {intl.formatMessage({
            id: 'CmsAccountsActionsCreate',
            defaultMessage: 'New account'
          })}
        </Button>
      </Flex>

      <InputGroup maxW="sm">
        <Input
          placeholder={intl.formatMessage({
            id: 'CmsAccountsSearchPlaceholder',
            defaultMessage: 'Search by name, email or login name'
          })}
          value={searchTerm}
          onChange={event => {
            setSearchTerm(event.target.value)
          }}
        />
      </InputGroup>

      {error ? (
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Title>
            {intl.formatMessage({
              id: 'CmsAccountsErrorsLoadTitle',
              defaultMessage: 'Unable to load accounts'
            })}
          </Alert.Title>
          <Alert.Description>{error}</Alert.Description>
        </Alert.Root>
      ) : null}

      <SimpleGrid columns={{base: 1, md: 2, xl: 3}} gap={6}>
        {isLoading
          ? Array.from({length: 6}).map((_, index) => (
              <Card.Root key={index} variant="outline">
                <Card.Header>
                  <HStack gap="4">
                    <SkeletonCircle size="12" />
                    <Skeleton height="20px" width="40%" />
                  </HStack>
                </Card.Header>
                <Card.Body>
                  <SkeletonText noOfLines={3} />
                </Card.Body>
              </Card.Root>
            ))
          : filteredUsers.map(user => (
              <Card.Root key={user.id} variant="outline" height="100%">
                <Card.Header>
                  <HStack gap="4" alignItems="flex-start">
                    <Avatar.Root>
                      <Avatar.Fallback
                        name={user.displayName ?? user.userName}
                      />
                    </Avatar.Root>
                    <Box flex="1" minW="0">
                      <Heading size="sm" lineClamp={2} wordBreak="break-word">
                        {user.displayName ||
                          user.userName ||
                          intl.formatMessage({
                            id: 'CmsAccountsCardUnnamed',
                            defaultMessage: 'Unnamed user'
                          })}
                      </Heading>
                      <Text fontSize="sm" color="fg.muted">
                        {user.email ||
                          user.preferredLoginName ||
                          intl.formatMessage({
                            id: 'CmsAccountsCardNoEmail',
                            defaultMessage: 'No email provided'
                          })}
                      </Text>
                    </Box>
                    {user.state ? (
                      <Badge
                        flexShrink="0"
                        colorPalette={
                          user.state === 'USER_STATE_ACTIVE'
                            ? 'green'
                            : 'purple'
                        }>
                        {stateLabel(user.state)}
                      </Badge>
                    ) : null}
                  </HStack>
                </Card.Header>
                <Card.Body>
                  <Stack gap="4">
                    <Box>
                      <Text fontSize="xs" color="fg.muted">
                        {intl.formatMessage({
                          id: 'CmsAccountsCardUsername',
                          defaultMessage: 'Username'
                        })}
                      </Text>
                      <Text>{user.userName || '—'}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="fg.muted">
                        {intl.formatMessage({
                          id: 'CmsAccountsCardLoginNames',
                          defaultMessage: 'Login names'
                        })}
                      </Text>
                      {user.loginNames.length > 0 ? (
                        user.loginNames.map(loginName => (
                          <Text key={loginName}>{loginName}</Text>
                        ))
                      ) : (
                        <Text color="fg.muted">
                          {intl.formatMessage({
                            id: 'CmsAccountsCardNoLoginNames',
                            defaultMessage: 'No alternate login names'
                          })}
                        </Text>
                      )}
                    </Box>
                    <Button size="sm" variant="outline" asChild>
                      <GatsbyLink to={`./${user.id}`}>
                        {intl.formatMessage({
                          id: 'CmsAccountsCardManage',
                          defaultMessage: 'Manage account'
                        })}
                      </GatsbyLink>
                    </Button>
                  </Stack>
                </Card.Body>
              </Card.Root>
            ))}
      </SimpleGrid>

      {!isLoading && !error && filteredUsers.length === 0 ? (
        <Box
          borderWidth="1px"
          borderStyle="dashed"
          borderColor={emptyBorder}
          bg={emptyBg}
          borderRadius="surface"
          p="8"
          textAlign="center">
          <Heading size="sm" mb="2">
            {intl.formatMessage({
              id: 'CmsAccountsEmptyTitle',
              defaultMessage: 'No accounts match your search'
            })}
          </Heading>
          <Text color="fg.muted">
            {intl.formatMessage({
              id: 'CmsAccountsEmptyHint',
              defaultMessage: 'Adjust the search term or create a new account.'
            })}
          </Text>
        </Box>
      ) : null}

      <Dialog.Root
        open={createModal.open}
        onOpenChange={e => {
          if (!e.open) {
            createModal.onClose()
          }
        }}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content asChild>
              <form onSubmit={onCreate}>
                <Dialog.Header>
                  {intl.formatMessage({
                    id: 'CmsAccountsCreateTitle',
                    defaultMessage: 'Create a new account'
                  })}
                </Dialog.Header>
                {/* Same as the drawers: v3's CloseTrigger draws nothing of its
                    own, so the X v2's ModalCloseButton carried has to be handed
                    to it, at the 32px and neutral hover v2 gave it. */}
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="xs" colorPalette="gray" />
                </Dialog.CloseTrigger>
                <Dialog.Body>
                  <Stack gap="4">
                    <Field.Root required invalid={!!errors.username}>
                      <Field.Label>
                        {intl.formatMessage({
                          id: 'CmsAccountsCreateUsername',
                          defaultMessage: 'Username'
                        })}
                      </Field.Label>
                      <Input {...register('username', {required: true})} />
                    </Field.Root>
                    <Field.Root required invalid={!!errors.email}>
                      <Field.Label>
                        {intl.formatMessage({
                          id: 'CmsAccountsCreateEmail',
                          defaultMessage: 'Email'
                        })}
                      </Field.Label>
                      <Input
                        type="email"
                        {...register('email', {required: true})}
                      />
                    </Field.Root>
                    <SimpleGrid columns={2} gap="4">
                      <Field.Root>
                        <Field.Label>
                          {intl.formatMessage({
                            id: 'CmsAccountsCreateFirstName',
                            defaultMessage: 'First name'
                          })}
                        </Field.Label>
                        <Input {...register('firstName')} />
                      </Field.Root>
                      <Field.Root>
                        <Field.Label>
                          {intl.formatMessage({
                            id: 'CmsAccountsCreateLastName',
                            defaultMessage: 'Last name'
                          })}
                        </Field.Label>
                        <Input {...register('lastName')} />
                      </Field.Root>
                    </SimpleGrid>
                    <Field.Root>
                      <Field.Label>
                        {intl.formatMessage({
                          id: 'CmsAccountsCreateInitialPassword',
                          defaultMessage: 'Initial password (optional)'
                        })}
                      </Field.Label>
                      <Input type="password" {...register('password')} />
                    </Field.Root>
                    <Checkbox.Root {...register('sendPasswordReset')}>
                      <Checkbox.HiddenInput />
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Checkbox.Label>
                        {intl.formatMessage({
                          id: 'CmsAccountsCreateSendReset',
                          defaultMessage:
                            'Send a password reset email when no password is set'
                        })}
                      </Checkbox.Label>
                    </Checkbox.Root>
                  </Stack>
                </Dialog.Body>
                <Dialog.Footer>
                  <Button variant="ghost" mr={3} onClick={createModal.onClose}>
                    {intl.formatMessage({
                      id: 'CmsAccountsActionsCancel',
                      defaultMessage: 'Cancel'
                    })}
                  </Button>
                  <Button type="submit" loading={isSubmitting}>
                    {intl.formatMessage({
                      id: 'CmsAccountsActionsCreateSubmit',
                      defaultMessage: 'Create account'
                    })}
                  </Button>
                </Dialog.Footer>
              </form>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Stack>
  )
}

const Page: React.FC<PageProps> = () => {
  return <AccountsPage />
}

export default Page

export const pageConfig: PageConfig = {
  label: intlText('CmsAccountsPageTitle', 'Jaen CMS | Accounts'),
  icon: 'FaUsers',
  layout: {
    // A browsable grid, not a form. 'form' caps the container at
    // container.md, which squeezes the three-column grid into ~220px
    // columns and makes every card wrap its own heading.
    name: 'jaen',
    type: 'content'
  },
  menu: {
    label: intlText('CmsAccountsMenuLabel', 'Accounts'),
    type: 'app',
    group: 'cms',
    order: 400
  },
  breadcrumbs: [
    {
      label: intlText('CmsLabelsRoot', 'CMS'),
      path: '/cms/'
    },
    {
      label: intlText('CmsAccountsBreadcrumbsAccounts', 'Accounts'),
      path: '/cms/accounts/'
    }
  ],
  auth: {
    isRequired: true,
    isAdminRequired: true
  }
}

export {Head} from 'jaen'
