// shared/phone.ts
//
// Every phone number the platform stores carries its country, E.164 and
// nothing else (okf/architecture/dispatch.md section 13). This module is the
// one place that reads what a person typed and the one place that writes it
// back out for a person to read: the transfer form here, the booking forms of
// both sites (they import it as gatsby-jaen-app/shared/phone), the detail, the
// board and the papers. Its twin lives in the pylon at src/phone.ts,
// identical apart from this header, because a Worker cannot import from a
// Gatsby plugin and the two halves must still agree on what a number is.

/**
 * The country a number is read in when it carries no country code of its
 * own. dispatch.md section 13: the booking's language decides, de and en
 * are Austria, tr is Turkey, ar is the Emirates, and a number that names
 * its own country overrides all of it.
 */
export type CountryCode =
  | 'AT'
  | 'DE'
  | 'CH'
  | 'TR'
  | 'AE'
  | 'GB'
  | 'US'
  | 'IT'
  | 'SA'

/** The calling code of every country this platform can default to. */
export const CALLING_CODE: Readonly<Record<CountryCode, string>> = {
  AT: '43',
  DE: '49',
  CH: '41',
  TR: '90',
  AE: '971',
  GB: '44',
  US: '1',
  IT: '39',
  SA: '966'
}

/**
 * The E.164 calling codes, longest first, so a number is split into its
 * country and the rest without guessing. Only the split needs them, not the
 * validation: a code that is not in the list leaves the number stored as it
 * was typed and formatted in one group, which is right for a country this
 * table does not know yet rather than a reason to refuse a booking.
 */
const CALLING_CODES: readonly string[] = [
  '1',
  '7',
  '20',
  '27',
  '30',
  '31',
  '32',
  '33',
  '34',
  '36',
  '39',
  '40',
  '41',
  '43',
  '44',
  '45',
  '46',
  '47',
  '48',
  '49',
  '51',
  '52',
  '53',
  '54',
  '55',
  '56',
  '57',
  '58',
  '60',
  '61',
  '62',
  '63',
  '64',
  '65',
  '66',
  '81',
  '82',
  '84',
  '86',
  '90',
  '91',
  '92',
  '93',
  '94',
  '95',
  '98',
  '211',
  '212',
  '213',
  '216',
  '218',
  '220',
  '221',
  '222',
  '223',
  '224',
  '225',
  '226',
  '227',
  '228',
  '229',
  '230',
  '231',
  '232',
  '233',
  '234',
  '235',
  '236',
  '237',
  '238',
  '239',
  '240',
  '241',
  '242',
  '243',
  '244',
  '245',
  '246',
  '248',
  '249',
  '250',
  '251',
  '252',
  '253',
  '254',
  '255',
  '256',
  '257',
  '258',
  '260',
  '261',
  '262',
  '263',
  '264',
  '265',
  '266',
  '267',
  '268',
  '269',
  '290',
  '291',
  '297',
  '298',
  '299',
  '350',
  '351',
  '352',
  '353',
  '354',
  '355',
  '356',
  '357',
  '358',
  '359',
  '370',
  '371',
  '372',
  '373',
  '374',
  '375',
  '376',
  '377',
  '378',
  '379',
  '380',
  '381',
  '382',
  '383',
  '385',
  '386',
  '387',
  '389',
  '420',
  '421',
  '423',
  '500',
  '501',
  '502',
  '503',
  '504',
  '505',
  '506',
  '507',
  '508',
  '509',
  '590',
  '591',
  '592',
  '593',
  '594',
  '595',
  '596',
  '597',
  '598',
  '599',
  '670',
  '672',
  '673',
  '674',
  '675',
  '676',
  '677',
  '678',
  '679',
  '680',
  '681',
  '682',
  '683',
  '685',
  '686',
  '687',
  '688',
  '689',
  '690',
  '691',
  '692',
  '850',
  '852',
  '853',
  '855',
  '856',
  '870',
  '880',
  '886',
  '960',
  '961',
  '962',
  '963',
  '964',
  '965',
  '966',
  '967',
  '968',
  '970',
  '971',
  '972',
  '973',
  '974',
  '975',
  '976',
  '977',
  '992',
  '993',
  '994',
  '995',
  '996',
  '998'
]

/** Longest match wins: 1 before 1, 43 before 4, 971 before 97. */
const CODES_LONGEST_FIRST: readonly string[] = [...CALLING_CODES].sort(
  (a, b) => b.length - a.length
)

/**
 * The shortest and the longest a number may be. E.164 caps the whole thing
 * at fifteen digits; below eight there is no country plus a subscriber, and
 * an office typing an internal extension into the passenger's field is the
 * case the lower bound catches.
 */
const MIN_DIGITS = 8
const MAX_DIGITS = 15

/** The country a booking's language books in, dispatch.md section 13. */
export function countryForLanguage(language?: string | null): CountryCode {
  const tag = String(language ?? '')
    .trim()
    .toLowerCase()
  const primary = tag.split(/[-_]/)[0]
  switch (primary) {
    case 'tr':
      return 'TR'
    case 'ar':
      return 'AE'
    case 'de':
    case 'en':
    default:
      return 'AT'
  }
}

export type PhoneRefusal =
  | 'empty'
  | 'letters'
  | 'too-short'
  | 'too-long'
  | 'no-country'

