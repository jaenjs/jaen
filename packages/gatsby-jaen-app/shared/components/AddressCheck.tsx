/**
 * "Adresse prüfen", the doubt the pylon leaves on a ride whose address it
 * could not work out with certainty. okf/architecture/dispatch.md section
 * 14.2.
 *
 * A ride carries free text and the pylon resolves it once: the geocoder
 * first, a language model where that answers nothing or answers ambiguously.
 * Where the answer is GUESSED or UNRESOLVED the board's row and the detail
 * draw this warning, and one tap on it opens the guess with two ways out:
 * take the suggestion, or type the right address. Either answer makes the
 * side RESOLVED by the dispatcher and the warning goes.
 *
 * The badge is a button and rounds at `control` like every other button on
 * the board (design-consistency.md rule 1), the two footer controls are the
 * shared `DialogActions` so they are never closer than a thumb, and every
 * word comes out of the transfers catalogue in the reader's language.
 */
import React, {useEffect, useState} from 'react'
import {
  Badge,
  Box,
  CloseButton,
  Dialog,
  Field,
  HStack,
  Input,
  Portal,
  Stack,
  Text
} from '@chakra-ui/react'
import {FaExclamationTriangle} from 'react-icons/fa'

import {
  addressOf,
  doubtfulSides,
  guessFor,
  hasAddressDoubt,
  type AddressBearing,
  type AddressSide,
  type ResolvedAddress
} from '../address'
import {useI18nCode} from '../i18n'
import {fill, getI18nTransfers} from '../locales/i18nTransfers'
import {getI18nCommon} from '../locales/i18nCommon'
import {DialogActions} from './DialogActions'
import {toaster} from './toaster'

export interface AddressCheckProps {
  transfer: AddressBearing & {id: string}
  /**
   * The write. Omitted for a reader who may not correct an address, a driver
   * or a customer, and then the badge is a badge and opens nothing.
   */
  onCorrect?: (which: AddressSide, address?: string) => Promise<unknown>
  /** The row the correction answers, so the screen can hold it. */
  onCorrected?: (row: unknown) => void
  size?: 'sm' | 'md'
}

/** The warning as it sits on a board row and beside the address on the detail. */
export function AddressCheckBadge({
  transfer,
  onCorrect,
  onCorrected,
  size = 'sm'
}: AddressCheckProps) {
  const code = useI18nCode()
  const t = getI18nTransfers(code).strings
  const [open, setOpen] = useState(false)

  if (!hasAddressDoubt(transfer)) return null

  const badge = (
    <Badge
      colorPalette="orange"
      size={size}
      data-testid="address-check"
      as={onCorrect ? 'button' : 'span'}
      variant="subtle"
      minH={onCorrect ? '44px' : undefined}
      px={onCorrect ? '2' : undefined}
      cursor={onCorrect ? 'pointer' : undefined}
      onClick={
        onCorrect
          ? (event: React.MouseEvent) => {
              // The board's row opens the ride on a click, and this is a
              // control inside it, not a way into the ride.
              event.stopPropagation()
              setOpen(true)
            }
          : undefined
      }>
      <HStack gap="1">
        <FaExclamationTriangle aria-hidden />
        <Text as="span">{t.AddressCheck}</Text>
      </HStack>
    </Badge>
  )

  return (
    <>
      {badge}
      {onCorrect && (
        <AddressCheckDialog
          open={open}
          onClose={() => setOpen(false)}
          transfer={transfer}
          onCorrect={onCorrect}
          onCorrected={onCorrected}
        />
      )}
    </>
  )
}

