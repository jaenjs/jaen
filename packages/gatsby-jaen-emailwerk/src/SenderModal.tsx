import {useState} from 'react'
import {Controller, useForm} from 'react-hook-form'
import {useIntl} from 'react-intl'
import {
  Alert,
  Badge,
  Button,
  ButtonGroup,
  CloseButton,
  HStack,
  Input,
  Switch,
  Table,
  Text,
  VStack,
  useDisclosure,
  Separator,
  Field,
  Dialog,
  Portal
} from '@chakra-ui/react'

export interface SenderSmtpFormData {
  host: string
  port: number
  secure: boolean
  username: string
  password: string
}

export interface SenderFormData {
  address: string
  displayName?: string
  isDefault: boolean
  smtp: SenderSmtpFormData
}

export interface SenderItem {
  id: string
  address: string
  displayName?: string | null
  transport: string
  isDefault: boolean
  enabled: boolean
}

export interface SenderModalProps {
  senders: SenderItem[]
  /** Create an SMTP sender (emailwerk `senderCreate`). */
  onCreate: (data: SenderFormData) => Promise<void>
  /** Make a sender the org default (emailwerk `senderSetDefault`). */
  onSetDefault: (id: string) => Promise<void>
  /** Verify a sender's connectivity (emailwerk `senderVerify`). */
  onVerify: (id: string) => Promise<void>
  /** Delete a sender (emailwerk `senderDelete`). */
  onDelete: (id: string) => Promise<void>
}

/**
 * Sender management modal: lists the org's senders (default/enabled state,
 * set-default / verify / delete actions) and creates new SMTP senders.
 * Replaces the mailpress-era EmailSMTPModal (org-wide single mailbox).
 */
