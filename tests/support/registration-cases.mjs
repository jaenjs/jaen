/**
 * The comparison that decides whether a registration is a dispatch.
 *
 * `packages/jaen/src/utils/registration.ts` is the whole of the storm fix:
 * `useField`'s `register` calls it and stays silent when it answers true, and
 * the `pages/field_register` reducer calls it as a second line. So the two
 * failures that matter are both here rather than in a browser. Answering true
 * where it should answer false loses a registration, an alignment tune above
 * all, and answering false where it should answer true brings the storm back.
 *
 * The source is imported as TypeScript, which node strips itself, so this
 * measures the file jaen ships and not a copy of it.
 *
 * Run: node tests/support/registration-cases.mjs
 * It prints one JSON document on stdout and exits non zero on a failure.
 */
import {sameRegistration} from '../../packages/jaen/src/utils/registration.ts'

const cases = [
  ['identical', {id: 'a', as: undefined}, {id: 'a', as: undefined}, true],
  [
    'the keys arrive in another order',
    {id: 'a', relatedName: 'r', as: 'span'},
    {as: 'span', relatedName: 'r', id: 'a'},
    true
  ],
  [
    'an undefined value counts as an absent key',
    {id: 'a'},
    {id: 'a', as: undefined},
    true
  ],
  ['a value changed', {id: 'a', as: 'span'}, {id: 'a', as: 'div'}, false],
  ['a key appeared', {id: 'a'}, {id: 'a', as: 'span'}, false],
  ['a key vanished', {id: 'a', as: 'span'}, {id: 'a'}, false],
  ['the store holds no registration yet', undefined, {id: 'a'}, false],
  ['both are empty', undefined, {}, true],
  [
    'the active tunes are the same',
    {id: 'a', activeTunes: [{name: 'left', groupName: 'alignment'}]},
    {id: 'a', activeTunes: [{name: 'left', groupName: 'alignment'}]},
    true
  ],
  [
    'an alignment tune was changed, which must still be written',
    {id: 'a', activeTunes: [{name: 'left', groupName: 'alignment'}]},
    {id: 'a', activeTunes: [{name: 'right', groupName: 'alignment'}]},
    false
  ],
  [
    'every tune was cleared',
    {id: 'a', activeTunes: [{name: 'left'}]},
    {id: 'a', activeTunes: undefined},
    false
  ]
]

const results = cases.map(([name, stored, incoming, expected]) => {
  const got = sameRegistration(stored, incoming)
  return {name, expected, got, ok: got === expected}
})

const failed = results.filter(result => !result.ok)

console.log(JSON.stringify({results, failed: failed.length}, null, 1))

if (failed.length > 0) {
  process.exitCode = 1
}