/** The one tap: the guess offered, confirmed or corrected, one side at a time. */
export function AddressCheckDialog({
  open,
  onClose,
  transfer,
  onCorrect,
  onCorrected
}: {
  open: boolean
  onClose: () => void
  transfer: AddressBearing & {id: string}
  onCorrect: (which: AddressSide, address?: string) => Promise<unknown>
  onCorrected?: (row: unknown) => void
}) {
  const code = useI18nCode()
  const t = getI18nTransfers(code).strings
  const tc = getI18nCommon(code).strings

  const sides = doubtfulSides(transfer)
  const [side, setSide] = useState<AddressSide>(sides[0]?.side ?? 'PICKUP')
  const current: ResolvedAddress = addressOf(transfer, side)
  const guess = guessFor(current)

  const [typed, setTyped] = useState(guess ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A ride whose other side is doubtful too is corrected one side at a time,
  // and the field follows the side rather than keeping the last guess in it.
  useEffect(() => {
    setTyped(guessFor(addressOf(transfer, side)) ?? '')
    setError(null)
  }, [side, transfer, open])

  useEffect(() => {
    if (open) setSide(sides[0]?.side ?? 'PICKUP')
    // The sides are read off the row; a row that changed under an open dialog
    // is the correction landing, and the dialog closes on its own answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const save = async (address?: string) => {
    setSaving(true)
    setError(null)
    try {
      const row = await onCorrect(side, address)
      onCorrected?.(row)
      toaster.success({title: t.ToastAddressSaved})
      onClose()
    } catch (e: any) {
      // What this hides: the pylon refusing the write, which for this
      // mutation is only a ride that is gone or a caller who is not an admin.
      // The sentence is the catalogue's, the cause is in the console.
      console.error('address: the correction was refused', e)
      setError(String(e?.message ?? t.ToastAddressFailed))
    } finally {
      setSaving(false)
    }
  }

  const label = side === 'PICKUP' ? t.AddressPickup : t.AddressDropoff

  return (
    <Dialog.Root
      open={open}
      onOpenChange={e => {
        if (!e.open && !saving) onClose()
      }}
      size="sm"
      placement="center"
      lazyMount
      unmountOnExit>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content data-testid="address-check-dialog">
            <Dialog.Header>
              <Dialog.Title>{t.AddressCheckTitle}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="4">
                <Text color="fg.muted" textStyle="sm">
                  {t.AddressCheckHint}
                </Text>

                {sides.length > 1 && (
                  <HStack gap="2">
                    {sides.map(s => (
                      <Badge
                        key={s.side}
                        as="button"
                        variant="subtle"
                        minH="44px"
                        px="3"
                        cursor="pointer"
                        colorPalette={s.side === side ? 'brand' : 'gray'}
                        onClick={() => setSide(s.side)}>
                        {s.side === 'PICKUP'
                          ? t.AddressPickup
                          : t.AddressDropoff}
                      </Badge>
                    ))}
                  </HStack>
                )}

                <Box>
                  <Text
                    textStyle="xs"
                    color="fg.muted"
                    textTransform="uppercase">
                    {label} · {t.AddressTyped}
                  </Text>
                  <Text fontWeight="medium" style={{overflowWrap: 'anywhere'}}>
                    {current.text || '–'}
                  </Text>
                </Box>

                <Box>
                  <Text
                    textStyle="xs"
                    color="fg.muted"
                    textTransform="uppercase">
                    {t.AddressGuess}
                  </Text>
                  <Text
                    fontWeight="medium"
                    color={guess ? undefined : 'fg.muted'}
                    style={{overflowWrap: 'anywhere'}}>
                    {guess ?? t.AddressNoGuess}
                  </Text>
                  {current.resolvedBy && (
                    <Text textStyle="xs" color="fg.muted">
                      {fill(t.AddressBySource, {source: current.resolvedBy})}
                    </Text>
                  )}
                </Box>

                <Field.Root>
                  <Field.Label>{t.AddressLabel}</Field.Label>
                  <Input
                    value={typed}
                    placeholder={t.AddressPlaceholder}
                    onChange={e => setTyped(e.currentTarget.value)}
                    minH="44px"
                  />
                </Field.Root>

                {error && (
                  <Text color="fg.error" textStyle="sm">
                    {error}
                  </Text>
                )}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <DialogActions
                onCancel={onClose}
                cancelLabel={tc.Cancel}
                confirmLabel={
                  typed.trim() && typed.trim() !== guess
                    ? t.AddressSave
                    : t.AddressConfirm
                }
                onConfirm={() =>
                  save(
                    typed.trim() && typed.trim() !== guess
                      ? typed.trim()
                      : undefined
                  )
                }
                confirmDisabled={!guess && !typed.trim()}
                loading={saving}
              />
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" disabled={saving} />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
