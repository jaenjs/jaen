import {AuthUser, useNotificationsContext, AuthPasswordPolicy} from 'jaen'
import {
  Avatar,
  Button,
  ButtonGroup,
  Card,
  Grid,
  GridItem,
  HStack,
  Icon,
  IconButton,
  Input,
  List,
  NativeSelect,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  VStack,
  Field,
  StackSeparator
} from '@chakra-ui/react'
import {FaEdit} from '@react-icons/all-files/fa/FaEdit'
import {FaPlus} from '@react-icons/all-files/fa/FaPlus'
import {FaTrash} from '@react-icons/all-files/fa/FaTrash'
import {FaCheck} from '@react-icons/all-files/fa6/FaCheck'
import {FaX} from '@react-icons/all-files/fa6/FaX'
import {MdRefresh} from '@react-icons/all-files/md/MdRefresh'
import {useEffect, useState} from 'react'
import {MessageDescriptor, defineMessages, useIntl} from 'react-intl'
import {useUiLocale} from '../../locales/ui-locale'

export interface SettingsProps {
  user: AuthUser
  passwordPolicy: AuthPasswordPolicy

  onUsernameUpdate: (userName: string) => Promise<void>

  onProfileUpdate: (profile: AuthUser['human']['profile']) => Promise<void>

  onProfileAvatarUpdate: (avatarFile: File) => Promise<void>

  onContactInformationRefresh: () => Promise<void>

  onEmailUpdate: (email: string) => Promise<void>
  onEmailResendCode: () => Promise<void>
  onphoneUpdate: (phone: string) => Promise<void>
  onphoneDelete: () => Promise<void>
  onphoneVerify: (code: string) => Promise<void>
  onphoneResendCode: () => Promise<void>
  onPasswordUpdate: (oldPassword: string, newPassword: string) => Promise<void>
}

type TabType = {
  label: MessageDescriptor
  value: 'GENERAL' | 'PASSWD'
}

const tabMessages = defineMessages({
  general: {
    id: 'SettingsTabGeneral',
    defaultMessage: 'General'
  },
  password: {
    id: 'SettingsTabPasswordSecurity',
    defaultMessage: 'Password & Security'
  }
})

const TABS: TabType[] = [
  {
    label: tabMessages.general,
    value: 'GENERAL'
  },
  {
    label: tabMessages.password,
    value: 'PASSWD'
  }
]

// GENDER_UNSPECIFIED, GENDER_FEMALE, GENDER_MALE, GENDER_DIVERSE
const genderOptions = defineMessages({
  GENDER_UNSPECIFIED: {
    id: 'SettingsProfileGenderUnspecified',
    defaultMessage: 'Unspecified'
  },
  GENDER_MALE: {
    id: 'SettingsProfileGenderMale',
    defaultMessage: 'Male'
  },
  GENDER_FEMALE: {
    id: 'SettingsProfileGenderFemale',
    defaultMessage: 'Female'
  },
  GENDER_DIVERSE: {
    id: 'SettingsProfileGenderOther',
    defaultMessage: 'Other'
  }
})

/**
 * One entry per catalog the CMS ships, keyed by the language tag stored on the
 * account. Names are in their own language, which is how every language list
 * that respects its readers is written.
 */
const localOptions = {
  en: 'English',
  de: 'Deutsch',
  sl: 'Slovenščina',
  it: 'Italiano',
  ja: '日本語',
  tr: 'Türkçe',
  ar: 'العربية'
}

