/**
 * "Are you sure?", the one way it is asked in this app.
 *
 * The two exits of the driver's slider, Reject and No show, go through this
 * rather than being stops on the slider, so a slipping thumb cannot cancel a
 * ride. Everything destructive on the dispatcher's side goes through it too.
 * `destructive` paints the confirm button red, the default keeps the brand.
 */
import React from 'react'
import {Button, CloseButton, Dialog, Portal, Text} from '@chakra-ui/react'
import {useI18nCode} from '../i18n'
import {getI18nCommon} from '../locales/i18nCommon'

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  body?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  /** Disables both buttons while the mutation is out. */
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false
}: ConfirmDialogProps) {
  const code = useI18nCode()
  const {strings} = getI18nCommon(code)

  return (
    <Dialog.Root
      role="alertdialog"
      open={open}
      onOpenChange={e => {
        if (!e.open && !loading) onClose()
      }}
      size="sm"
      placement="center"
      lazyMount
      unmountOnExit>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            {body !== undefined && (
              <Dialog.Body>
                {typeof body === 'string' ? <Text>{body}</Text> : body}
              </Dialog.Body>
            )}
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose} disabled={loading}>
                {cancelLabel ?? strings.Cancel}
              </Button>
              <Button
                colorPalette={destructive ? 'red' : 'brand'}
                onClick={() => void onConfirm()}
                loading={loading}>
                {confirmLabel ?? strings.Confirm}
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" disabled={loading} />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