export function SenderModal({
  senders,
  onCreate,
  onSetDefault,
  onVerify,
  onDelete
}: SenderModalProps) {
  const intl = useIntl()
  const {open, onOpen, onClose} = useDisclosure()
  const [error, setError] = useState<string | null>(null)
  const [busySenderId, setBusySenderId] = useState<string | null>(null)
  const {control, handleSubmit, reset, formState} = useForm<SenderFormData>({
    defaultValues: {
      address: '',
      displayName: '',
      isDefault: true,
      smtp: {
        host: '',
        port: 587,
        secure: false,
        username: '',
        password: ''
      }
    }
  })

  const onSubmitForm = async (data: SenderFormData) => {
    setError(null)
    try {
      data.smtp.port = Number(data.smtp.port)
      await onCreate(data)
      reset()
    } catch (err) {
      if (err instanceof Error) {
        setError(
          err.message ||
            intl.formatMessage({
              id: 'EmailwerkSenderModalSubmitError',
              defaultMessage: 'An error occurred while submitting the form.'
            })
        )
      } else {
        setError(
          intl.formatMessage({
            id: 'EmailwerkSenderModalUnknownError',
            defaultMessage: 'An unknown error occurred.'
          })
        )
      }
    }
  }

  const runSenderAction = async (
    id: string,
    action: (id: string) => Promise<void>
  ) => {
    setError(null)
    setBusySenderId(id)
    try {
      await action(id)
    } catch (err) {
      if (err instanceof Error) {
        setError(
          err.message ||
            intl.formatMessage({
              id: 'EmailwerkSenderModalActionFailed',
              defaultMessage: 'Sender action failed.'
            })
        )
      } else {
        setError(
          intl.formatMessage({
            id: 'EmailwerkSenderModalUnknownError',
            defaultMessage: 'An unknown error occurred.'
          })
        )
      }
    } finally {
      setBusySenderId(null)
    }
  }

  return (
    <>
      <Button
        onClick={onOpen}
        loading={formState.isSubmitting}
        variant="outline">
        {intl.formatMessage({
          id: 'EmailwerkSenderModalOpenButton',
          defaultMessage: 'Manage Senders'
        })}
      </Button>

      <Dialog.Root
        open={open}
        size="xl"
        onOpenChange={e => {
          if (!e.open) {
            onClose()
          }
        }}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                {intl.formatMessage({
                  id: 'EmailwerkSenderModalTitle',
                  defaultMessage: 'Senders'
                })}
              </Dialog.Header>
              {/* v3's CloseTrigger draws nothing of its own, so the X that
                  v2's ModalCloseButton brought has to be handed to it, at the
                  32px and neutral hover v2 gave it. */}
              <Dialog.CloseTrigger asChild>
                <CloseButton size="xs" colorPalette="gray" />
              </Dialog.CloseTrigger>
              <form onSubmit={handleSubmit(onSubmitForm)}>
                <Dialog.Body>
                  <VStack gap={4} align="stretch">
                    {error && (
                      <Alert.Root status="error">
                        <Alert.Indicator />
                        <Alert.Title mr={2}>
                          {intl.formatMessage({
                            id: 'EmailwerkSenderModalErrorAlertTitle',
                            defaultMessage: 'Error!'
                          })}
                        </Alert.Title>
                        <Alert.Description>{error}</Alert.Description>
                      </Alert.Root>
                    )}

                    {senders.length > 0 ? (
                      <Table.Root size="sm">
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeader>
                              {intl.formatMessage({
                                id: 'EmailwerkSenderModalColumnAddress',
                                defaultMessage: 'Address'
                              })}
                            </Table.ColumnHeader>
                            <Table.ColumnHeader>
                              {intl.formatMessage({
                                id: 'EmailwerkSenderModalColumnTransport',
                                defaultMessage: 'Transport'
                              })}
                            </Table.ColumnHeader>
                            <Table.ColumnHeader></Table.ColumnHeader>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {senders.map(sender => (
                            <Table.Row key={sender.id}>
                              <Table.Cell>
                                <HStack>
                                  <Text>{sender.address}</Text>
                                  {sender.isDefault && (
                                    <Badge colorPalette="green">
                                      {intl.formatMessage({
                                        id: 'EmailwerkSenderModalBadgeDefault',
                                        defaultMessage: 'default'
                                      })}
                                    </Badge>
                                  )}
                                  {!sender.enabled && (
                                    <Badge colorPalette="red">
                                      {intl.formatMessage({
                                        id: 'EmailwerkSenderModalBadgeDisabled',
                                        defaultMessage: 'disabled'
                                      })}
                                    </Badge>
                                  )}
                                </HStack>
                              </Table.Cell>
                              <Table.Cell>{sender.transport}</Table.Cell>
                              <Table.Cell>
                                <ButtonGroup size="xs" variant="outline">
                                  {!sender.isDefault && (
                                    <Button
                                      onClick={() =>
                                        runSenderAction(sender.id, onSetDefault)
                                      }>
                                      {intl.formatMessage({
                                        id: 'EmailwerkSenderModalMakeDefaultButton',
                                        defaultMessage: 'Make default'
                                      })}
                                    </Button>
                                  )}
                                  <Button
                                    onClick={() =>
                                      runSenderAction(sender.id, onVerify)
                                    }
                                    disabled={busySenderId === sender.id}>
                                    {intl.formatMessage({
                                      id: 'EmailwerkSenderModalVerifyButton',
                                      defaultMessage: 'Verify'
                                    })}
                                  </Button>
                                  <Button
                                    colorPalette="red"
                                    onClick={() =>
                                      runSenderAction(sender.id, onDelete)
                                    }
                                    disabled={busySenderId === sender.id}>
                                    {intl.formatMessage({
                                      id: 'EmailwerkSenderModalDeleteButton',
                                      defaultMessage: 'Delete'
                                    })}
                                  </Button>
                                </ButtonGroup>
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Root>
                    ) : (
                      <Text color="gray.500">
                        {intl.formatMessage({
                          id: 'EmailwerkSenderModalEmpty',
                          defaultMessage: 'No senders configured yet.'
                        })}
                      </Text>
                    )}

                    <Separator />

                    <Text fontWeight="semibold">
                      {intl.formatMessage({
                        id: 'EmailwerkSenderModalAddHeading',
                        defaultMessage: 'Add SMTP sender'
                      })}
                    </Text>

                    <Controller
                      name="address"
                      control={control}
                      rules={{
                        required: intl.formatMessage({
                          id: 'EmailwerkSenderModalValidationAddressRequired',
                          defaultMessage: 'Address is required'
                        })
                      }}
                      render={({field, fieldState: {error}}) => (
                        <Field.Root invalid={!!error}>
                          <Field.Label>
                            {intl.formatMessage({
                              id: 'EmailwerkSenderModalAddressLabel',
                              defaultMessage: 'Email Address'
                            })}
                          </Field.Label>
                          <Input
                            {...field}
                            placeholder={intl.formatMessage({
                              id: 'EmailwerkSenderModalAddressPlaceholder',
                              defaultMessage: 'noreply@example.com'
                            })}
                          />
                          {error && (
                            <Text color="red.500">{error.message}</Text>
                          )}
                        </Field.Root>
                      )}
                    />
                    <Controller
                      name="displayName"
                      control={control}
                      render={({field}) => (
                        <Field.Root>
                          <Field.Label>
                            {intl.formatMessage({
                              id: 'EmailwerkSenderModalDisplayNameLabel',
                              defaultMessage: 'Display Name'
                            })}
                          </Field.Label>
                          <Input {...field} />
                        </Field.Root>
                      )}
                    />
                    <Controller
                      name="smtp.host"
                      control={control}
                      rules={{
                        required: intl.formatMessage({
                          id: 'EmailwerkSenderModalValidationHostRequired',
                          defaultMessage: 'SMTP Host is required'
                        })
                      }}
                      render={({field, fieldState: {error}}) => (
                        <Field.Root invalid={!!error}>
                          <Field.Label>
                            {intl.formatMessage({
                              id: 'EmailwerkSenderModalHostLabel',
                              defaultMessage: 'SMTP Host'
                            })}
                          </Field.Label>
                          <Input {...field} />
                          {error && (
                            <Text color="red.500">{error.message}</Text>
                          )}
                        </Field.Root>
                      )}
                    />
                    <Controller
                      name="smtp.port"
                      control={control}
                      rules={{
                        required: intl.formatMessage({
                          id: 'EmailwerkSenderModalValidationPortRequired',
                          defaultMessage: 'SMTP Port is required'
                        })
                      }}
                      render={({field, fieldState: {error}}) => (
                        <Field.Root invalid={!!error}>
                          <Field.Label>
                            {intl.formatMessage({
                              id: 'EmailwerkSenderModalPortLabel',
                              defaultMessage: 'SMTP Port'
                            })}
                          </Field.Label>
                          <Input {...field} type="number" />
                          {error && (
                            <Text color="red.500">{error.message}</Text>
                          )}
                        </Field.Root>
                      )}
                    />
                    <Controller
                      name="smtp.secure"
                      control={control}
                      render={({field: {onChange, value, ref}}) => (
                        <Field.Root display="flex" alignItems="center">
                          <Field.Label htmlFor="secure" mb="0">
                            {intl.formatMessage({
                              id: 'EmailwerkSenderModalSecureLabel',
                              defaultMessage: 'Secure'
                            })}
                          </Field.Label>
                          {/* The id goes on the hidden input, not on
                              Switch.Root: Switch.Root would derive its own
                              input id from it and the label's htmlFor would
                              then point at nothing, so clicking the label
                              would stop toggling the switch. */}
                          <Switch.Root
                            checked={value}
                            onCheckedChange={e => onChange(e.checked)}>
                            <Switch.HiddenInput id="secure" ref={ref} />
                            <Switch.Control>
                              <Switch.Thumb />
                            </Switch.Control>
                          </Switch.Root>
                        </Field.Root>
                      )}
                    />
                    <Controller
                      name="smtp.username"
                      control={control}
                      rules={{
                        required: intl.formatMessage({
                          id: 'EmailwerkSenderModalValidationUsernameRequired',
                          defaultMessage: 'SMTP Username is required'
                        })
                      }}
                      render={({field, fieldState: {error}}) => (
                        <Field.Root invalid={!!error}>
                          <Field.Label>
                            {intl.formatMessage({
                              id: 'EmailwerkSenderModalUsernameLabel',
                              defaultMessage: 'SMTP Username'
                            })}
                          </Field.Label>
                          <Input {...field} />
                          {error && (
                            <Text color="red.500">{error.message}</Text>
                          )}
                        </Field.Root>
                      )}
                    />
                    <Controller
                      name="smtp.password"
                      control={control}
                      rules={{
                        required: intl.formatMessage({
                          id: 'EmailwerkSenderModalValidationPasswordRequired',
                          defaultMessage: 'SMTP Password is required'
                        })
                      }}
                      render={({field, fieldState: {error}}) => (
                        <Field.Root invalid={!!error}>
                          <Field.Label>
                            {intl.formatMessage({
                              id: 'EmailwerkSenderModalPasswordLabel',
                              defaultMessage: 'SMTP Password'
                            })}
                          </Field.Label>
                          <Input {...field} type="password" />
                          {error && (
                            <Text color="red.500">{error.message}</Text>
                          )}
                        </Field.Root>
                      )}
                    />
                    <Controller
                      name="isDefault"
                      control={control}
                      render={({field: {onChange, value, ref}}) => (
                        <Field.Root display="flex" alignItems="center">
                          <Field.Label htmlFor="isDefault" mb="0">
                            {intl.formatMessage({
                              id: 'EmailwerkSenderModalIsDefaultLabel',
                              defaultMessage: 'Set as default sender'
                            })}
                          </Field.Label>
                          <Switch.Root
                            checked={value}
                            onCheckedChange={e => onChange(e.checked)}>
                            <Switch.HiddenInput id="isDefault" ref={ref} />
                            <Switch.Control>
                              <Switch.Thumb />
                            </Switch.Control>
                          </Switch.Root>
                        </Field.Root>
                      )}
                    />
                  </VStack>
                </Dialog.Body>
                <Dialog.Footer>
                  <Button
                    colorPalette="blue"
                    mr={3}
                    type="submit"
                    loading={formState.isSubmitting}>
                    {intl.formatMessage({
                      id: 'EmailwerkSenderModalCreateButton',
                      defaultMessage: 'Create Sender'
                    })}
                  </Button>
                  <Button variant="ghost" onClick={onClose}>
                    {intl.formatMessage({
                      id: 'EmailwerkSenderModalCloseButton',
                      defaultMessage: 'Close'
                    })}
                  </Button>
                </Dialog.Footer>
              </form>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  )
}
