/**
 * Every message the CMS frame's discard control formats, in every locale.
 *
 * `gatsby-plugin-jaen` carries one catalogue file with seven locales in it, and
 * a message is not code: a plural clause that is malformed in a language nobody
 * in the room reads is not a compile error, it is `IntlMessageFormat` throwing
 * inside a render, in a browser, in the middle of the one control that undoes
 * other people's work. So the catalogue is asked rather than eyeballed: each
 * message is parsed and formatted in its own locale with the very library
 * react-intl uses.
 *
 * `node tests/support/validate-frame-messages.mjs` from the repository root.
 * It prints how many it checked and exits non-zero on the first one that will
 * not parse or formats to nothing.
 *
 * The seven locales are in the order `getI18nJaen` declares them, which is the
 * order their blocks appear in the file, so the nth occurrence of a key belongs
 * to the nth locale.
 */
import {IntlMessageFormat} from 'intl-messageformat'
import {readFileSync} from 'node:fs'

const catalogue =
  process.env.JAEN_FRAME_CATALOGUE ||
  'packages/gatsby-plugin-jaen/src/locales/i18nJaen.ts'

const src = readFileSync(catalogue, 'utf8')
const locales = ['de-AT', 'tr-TR', 'ar-EG', 'sl-SI', 'it-IT', 'ja-JP', 'en-US']
const keys = [
  'CmsFrameDiscardAll',
  'CmsFrameDiscardAllTitle',
  'CmsFrameDiscardAllConfirm',
  'CmsFrameDiscardAllConfirmWho',
  'CmsFrameDiscardAllConfirmWhen',
  'CmsFrameDiscardAllConfirmText',
  'CmsFrameDiscardAllCancelText',
  'CmsFrameDiscardNothing',
  'CmsFrameDiscardedTitle',
  'CmsFrameDiscardedDescription',
  'CmsFrameDiscardedByAnAdmin'
]

/** What the frame passes. A missing argument formats to the literal name. */
const values = {
  fields: 3,
  pages: 2,
  who: ' (who)',
  when: ' (when)',
  editors: 'Ann, Bo',
  since: '14:02',
  at: '15:10'
}

let checked = 0

for (const key of keys) {
  // Prettier puts a long value on its own line, so both shapes count.
  const found = [
    ...src.matchAll(new RegExp(`^\\s*${key}:\\s*\\n?\\s*'(.*)',$`, 'gm'))
  ].map(match => match[1])

  if (found.length !== locales.length) {
    console.error(
      `${key}: ${found.length} of ${locales.length} locales carry it`
    )
    process.exit(1)
  }

  found.forEach((message, index) => {
    const locale = locales[index]

    try {
      const formatted = new IntlMessageFormat(message, locale).format(values)

      if (!formatted) throw new Error('formatted to nothing')

      checked += 1
    } catch (error) {
      console.error(`${locale} ${key}: ${error.message}`)
      process.exit(1)
    }
  })
}

console.log(`${checked} messages parse and format in their own locale`)
