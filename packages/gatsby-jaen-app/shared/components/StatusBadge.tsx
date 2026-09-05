/**
 * One badge per transfer state, coloured by what the state means to the
 * dispatcher: orange needs a decision, blue is waiting on somebody, teal and
 * purple are a ride in motion, green is done, red went wrong, gray is over.
 *
 * The label comes from i18nStates in the account's language. A value that is
 * not one of the twelve states is shown as it is, in gray, rather than mapped
 * to a wrong word: the legacy rows carry lowercase and the odd stray value.
 */
import {Badge, type BadgeProps} from '@chakra-ui/react'
import {useI18nCode} from '../i18n'
import {asTransferState, getI18nStates, type TransferState} from '../locales/i18nStates'

export const STATE_PALETTE: Record<TransferState, NonNullable<BadgeProps['colorPalette']>> = {
  PENDING: 'orange',
  ASSIGNED: 'blue',
  REJECTED: 'red',
  ABORTED: 'red',
  ON_THE_WAY: 'teal',
  AT_PICKUP: 'purple',
  NO_SHOW: 'red',
  FAILED: 'red',
  CANCELED: 'gray',
  TERMINATED: 'gray',
  ONGOING: 'teal',
  COMPLETED: 'green'
}

export interface StatusBadgeProps extends Omit<BadgeProps, 'children'> {
  /** The state as the backend spells it. Lowercase legacy values are accepted. */
  state: string | null | undefined
}

export function StatusBadge({state, ...rest}: StatusBadgeProps) {
  const code = useI18nCode()
  const {strings} = getI18nStates(code)
  const known = asTransferState(state)

  return (
    <Badge
      variant="subtle"
      colorPalette={known ? STATE_PALETTE[known] : 'gray'}
      whiteSpace="nowrap"
      {...rest}>
      {known ? strings[known] : state || '–'}
    </Badge>
  )
}

/** The label alone, for places that are not a badge: a select, a filter chip, a toast. */
export function useStateLabel(): (state: string | null | undefined) => string {
  const code = useI18nCode()
  const {strings} = getI18nStates(code)
  return state => {
    const known = asTransferState(state)
    return known ? strings[known] : state || ''
  }
}