export interface ParsedPhone {
  /** The number in E.164, `+436608760606`, when it could be read. */
  e164?: string
  /** Why it could not be read. Undefined on success. */
  refusal?: PhoneRefusal
}

/**
 * A number as the platform stores it. Everything a person types is accepted
 * as separators (spaces, dots, slashes, hyphens, brackets); anything else,
 * a letter above all, is refused rather than silently dropped, because
 * `+43 660 ABC` with the letters removed is a different number.
 *
 * Three shapes reach this function and all three leave it as E.164:
 *
 *   `+43 660 876 06 06`  already international, kept
 *   `0043 660 876 06 06` the international prefix, read as `+`
 *   `0660 876 06 06`     national with the trunk zero, the default country's
 *                        code put in front of it
 *   `660 876 06 06`      national without it, the same
 *
 * The trunk zero is dropped for every country this table knows, which is
 * true for all of them (Italy keeps its leading zero and is therefore not a
 * default country here; an Italian number reaches the platform with its
 * `+39` and is kept whole).
 */
export function parsePhone(
  input: string | null | undefined,
  defaultCountry: CountryCode = 'AT'
): ParsedPhone {
  // A country code written in brackets, `(+39) 06 1234567`, is how a good
  // share of the rows imported from the old platform spell theirs. The
  // brackets are unwrapped before anything else, because a `+` that is not
  // the first character is otherwise not a separator and the number reads as
  // one with letters in it.
  const raw = String(input ?? '')
    .trim()
    .replace(/^\(\s*(\+[\d\s]*\d)\s*\)/, '$1')
  if (!raw) return {refusal: 'empty'}

  // A leading + is the only symbol that carries meaning. Everything else that
  // is not a digit has to be a separator, or the number is not a number.
  // `(0)` is the one exception: a trunk prefix written in brackets after a
  // country code is never part of the number, and `+43 (0)660 8760606` is
  // how half the letterheads in this country spell theirs.
  const body = (raw.startsWith('+') ? raw.slice(1) : raw).replace(
    /\(\s*0\s*\)/g,
    ''
  )
  if (/[^\d\s()./\u2010-\u2015-]/.test(body)) return {refusal: 'letters'}

  let digits = body.replace(/\D/g, '')
  if (!digits) return {refusal: 'empty'}

  const international = raw.startsWith('+') || digits.startsWith('00')
  if (digits.startsWith('00')) digits = digits.slice(2)

  if (!international) {
    // National: the trunk zero goes, the country's code comes.
    const national = digits.startsWith('0') ? digits.replace(/^0+/, '') : digits
    if (!national) return {refusal: 'empty'}
    if (national.length < 4) return {refusal: 'too-short'}
    digits = `${CALLING_CODE[defaultCountry]}${national}`
  }

  if (digits.startsWith('0')) return {refusal: 'no-country'}
  if (digits.length < MIN_DIGITS) return {refusal: 'too-short'}
  if (digits.length > MAX_DIGITS) return {refusal: 'too-long'}

  return {e164: `+${digits}`}
}

/** The stored value, or null when the input cannot be read. */
export function toE164(
  input: string | null | undefined,
  defaultCountry: CountryCode = 'AT'
): string | null {
  return parsePhone(input, defaultCountry).e164 ?? null
}

/** Whether a stored value is already what section 13 asks for. */
export function isE164(value: string | null | undefined): boolean {
  return /^\+[1-9]\d{7,14}$/.test(String(value ?? '').trim())
}

/** The calling code at the front of an E.164 value, longest match first. */
export function callingCodeOf(e164: string): string | null {
  const digits = e164.replace(/\D/g, '')
  for (const code of CODES_LONGEST_FIRST) {
    if (digits.startsWith(code) && digits.length > code.length) return code
  }
  return null
}

/**
 * The number as a person reads it: the country code, then the rest in groups
 * of three from the left, the last group taking a stray single digit so no
 * group stands alone. `+436608760606` becomes `+43 660 876 0606`. The rule is
 * the same in every country rather than one grouping per country, which is a
 * metadata table this platform does not carry and would have to keep current.
 *
 * A value that is not E.164 (a row the normalisation could not decide, see
 * scripts/normalise-phones.py) is given back untouched, so the screen shows
 * what is stored and its "Landesvorwahl prüfen" warning beside it.
 */
export function formatPhone(value: string | null | undefined): string {
  const raw = String(value ?? '').trim()
  if (!isE164(raw)) return raw

  const code = callingCodeOf(raw)
  if (!code) return raw
  const national = raw.slice(1 + code.length)

  const groups: string[] = []
  for (let i = 0; i < national.length; i += 3)
    groups.push(national.slice(i, i + 3))
  // A stray single digit joins the group before it rather than standing on
  // its own: `+43 660 876 0606`, never `+43 660 876 060 6`.
  const tail = groups[groups.length - 1] ?? ''
  if (groups.length > 1 && tail.length === 1) {
    groups.pop()
    groups[groups.length - 1] = `${groups[groups.length - 1] ?? ''}${tail}`
  }

  return `+${code} ${groups.join(' ')}`
}

/**
 * A stored number that does not carry its country. The detail marks these
 * with "Landesvorwahl prüfen" rather than guessing, because a row the
 * normalisation left alone is one nobody could decide.
 */
export function needsCountryCode(value: string | null | undefined): boolean {
  const raw = String(value ?? '').trim()
  return Boolean(raw) && !isE164(raw)
}
