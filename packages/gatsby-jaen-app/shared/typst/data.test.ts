/**
 * The unit check of buildOfferData, run in node against a fixture transfer:
 *
 *   cd app && npx esbuild shared/typst/data.test.ts --bundle --platform=node \
 *     --format=esm --outfile=/tmp/data.test.mjs && node /tmp/data.test.mjs
 *
 * Excluded from the typecheck by the tsconfig's `*.test.ts` rule, bundled
 * by esbuild with the two files the browser fetches from the template
 * bundle read off the disk instead. It asserts the contract key by key,
 * then writes the JSON to OUT (default the scratchpad) so the local typst
 * binary can compile it the way render.sh does.
 */
import assert from 'node:assert/strict'
import {readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {
  buildOfferData,
  offerTotal,
  recipientEmail,
  validUntilOf,
  type OfferLeg
} from './data'

const root = process.env.TYPST_ROOT ?? join(process.cwd(), 'shared', 'typst')
const files: Record<string, string> = {}
for (const path of [
  'templates/brands/limosen.json',
  'templates/brands/booklimo.json',
  'templates/lang/de.json',
  'templates/lang/en.json',
  'templates/lang/tr.json',
  'templates/lang/ar.json'
]) {
  files[path] = readFileSync(join(root, path), 'utf8')
}

const now = new Date('2026-09-06T10:00:00+02:00')

const origin: OfferLeg = {
  code: 'BQ7Q4W-1',
  customerId: '356384905472513654',
  pickupDateTime: '2026-09-18T12:30:00.000Z',
  pickup: 'Flughafen Wien (VIE)',
  dropoff: 'Hotel Sacher, Philharmoniker Straße 4, 1010 Wien',
  price: 78,
  passengers: [
    {
      firstName: 'Erika',
      lastName: 'Musterfrau',
      email: 'erika@example.com',
      phone: '+43 660 123 45 67',
      language: 'en-US'
    },
    {firstName: '', lastName: ''}
  ],
  details: {
    luggage: '2',
    childSeats: '1',
    preferredCarClass: 'BUSINESS_CLASS',
    flightNumber: 'OS 123'
  }
}

const back: OfferLeg = {
  ...origin,
  code: 'BQ7Q4W-2',
  pickupDateTime: '2026-09-21T07:00:00.000Z',
  pickup: origin.dropoff,
  dropoff: origin.pickup,
  price: null
}

const links = {
  confirm: 'https://limosen.at/angebot/abc',
  decline: 'https://limosen.at/angebot/abc/ablehnen'
}

// --------------- English, two legs, the website account booked ---------------

const en = buildOfferData(origin, 'limosen', 'en', {
  number: 'AN-260007',
  links,
  legs: [back],
  signer: 'Limosen Office',
  now,
  files
})

assert.equal(en.language, 'en')
assert.equal(en.sender.company, 'LIMOSEN KG', 'sender from the brand file')
assert.deepEqual(en.sender.contact, [
  'Tel.: +43 660 876 06 06',
  'E-Mail: office@limosen.at',
  'Web: limosen.at'
])
assert.deepEqual(en.sender.bank, [], 'no bank invented for limosen')
assert.equal(en.meta.id, 'AN-260007')
assert.equal(en.meta.title, 'Offer no. AN-260007')
assert.equal(en.meta.date, '06.09.2026')
assert.equal(en.meta.code, 'BQ7Q4W-1')
assert.equal(en.meta.reference, 'BQ7Q4W-1')
assert.equal(
  en.meta.servicePeriod,
  '18.09.2026 - 21.09.2026',
  'from the first pickup to the last'
)
assert.equal(en.meta.deliveryDate, '18.09.2026')
assert.equal(en.meta.customerId, origin.customerId)
assert.equal(en.meta.contactPerson, 'Limosen Office')
assert.equal(en.meta.validUntil, '17.09.2026', '24 hours before the pickup')
assert.deepEqual(
  en.recipient,
  ['Erika Musterfrau', 'erika@example.com', '+43 660 123 45 67'],
  'the passenger with the mail address'
)
assert.equal(en.intro.greeting, 'Dear Sir or Madam,')
assert.ok(en.intro.text.length > 10, 'intro from the language file')
assert.equal(en.items.length, 2, 'one item per leg')
assert.equal(en.items[0]?.title, 'Transfer BQ7Q4W-1')
assert.equal(en.items[1]?.title, 'Transfer BQ7Q4W-2')
assert.equal(en.items[0]?.qty, 1)
assert.equal(en.items[0]?.unitPrice, 78)
assert.equal(
  en.items[1]?.unitPrice,
  78,
  "a return leg without its own price takes the origin's"
)
assert.match(
  en.items[0]?.description ?? '',
  /Sep 18, 2026, 2:30 PM/,
  'the pickup in Vienna time, English'
)
assert.match(
  en.items[0]?.description ?? '',
  /Flughafen Wien \(VIE\) → Hotel Sacher/
)
assert.match(
  en.items[0]?.description ?? '',
  /Business Class, 2 persons, 2 pieces of luggage, 1 child seat, Flight OS 123/
)
assert.match(
  en.items[1]?.description ?? '',
  /Hotel Sacher.* → Flughafen Wien \(VIE\)/
)
assert.deepEqual(en.totals, {taxRate: 20, taxInclusive: true})
assert.equal(offerTotal(en), 156)
assert.ok(en.payment.terms.length > 10, 'terms from the language file')
assert.equal(en.payment.status, 'This offer is valid until 17.09.2026.')
assert.deepEqual(en.links, links)
assert.deepEqual(Object.keys(en).sort(), [
  'intro',
  'items',
  'language',
  'links',
  'meta',
  'payment',
  'recipient',
  'sender',
  'totals'
])

// --------------- German, the customer's profile names a person ---------------

const de = buildOfferData(origin, 'booklimo', 'de', {
  number: 'AN-260001',
  links,
  customer: {
    firstName: 'Hotel',
    lastName: 'Sacher Empfang',
    email: 'empfang@sacher.example',
    phone: '+43 1 514 56'
  },
  now,
  files
})
assert.equal(de.sender.company, 'KRC Limousinenservice KG')
assert.equal(de.sender.address[1], 'Margaretengürtel 42/3/16')
assert.deepEqual(
  de.recipient,
  ['Hotel Sacher Empfang', 'empfang@sacher.example', '+43 1 514 56'],
  'the profile wins when it names a person'
)
assert.equal(
  recipientEmail(
    {
      firstName: 'Hotel',
      lastName: 'Sacher Empfang',
      email: 'empfang@sacher.example'
    },
    origin.passengers[0]
  ),
  'empfang@sacher.example'
)
assert.equal(
  recipientEmail({email: 'nameless@example.com'}, origin.passengers[0]),
  'erika@example.com',
  'a nameless profile yields to the passenger'
)
assert.equal(de.meta.title, 'Angebot Nr. AN-260001')
assert.equal(de.intro.greeting, 'Sehr geehrte Damen und Herren,')
assert.equal(de.payment.status, 'Dieses Angebot ist gültig bis 17.09.2026.')
assert.equal(de.items.length, 1)
assert.match(de.items[0]?.description ?? '', /18\.09\.2026, 14:30/)
assert.match(
  de.items[0]?.description ?? '',
  /2 Personen, 2 Gepäckstücke, 1 Kindersitz, Flug OS 123/
)
assert.equal(de.meta.contactPerson, '', 'no signer, no name')

// --------------- Turkish and Arabic take their language files ---------------

const tr = buildOfferData(origin, 'limosen', 'tr', {
  number: 'AN-260002',
  links,
  now,
  files
})
assert.notEqual(tr.intro.greeting, de.intro.greeting)
assert.match(tr.items[0]?.description ?? '', /2 kişi/)
const ar = buildOfferData(origin, 'limosen', 'ar', {
  number: 'AN-260003',
  links,
  now,
  files
})
assert.match(ar.items[0]?.title ?? '', /BQ7Q4W-1/)
assert.match(ar.items[0]?.description ?? '', /أشخاص/)

// --------------- The validity rule ---------------

assert.equal(
  validUntilOf('2026-09-18T12:30:00.000Z', now).toISOString(),
  '2026-09-17T12:30:00.000Z'
)
assert.equal(
  validUntilOf('2026-09-06T20:00:00.000Z', now).toISOString(),
  '2026-09-06T09:00:00.000Z',
  'one hour from now when the pickup is closer than 24 h'
)
const soon = buildOfferData(
  {...origin, pickupDateTime: '2026-09-06T20:00:00.000Z'},
  'limosen',
  'de',
  {number: 'AN-260004', links, now, files}
)
assert.equal(soon.meta.validUntil, '06.09.2026')

// --------------- The pylon's validity wins when given ---------------

const given = buildOfferData(origin, 'limosen', 'de', {
  number: 'AN-260005',
  links,
  validUntil: '2026-09-10T22:00:00.000Z',
  now,
  files
})
assert.equal(
  given.meta.validUntil,
  '11.09.2026',
  "the instant in Vienna's calendar"
)

const out = process.env.OUT ?? '/tmp/offer-data-check.json'
writeFileSync(out, JSON.stringify(en, null, 2))
console.log(
  `data.test: ${[en, de, tr, ar, soon, given].length} documents built, every assertion held, English two-leg offer written to ${out}`
)
