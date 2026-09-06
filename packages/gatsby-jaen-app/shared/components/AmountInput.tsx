/**
 * A text field for an amount of money.
 *
 * Not a number field. On a phone with a German keyboard the decimal key is a
 * comma, and `<input type="number">` treats `12,5` as invalid and shows
 * nothing while the dispatcher types (dispatch.md, "The price field"). This
 * one is `type="text"` with `inputMode="decimal"`, so the phone still offers
 * the numeric keyboard and the field keeps whatever was typed on the screen.
 *
 * A comma and a dot both mean the decimal point. When the field loses focus
 * the amount is shown the way the account's language writes money, `12,50 €`,
 * and when it gains focus again it goes back to the bare number so it can be
 * edited. `parseAmount` reads either form back into a number with two
 * decimals, and that is what a screen sends to the backend.
 *
 * The text colour is `fg` and the surface `bg` in both modes, spelled out,
 * because the dark palette made the field's surface charcoal and an
 * unspecified text colour vanished into it.
 */
import {Input, type InputProps} from '@chakra-ui/react'
import {useI18nCode, type I18nCode} from '../i18n'

export interface AmountInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type' | 'inputMode'> {
  /** What the field shows, as typed or as formatted on blur. */
  value: string
  onChange: (text: string) => void
  /** ISO 4217, EUR unless a screen says otherwise. */
  currency?: string
}

/** Arabic-Indic and Persian digits, the way an ar-EG keyboard or formatter writes them. */
const DIGITS: Record<string, string> = {}
for (let i = 0; i < 10; i++) {
  DIGITS[String.fromCharCode(0x0660 + i)] = String(i)
  DIGITS[String.fromCharCode(0x06f0 + i)] = String(i)
}

/**
 * The number in the text, rounded to two decimals, or null when there is
 * none. A comma, a dot and the Arabic decimal separator all count as the
 * decimal point. When two different separators appear, `1.234,50` or
 * `1,234.50`, the last one is the decimal point and the other one groups
 * thousands. Currency signs, spaces and letters are ignored.
 */
export function parseAmount(text: string): number | null {
  let s = ''
  for (const ch of text) s += DIGITS[ch] ?? ch
  s = s.replace(/٫/g, ',').replace(/٬/g, '.').replace(/[^0-9.,-]/g, '')
  if (!s) return null
  const negative = s.startsWith('-')
  s = s.replace(/-/g, '')
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = Math.max(lastComma, lastDot)
    s = s.slice(0, decimal).replace(/[.,]/g, '') + '.' + s.slice(decimal + 1).replace(/[.,]/g, '')
  } else {
    // One kind of separator only. More than one of it groups thousands, a
    // single one is the decimal point, so `12,5` is twelve and a half.
    const sep = lastComma >= 0 ? ',' : '.'
    const parts = s.split(sep)
    s = parts.length > 2 ? parts.join('') : parts.join('.')
  }
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return Math.round((negative ? -n : n) * 100) / 100
}

/** `12,50 €` in the account's language, or the bare two decimals when Intl cannot. */
export function formatAmount(code: I18nCode, n: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat(code, {style: 'currency', currency}).format(n)
  } catch {
    // An unknown currency code throws. The number with the code is still an
    // amount a person can read, which beats an empty field.
    return `${n.toFixed(2)} ${currency}`
  }
}

/** `12,50` or `12.50`, the number alone with the language's decimal point, for editing. */
export function editableAmount(code: I18nCode, n: number): string {
  try {
    return new Intl.NumberFormat(code, {minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false}).format(n)
  } catch {
    return n.toFixed(2)
  }
}

export function AmountInput({value, onChange, currency = 'EUR', onBlur, onFocus, ...rest}: AmountInputProps) {
  const code = useI18nCode()
  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      color="fg"
      bg="bg"
      fontVariantNumeric="tabular-nums"
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={e => {
        const n = parseAmount(value)
        if (n !== null) onChange(editableAmount(code, n))
        onFocus?.(e)
      }}
      onBlur={e => {
        const n = parseAmount(value)
        if (n !== null) onChange(formatAmount(code, n, currency))
        onBlur?.(e)
      }}
      {...rest}
    />
  )
}