export const Settings: React.FC<SettingsProps> = props => {
  const query = new URLSearchParams(window.location.search)
  const initialTab = query.get('activeTab') || 'GENERAL' // replace 'GENERAL' with your default tab value

  const intl = useIntl()
  const notify = useNotificationsContext()
  const {setPreviewLocale} = useUiLocale()

  const [user, setUser] = useState(props.user)

  useEffect(() => {
    setUser(props.user)
  }, [props.user])

  const [activeTab, setActiveTab] = useState<TabType['value']>(
    initialTab as TabType['value']
  )

  const handleTabChange = (tab: TabType['value']) => {
    setActiveTab(tab)
    // Toggle password if the tab is changed
    setIsChangingPassword(false)

    // Update the query parameters
    query.set('activeTab', tab)
    // navigate(window.location.pathname + '?' + query.toString())
  }

  const [isProfileUpdating, setIsProfileUpdating] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsProfileUpdating(true)
    // Update profile information on form submission
    await props.onProfileUpdate(user.human.profile)
    setIsProfileUpdating(false)
  }

  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [passwordConfirmation, setPasswordConfirmation] = useState<string>('')

  const togglePasswordChange = () => {
    setIsChangingPassword(!isChangingPassword)
  }

  const [isProfileAvatarUpdating, setIsProfileAvatarUpdating] = useState(false)

  const handleProfileAvatarUpdate = async (avatarFile: File) => {
    setIsProfileAvatarUpdating(true)
    await props.onProfileAvatarUpdate(avatarFile)
    setIsProfileAvatarUpdating(false)
  }

  const [isUsernameChanging, setIsUsernameChanging] = useState(false)

  const handleUsernameChange = async () => {
    const userName = await notify.prompt({
      title: intl.formatMessage({
        id: 'SettingsUsernamePromptTitle',
        defaultMessage: 'Change Username'
      }),
      message: intl.formatMessage({
        id: 'SettingsUsernamePromptMessage',
        defaultMessage: 'Please enter your new username'
      })
    })

    if (userName) {
      // update username
      setIsUsernameChanging(true)
      await props.onUsernameUpdate(userName)
      setIsUsernameChanging(false)
    }
  }

  const [isEmailChanging, setIsEmailChanging] = useState(false)

  const handleEmailChange = async () => {
    const email = await notify.prompt({
      title: intl.formatMessage({
        id: 'SettingsEmailPromptTitle',
        defaultMessage: 'Change Email'
      }),
      message: intl.formatMessage({
        id: 'SettingsEmailPromptMessage',
        defaultMessage: 'Please enter your new email'
      })
    })

    if (email) {
      // update email
      setIsEmailChanging(true)
      await props.onEmailUpdate(email)
      setIsEmailChanging(false)
    }
  }

  const [isEmailResendingCode, setIsEmailResendingCode] = useState(false)

  const handleEmailResendCode = async () => {
    setIsEmailResendingCode(true)

    await props.onEmailResendCode()

    setIsEmailResendingCode(false)
  }

  const [isPhoneChanging, setIsPhoneChanging] = useState(false)

  const handlePhoneChange = async () => {
    const phone = await notify.prompt({
      title: intl.formatMessage({
        id: 'SettingsPhonePromptTitle',
        defaultMessage: 'Change Phone Number'
      }),
      message: intl.formatMessage({
        id: 'SettingsPhonePromptMessage',
        defaultMessage: 'Please enter your new phone number'
      })
    })

    if (phone) {
      // update phone number
      setIsPhoneChanging(true)
      await props.onphoneUpdate(phone)
      setIsPhoneChanging(false)
    }
  }

  const [isPhoneDeleting, setIsPhoneDeleting] = useState(false)

  const handlephoneDelete = async () => {
    const confirm = await notify.confirm({
      title: intl.formatMessage({
        id: 'SettingsPhoneDeleteConfirmTitle',
        defaultMessage: 'Delete Phone Number'
      }),
      message: intl.formatMessage({
        id: 'SettingsPhoneDeleteConfirmMessage',
        defaultMessage: 'Are you sure you want to delete your phone number?'
      })
    })

    if (confirm) {
      // delete phone number
      setIsPhoneDeleting(true)
      await props.onphoneDelete()
      setIsPhoneDeleting(false)
    }
  }

  const [isPhoneVerifying, setIsPhoneVerifying] = useState(false)

  const handlephoneVerify = async () => {
    const code = await notify.prompt({
      title: intl.formatMessage({
        id: 'SettingsPhoneVerifyPromptTitle',
        defaultMessage: 'Verify Phone Number'
      }),
      message: intl.formatMessage({
        id: 'SettingsPhoneVerifyPromptMessage',
        defaultMessage: 'Please enter the verification code'
      })
    })

    if (code) {
      // verify phone number
      setIsPhoneVerifying(true)
      await props.onphoneVerify(code)
      setIsPhoneVerifying(false)
    }
  }

  const [isPhoneResendingCode, setIsPhoneResendingCode] = useState(false)

  const handlephoneResendCode = async () => {
    setIsPhoneResendingCode(true)

    await props.onphoneResendCode()

    setIsPhoneResendingCode(false)
  }

  const [isPasswordChanging, setIsPasswordChanging] = useState(false)

  const handlePasswordChange = async () => {
    setIsPasswordChanging(true)
    await props.onPasswordUpdate(currentPassword, password)
    setIsPasswordChanging(false)
  }

  const [isContactInformationRefreshing, setIsContactInformationRefreshing] =
    useState(false)

  const handleContactInformationRefresh = async () => {
    setIsContactInformationRefreshing(true)
    await props.onContactInformationRefresh()
    setIsContactInformationRefreshing(false)
  }

  return (
    <Grid templateColumns={{base: '1fr', md: '15% 85%'}} gap={4}>
      <GridItem>
        <VStack>
          {TABS.map(tab => (
            <Button
              w="full"
              justifyContent="left"
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              variant="ghost"
              color={tab.value === activeTab ? 'brand.500' : undefined}>
              {intl.formatMessage(tab.label)}
            </Button>
          ))}
        </VStack>
      </GridItem>
      <GridItem>
        {activeTab === 'GENERAL' && (
          <Stack gap="8">
            <Card.Root>
              <Card.Header fontWeight="bold" fontSize="lg">
                {intl.formatMessage({
                  id: 'SettingsProfileTitle',
                  defaultMessage: 'Profile'
                })}
              </Card.Header>
              <Card.Body>
                <Stack gap="6">
                  <HStack gap="6">
                    <HStack>
                      <Avatar.Root
                        size="xl"
                        cursor="pointer"
                        onClick={
                          isProfileAvatarUpdating
                            ? undefined
                            : () => {
                                const input = document.createElement('input')
                                input.type = 'file'
                                input.accept = 'image/*'
                                input.onchange = async e => {
                                  const file = (e.target as HTMLInputElement)
                                    .files![0]

                                  if (!file) {
                                    notify.toast({
                                      title: intl.formatMessage({
                                        id: 'SettingsProfileAvatarNoFileSelected',
                                        defaultMessage: 'No file selected'
                                      }),
                                      status: 'error'
                                    })
                                    return
                                  }

                                  await handleProfileAvatarUpdate(file)
                                }
                                input.click()
                              }
                        }>
                        <Avatar.Fallback
                          name={user?.human?.profile?.displayName}
                        />
                        <Avatar.Image src={user?.human?.profile?.avatarUrl} />
                      </Avatar.Root>

                      {isProfileAvatarUpdating && (
                        <Spinner size="sm" color="brand.500" />
                      )}
                    </HStack>
                    <Stack gap="4">
                      <Field.Root id="userName">
                        <Field.Label>
                          {intl.formatMessage({
                            id: 'SettingsProfileUsernameLabel',
                            defaultMessage: 'Username'
                          })}
                        </Field.Label>
                        <HStack>
                          <Input
                            disabled
                            maxW="xs"
                            autoComplete="off"
                            bg="gray.100"
                            value={user?.userName}
                            onChange={e =>
                              setUser({...user, userName: e.target.value})
                            }
                          />
                          <IconButton
                            size="lg"
                            aria-label={intl.formatMessage({
                              id: 'SettingsProfileUsernameEditAriaLabel',
                              defaultMessage: 'Edit userName'
                            })}
                            variant="ghost"
                            onClick={handleUsernameChange}
                            loading={isUsernameChanging}>
                            <FaEdit />
                          </IconButton>
                        </HStack>
                      </Field.Root>
                    </Stack>
                  </HStack>

                  <form onSubmit={handleSubmit}>
                    <Stack gap="6">
                      <SimpleGrid columns={{base: 1, md: 2}} gap="6">
                        <Field.Root id="firstName">
                          <Field.Label>
                            {intl.formatMessage({
                              id: 'SettingsProfileFirstNameLabel',
                              defaultMessage: 'First Name'
                            })}
                          </Field.Label>
                          <Input
                            placeholder=""
                            value={user?.human?.profile?.firstName}
                            onChange={e =>
                              setUser({
                                ...user,
                                human: {
                                  ...user.human,
                                  profile: {
                                    ...user.human.profile,
                                    firstName: e.target.value
                                  }
                                }
                              })
                            }
                          />
                        </Field.Root>
                        <Field.Root id="lastName">
                          <Field.Label>
                            {intl.formatMessage({
                              id: 'SettingsProfileLastNameLabel',
                              defaultMessage: 'Last Name'
                            })}
                          </Field.Label>
                          <Input
                            placeholder=""
                            value={user?.human?.profile?.lastName}
                            onChange={e =>
                              setUser({
                                ...user,
                                human: {
                                  ...user.human,
                                  profile: {
                                    ...user.human.profile,
                                    lastName: e.target.value
                                  }
                                }
                              })
                            }
                          />
                        </Field.Root>

                        <Field.Root id="nickName">
                          <Field.Label>
                            {intl.formatMessage({
                              id: 'SettingsProfileNicknameLabel',
                              defaultMessage: 'Nickname'
                            })}
                          </Field.Label>
                          <Input
                            placeholder=""
                            value={user?.human?.profile?.nickName}
                            onChange={e =>
                              setUser({
                                ...user,
                                human: {
                                  ...user.human,
                                  profile: {
                                    ...user.human.profile,
                                    nickName: e.target.value
                                  }
                                }
                              })
                            }
                          />
                        </Field.Root>

                        <Field.Root id="displayName">
                          <Field.Label>
                            {intl.formatMessage({
                              id: 'SettingsProfileFullNameLabel',
                              defaultMessage: 'Full Name'
                            })}
                          </Field.Label>
                          <Input
                            placeholder=""
                            value={user?.human?.profile?.displayName}
                            onChange={e =>
                              setUser({
                                ...user,
                                human: {
                                  ...user.human,
                                  profile: {
                                    ...user.human.profile,
                                    displayName: e.target.value
                                  }
                                }
                              })
                            }
                          />
                        </Field.Root>

                        <Field.Root id="gender">
                          <Field.Label>
                            {intl.formatMessage({
                              id: 'SettingsProfileGenderLabel',
                              defaultMessage: 'Gender'
                            })}
                          </Field.Label>
                          <NativeSelect.Root>
                            <NativeSelect.Field
                              defaultValue={user?.human?.profile?.gender}
                              onChange={e => {
                                setUser({
                                  ...user,
                                  human: {
                                    ...user.human,
                                    profile: {
                                      ...user.human.profile,
                                      gender: e.target.value
                                    }
                                  }
                                })
                              }}>
                              {Object.entries(genderOptions).map(
                                ([key, value]) => (
                                  <option key={key} value={key}>
                                    {intl.formatMessage(value)}
                                  </option>
                                )
                              )}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                          </NativeSelect.Root>
                        </Field.Root>

                        <Field.Root id="preferredLanguage">
                          <Field.Label>
                            {intl.formatMessage({
                              id: 'SettingsProfileLanguageLabel',
                              defaultMessage: 'Language'
                            })}
                          </Field.Label>
                          <NativeSelect.Root>
                            {/* An account without a language would otherwise
                                display the first option as if it were set,
                                and choosing it again fires no change. The
                                disabled placeholder keeps "not set" visible
                                until a real choice is made. */}
                            <NativeSelect.Field
                              defaultValue={
                                user?.human?.profile?.preferredLanguage || ''
                              }
                              onChange={e => {
                                // The UI follows the pick at once; Save is
                                // what writes it to the account.
                                setPreviewLocale(e.target.value)

                                setUser({
                                  ...user,
                                  human: {
                                    ...user.human,
                                    profile: {
                                      ...user.human.profile,
                                      preferredLanguage: e.target.value
                                    }
                                  }
                                })
                              }}>
                              <option value="" disabled>
                                {intl.formatMessage({
                                  id: 'SettingsProfileLanguageNotSet',
                                  defaultMessage: 'Not set'
                                })}
                              </option>
                              {Object.entries(localOptions).map(
                                ([key, value]) => (
                                  <option key={key} value={key}>
                                    {value}
                                  </option>
                                )
                              )}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                          </NativeSelect.Root>
                        </Field.Root>
                      </SimpleGrid>

                      <ButtonGroup>
                        <Button loading={isProfileUpdating} type="submit">
                          {intl.formatMessage({
                            id: 'SettingsSaveButton',
                            defaultMessage: 'Save'
                          })}
                        </Button>
                      </ButtonGroup>
                    </Stack>
                  </form>
                </Stack>
              </Card.Body>
            </Card.Root>

            <Card.Root>
              <Card.Header fontWeight="bold" fontSize="lg">
                <HStack justifyContent="space-between">
                  <Text>
                    {intl.formatMessage({
                      id: 'SettingsContactTitle',
                      defaultMessage: 'Contact Information'
                    })}
                  </Text>
                  <IconButton
                    size="lg"
                    aria-label={intl.formatMessage({
                      id: 'SettingsContactRefreshAriaLabel',
                      defaultMessage: 'Refresh'
                    })}
                    variant="ghost"
                    onClick={handleContactInformationRefresh}
                    loading={isContactInformationRefreshing}>
                    <MdRefresh />
                  </IconButton>
                </HStack>
              </Card.Header>
              <Card.Body>
                <Text fontSize="sm" color="gray.600">
                  {intl.formatMessage({
                    id: 'SettingsContactDescription',
                    defaultMessage:
                      'The provided information is used to send important information, like password reset e-mails to you.'
                  })}
                </Text>
                <Stack separator={<StackSeparator />} gap="6" my="4">
                  <Field.Root id="email">
                    <HStack justifyContent="space-between">
                      <Field.Label>
                        {intl.formatMessage({
                          id: 'SettingsContactEmailLabel',
                          defaultMessage: 'Email'
                        })}
                      </Field.Label>
                      <IconButton
                        size="lg"
                        aria-label={intl.formatMessage({
                          id: 'SettingsContactEmailEditAriaLabel',
                          defaultMessage: 'Edit email'
                        })}
                        variant="ghost"
                        onClick={handleEmailChange}
                        loading={isEmailChanging}>
                        <FaEdit />
                      </IconButton>
                    </HStack>
                    <Text mt="2">{user?.human?.email?.email}</Text>

                    <HStack>
                      <Text
                        fontSize="sm"
                        color={
                          user?.human?.email?.isEmailVerified
                            ? 'green.500'
                            : 'red.500'
                        }>
                        {user?.human?.email?.isEmailVerified
                          ? intl.formatMessage({
                              id: 'SettingsContactVerified',
                              defaultMessage: 'Verified'
                            })
                          : intl.formatMessage({
                              id: 'SettingsContactNotVerified',
                              defaultMessage: 'Not verified'
                            })}
                      </Text>

                      {!user?.human?.email?.isEmailVerified && (
                        <>
                          <Button
                            variant="plain"
                            color="fg.subtle"
                            fontWeight="normal"
                            onClick={handleEmailResendCode}
                            loading={isEmailResendingCode}>
                            {intl.formatMessage({
                              id: 'SettingsContactResendCodeButton',
                              defaultMessage: 'Resend Code'
                            })}
                          </Button>
                        </>
                      )}
                    </HStack>
                  </Field.Root>

                  <Field.Root>
                    {user?.human?.phone?.phone ? (
                      <>
                        <HStack justifyContent="space-between">
                          <Field.Label>
                            {intl.formatMessage({
                              id: 'SettingsContactPhoneLabel',
                              defaultMessage: 'Phone number'
                            })}
                          </Field.Label>
                          <HStack>
                            <IconButton
                              size="lg"
                              aria-label={intl.formatMessage({
                                id: 'SettingsContactPhoneDeleteAriaLabel',
                                defaultMessage: 'Delete phone number'
                              })}
                              variant="ghost"
                              colorPalette="red"
                              onClick={handlephoneDelete}
                              loading={isPhoneDeleting}>
                              <Icon color="red.500" asChild>
                                <FaTrash />
                              </Icon>
                            </IconButton>
                            <IconButton
                              size="lg"
                              aria-label={intl.formatMessage({
                                id: 'SettingsContactPhoneEditAriaLabel',
                                defaultMessage: 'Edit phone number'
                              })}
                              variant="ghost"
                              onClick={handlePhoneChange}
                              loading={isPhoneChanging}>
                              <FaEdit />
                            </IconButton>
                          </HStack>
                        </HStack>
                        <Text mt="2">{user.human.phone.phone}</Text>

                        <HStack>
                          <Text
                            fontSize="sm"
                            color={
                              user.human.phone.isPhoneVerified
                                ? 'green.500'
                                : 'red.500'
                            }>
                            {user.human.phone.isPhoneVerified
                              ? intl.formatMessage({
                                  id: 'SettingsContactVerified',
                                  defaultMessage: 'Verified'
                                })
                              : intl.formatMessage({
                                  id: 'SettingsContactNotVerified',
                                  defaultMessage: 'Not verified'
                                })}
                          </Text>

                          {!user.human.phone.isPhoneVerified && (
                            <>
                              <Button
                                variant="plain"
                                color="fg.subtle"
                                fontWeight="normal"
                                onClick={handlephoneVerify}
                                loading={isPhoneVerifying}>
                                {intl.formatMessage({
                                  id: 'SettingsContactVerifyButton',
                                  defaultMessage: 'Verify'
                                })}
                              </Button>

                              <Button
                                variant="plain"
                                color="fg.subtle"
                                fontWeight="normal"
                                onClick={handlephoneResendCode}
                                loading={isPhoneResendingCode}>
                                {intl.formatMessage({
                                  id: 'SettingsContactResendCodeButton',
                                  defaultMessage: 'Resend Code'
                                })}
                              </Button>
                            </>
                          )}
                        </HStack>
                      </>
                    ) : (
                      <>
                        <HStack justifyContent="space-between">
                          <Field.Label>
                            {intl.formatMessage({
                              id: 'SettingsContactPhoneLabel',
                              defaultMessage: 'Phone number'
                            })}
                          </Field.Label>
                          <IconButton
                            size="lg"
                            aria-label={intl.formatMessage({
                              id: 'SettingsContactPhoneAddAriaLabel',
                              defaultMessage: 'Add phone number'
                            })}
                            variant="ghost"
                            onClick={handlePhoneChange}
                            loading={isPhoneChanging}>
                            <FaPlus />
                          </IconButton>
                        </HStack>
                        <Text mt="2">
                          {intl.formatMessage({
                            id: 'SettingsContactPhoneNone',
                            defaultMessage: 'No phone number provided'
                          })}
                        </Text>
                      </>
                    )}
                  </Field.Root>
                </Stack>
              </Card.Body>
            </Card.Root>
          </Stack>
        )}

        {activeTab === 'PASSWD' && (
          <Card.Root>
            <Card.Header fontWeight="bold" fontSize="lg">
              {intl.formatMessage({
                id: 'SettingsPasswordTitle',
                defaultMessage: 'Password'
              })}
            </Card.Header>

            <Card.Body>
              {isChangingPassword ? (
                <Stack gap="6">
                  <Field.Label>
                    {intl.formatMessage({
                      id: 'SettingsPasswordPolicyIntro',
                      defaultMessage:
                        'Enter the new password according to the policy below.'
                    })}
                  </Field.Label>
                  <Field.Root>
                    <Field.Label>
                      {intl.formatMessage({
                        id: 'SettingsPasswordCurrentLabel',
                        defaultMessage: 'Current Password'
                      })}
                    </Field.Label>
                    <Input
                      maxW="md"
                      type="password"
                      placeholder={intl.formatMessage({
                        id: 'SettingsPasswordCurrentPlaceholder',
                        defaultMessage: 'New password'
                      })}
                      onChange={e => setCurrentPassword(e.target.value)}
                    />
                  </Field.Root>

                  <List.Root gap={3}>
                    {props.passwordPolicy.minLength && (
                      <List.Item>
                        {password.length >= props.passwordPolicy.minLength ? (
                          <List.Indicator color="green.500" asChild>
                            <FaCheck />
                          </List.Indicator>
                        ) : (
                          <List.Indicator color="red.500" asChild>
                            <FaX />
                          </List.Indicator>
                        )}
                        {intl.formatMessage(
                          {
                            id: 'SettingsPasswordPolicyMinLength',
                            defaultMessage:
                              'Has to be at least {minLength} characters long. ({length} / {minLength})'
                          },
                          {
                            minLength: props.passwordPolicy.minLength,
                            length: password.length
                          }
                        )}
                      </List.Item>
                    )}
                    {props.passwordPolicy.hasSymbol && (
                      <List.Item>
                        {/[\p{P}\p{S}]/u.test(password) ? (
                          <List.Indicator color="green.500" asChild>
                            <FaCheck />
                          </List.Indicator>
                        ) : (
                          <List.Indicator color="red.500" asChild>
                            <FaX />
                          </List.Indicator>
                        )}
                        {intl.formatMessage({
                          id: 'SettingsPasswordPolicySymbol',
                          defaultMessage:
                            'Must include a symbol or punctuation mark.'
                        })}
                      </List.Item>
                    )}

                    {props.passwordPolicy.hasNumber && (
                      <List.Item>
                        {/\d/.test(password) ? (
                          <List.Indicator color="green.500" asChild>
                            <FaCheck />
                          </List.Indicator>
                        ) : (
                          <List.Indicator color="red.500" asChild>
                            <FaX />
                          </List.Indicator>
                        )}
                        {intl.formatMessage({
                          id: 'SettingsPasswordPolicyNumber',
                          defaultMessage: 'Must include a number.'
                        })}
                      </List.Item>
                    )}

                    {props.passwordPolicy.hasUppercase && (
                      <List.Item>
                        {/[A-Z]/.test(password) ? (
                          <List.Indicator color="green.500" asChild>
                            <FaCheck />
                          </List.Indicator>
                        ) : (
                          <List.Indicator color="red.500" asChild>
                            <FaX />
                          </List.Indicator>
                        )}
                        {intl.formatMessage({
                          id: 'SettingsPasswordPolicyUppercase',
                          defaultMessage: 'Must include an uppercase letter.'
                        })}
                      </List.Item>
                    )}

                    {props.passwordPolicy.hasLowercase && (
                      <List.Item>
                        {/[a-z]/.test(password) ? (
                          <List.Indicator color="green.500" asChild>
                            <FaCheck />
                          </List.Indicator>
                        ) : (
                          <List.Indicator color="red.500" asChild>
                            <FaX />
                          </List.Indicator>
                        )}
                        {intl.formatMessage({
                          id: 'SettingsPasswordPolicyLowercase',
                          defaultMessage: 'Must include a lowercase letter.'
                        })}
                      </List.Item>
                    )}

                    <List.Item>
                      {password && password === passwordConfirmation ? (
                        <List.Indicator color="green.500" asChild>
                          <FaCheck />
                        </List.Indicator>
                      ) : (
                        <List.Indicator color="red.500" asChild>
                          <FaX />
                        </List.Indicator>
                      )}
                      {intl.formatMessage({
                        id: 'SettingsPasswordPolicyMatch',
                        defaultMessage: 'Passwords match.'
                      })}
                    </List.Item>
                  </List.Root>

                  <HStack>
                    <Field.Root>
                      <Field.Label>
                        {intl.formatMessage({
                          id: 'SettingsPasswordNewLabel',
                          defaultMessage: 'New Password'
                        })}
                      </Field.Label>
                      <Input
                        type="password"
                        placeholder={intl.formatMessage({
                          id: 'SettingsPasswordNewPlaceholder',
                          defaultMessage: 'New password'
                        })}
                        autoComplete="new-password"
                        onChange={e => setPassword(e.target.value)}
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>
                        {intl.formatMessage({
                          id: 'SettingsPasswordConfirmLabel',
                          defaultMessage: 'Confirm Password'
                        })}
                      </Field.Label>
                      <Input
                        type="password"
                        placeholder={intl.formatMessage({
                          id: 'SettingsPasswordConfirmPlaceholder',
                          defaultMessage: 'Confirm password'
                        })}
                        autoComplete="new-password"
                        onChange={e => setPasswordConfirmation(e.target.value)}
                      />
                    </Field.Root>
                  </HStack>

                  <ButtonGroup>
                    <Button
                      loading={isPasswordChanging}
                      type="submit"
                      onClick={handlePasswordChange}>
                      {intl.formatMessage({
                        id: 'SettingsPasswordResetButton',
                        defaultMessage: 'Reset Current Password'
                      })}
                    </Button>
                    <Button variant="outline" onClick={togglePasswordChange}>
                      {intl.formatMessage({
                        id: 'SettingsPasswordCancelButton',
                        defaultMessage: 'Cancel'
                      })}
                    </Button>
                  </ButtonGroup>
                </Stack>
              ) : (
                <Field.Root>
                  <HStack justifyContent="space-between">
                    <Field.Label>
                      {intl.formatMessage({
                        id: 'SettingsPasswordHint',
                        defaultMessage:
                          'A secure password helps to protect the account'
                      })}
                    </Field.Label>
                    <IconButton
                      size="lg"
                      aria-label={intl.formatMessage({
                        id: 'SettingsPasswordEditAriaLabel',
                        defaultMessage: 'Edit email'
                      })}
                      variant="ghost"
                      onClick={togglePasswordChange}
                      loading={isPasswordChanging}>
                      <FaEdit />
                    </IconButton>
                  </HStack>
                  <Text mt="2">*********</Text>
                </Field.Root>
              )}
            </Card.Body>
          </Card.Root>
        )}
      </GridItem>
    </Grid>
  )
}
