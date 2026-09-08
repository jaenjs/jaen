/**
 * Whether a field's registration would write anything new.
 *
 * A field registers itself with the store so the CMS knows it is on the page
 * and how it is rendered: its id, its `relatedName`, the tag it paints as, the
 * tunes that are active on it. None of that is a person's edit and none of it
 * ever reaches the outbox or the agent (see `redux/remote-state.ts`, which
 * records `pages/field_write` and never `pages/field_register`), so a
 * registration that says exactly what the store already says is a dispatch
 * with no consequence at all.
 *
 * It had a very large consequence anyway. Measured on booklimo.at on
 * 2026-09-08, two fields re-registered about twenty-nine times a second each
 * because the site remounted the subtree they live in, and each of those
 * dispatches woke every connected field, every store subscriber and the
 * persister. See `docs/architecture/editing-performance.md`, "The storm at its
 * root".
 *
 * The comparison is by key set and by value, so the order the keys were
 * spread in does not matter: `connectField` builds the payload as
 * `{id, relatedName, ...field.props, ...newProps}` and the same registration
 * can therefore arrive with its keys in a different order than the store holds
 * them. A key whose value is `undefined` counts as absent, because that is
 * what `JSON.stringify` does to it on the way into `localStorage` and what the
 * agent's snapshot does to it on the way back.
 *
 * Objects and arrays are compared by their JSON, which is right for what a
 * registration actually carries (`activeTunes` is a short array of small
 * objects). A function or a class compares by identity, which is deliberate:
 * a caller that hands a new one on every render is asking to be registered
 * again, and nothing in jaen does that.
 */
export const sameRegistration = (
  a: Record<string, any> | undefined,
  b: Record<string, any> | undefined
): boolean => {
  const left = a || {}
  const right = b || {}

  const keys = new Set([...Object.keys(left), ...Object.keys(right)])

  for (const key of keys) {
    const leftValue = left[key]
    const rightValue = right[key]

    if (Object.is(leftValue, rightValue)) {
      continue
    }

    if (leftValue === undefined || rightValue === undefined) {
      return false
    }

    if (
      typeof leftValue === 'object' &&
      typeof rightValue === 'object' &&
      JSON.stringify(leftValue) === JSON.stringify(rightValue)
    ) {
      continue
    }

    return false
  }

  return true
}
