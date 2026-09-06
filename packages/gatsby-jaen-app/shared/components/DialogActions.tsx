/**
 * The footer of every dialog, drawer and sheet: a cancel and a confirm, never
 * closer than a thumb.
 *
 * hard-rules.md, "Two controls are never closer than a thumb": a ButtonGroup
 * with gap 3, the cancel as a ghost, the confirm as the solid brand button on
 * the trailing side, and below `sm` the two stacked full width with the same
 * gap, the confirm on top. Measured 2026-09-06 on the assign dialog, where
 * "Abbrechen" and "Zuweisen" touched: jaen's drawer recipe makes the footer
 * `display: block`, so any gap the footer itself declared was lost, and the
 * buttons were laid out by nothing at all.
 *
 * The group carries its own layout, so it does not depend on what the footer
 * around it is. A footer with a single action omits `onCancel`, and a confirm
 * that is a link (the route planner) passes `href` and becomes an anchor
 * styled as the button.
 */
import React from 'react'
import {Button, ButtonGroup} from '@chakra-ui/react'
import {useI18nCode} from '../i18n'
import {getI18nCommon} from '../locales/i18nCommon'

export interface DialogActionsProps {
  /** Omit for a footer with a single action. */
  onCancel?: () => void
  /** Defaults to the common catalogue's Cancel. */
  cancelLabel?: React.ReactNode
  cancelDisabled?: boolean
  confirmLabel: React.ReactNode
  /** Omit when the confirm submits the surrounding form, see `confirmType`. */
  onConfirm?: () => void | Promise<void>
  confirmType?: 'button' | 'submit'
  confirmDisabled?: boolean
  /** The confirm shows a spinner and the cancel is disabled as well. */
  loading?: boolean
  loadingText?: string
  /** Paints the confirm red, for the ends that cannot be undone. */
  destructive?: boolean
  /** The confirm becomes a link that opens in a new tab. */
  href?: string
  /** Set by the tests that measure the two buttons. */
  'data-testid'?: string
}

export function DialogActions({
  onCancel,
  cancelLabel,
  cancelDisabled = false,
  confirmLabel,
  onConfirm,
  confirmType = 'button',
  confirmDisabled = false,
  loading = false,
  loadingText,
  destructive = false,
  href,
  'data-testid': testId = 'dialog-actions'
}: DialogActionsProps) {
  const code = useI18nCode()
  const {strings: tc} = getI18nCommon(code)

  const confirm = href ? (
    <Button asChild colorPalette={destructive ? 'red' : 'brand'} w={{base: 'full', sm: 'auto'}} minH="44px">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {confirmLabel}
      </a>
    </Button>
  ) : (
    <Button
      type={confirmType}
      colorPalette={destructive ? 'red' : 'brand'}
      onClick={onConfirm ? () => void onConfirm() : undefined}
      loading={loading}
      loadingText={loadingText}
      disabled={confirmDisabled}
      w={{base: 'full', sm: 'auto'}}
      minH="44px">
      {confirmLabel}
    </Button>
  )

  return (
    <ButtonGroup
      data-testid={testId}
      gap="3"
      w="full"
      // column-reverse keeps the cancel first in the DOM and the tab order,
      // and puts the confirm on top on a phone as the rule asks.
      flexDirection={{base: 'column-reverse', sm: 'row'}}
      justifyContent="flex-end"
      alignItems="stretch">
      {onCancel && (
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={cancelDisabled || loading}
          w={{base: 'full', sm: 'auto'}}
          minH="44px">
          {cancelLabel ?? tc.Cancel}
        </Button>
      )}
      {confirm}
    </ButtonGroup>
  )
}
