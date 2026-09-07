/**
 * An amount in euro, in the account's language.
 *
 * Renders nothing for null or undefined. That is the whole driver rule on the
 * screen side: the backend resolves price, payingParty and paymentMethode to
 * null for a driver caller, and this component simply has nothing to show.
 * No screen needs to know who is looking to decide whether to print a fare.
 */
import {Text, type TextProps} from '@chakra-ui/react'
import {useI18nCode} from '../i18n'

export interface MoneyTextProps extends Omit<TextProps, 'children'> {
  value: number | string | null | undefined
  /** ISO 4217, EUR unless a screen says otherwise. */
  currency?: string
}

/** The formatter alone, for table cells and toasts that are not a Text. */
export function useMoneyFormat(
  currency = 'EUR'
): (value: number | string | null | undefined) => string | null {
  const code = useI18nCode()
  return value => {
    const n = typeof value === 'string' ? Number(value) : value
    if (n === null || n === undefined || Number.isNaN(n)) return null
    try {
      return new Intl.NumberFormat(code, {style: 'currency', currency}).format(
        n
      )
    } catch {
      // An unknown currency code throws. Two decimals and the code is still a
      // readable amount, which beats a blank cell on an invoice screen.
      return `${n.toFixed(2)} ${currency}`
    }
  }
}

export function MoneyText({value, currency = 'EUR', ...rest}: MoneyTextProps) {
  const format = useMoneyFormat(currency)
  const text = format(value)
  if (text === null) return null
  // A price is data, so it stays selectable inside an app whose chrome is not
  // (design-consistency.md, rule 11, and Selectable.tsx).
  return (
    <Text
      as="span"
      data-selectable
      fontVariantNumeric="tabular-nums"
      whiteSpace="nowrap"
      {...rest}>
      {text}
    </Text>
  )
}
