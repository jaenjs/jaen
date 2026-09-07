/**
 * Who last wrote a field, and when.
 *
 * The shared draft makes this a question worth asking: a field's value can
 * change because somebody else changed it, and the CMS says so rather than
 * letting the new text appear out of nowhere. The answer comes from
 * `remote.authors`, which the agent keeps in the head patch beside the data
 * and hands back with every `draft` and every `save`.
 *
 * The store is read the way `use-field` reads it, by subscription rather than
 * through `useSelector`, because a jaen field renders wherever a page puts it
 * and not necessarily inside the react-redux provider.
 */
import React from 'react'

import {RootState, store} from '../redux'
import {changeKey, JaenAuthor} from '../redux/apply-change'
import type {SectionBlockContextType} from '../contexts/block'

export interface FieldIdentity {
  pageId?: string
  section?: {
    path: SectionBlockContextType['path']
    id?: SectionBlockContextType['id']
  }
  fieldType: string
  fieldName: string
}

export const fieldAuthorKey = (field: FieldIdentity): string =>
  changeKey({
    kind: 'fieldWrite',
    pageId: field.pageId,
    section: field.section
      ? {path: field.section.path, id: field.section.id}
      : undefined,
    fieldType: field.fieldType,
    fieldName: field.fieldName,
    at: ''
  })

export const useFieldAuthor = (
  field: FieldIdentity
): JaenAuthor | undefined => {
  const key = React.useMemo(
    () => fieldAuthorKey(field),
    [
      field.pageId,
      field.fieldType,
      field.fieldName,
      // The path is an array and would be a new reference on every render.
      JSON.stringify(field.section?.path),
      field.section?.id
    ]
  )

  const read = React.useCallback((): JaenAuthor | undefined => {
    const state = store.getState() as RootState

    return state.remote?.authors?.[key]
  }, [key])

  const [author, setAuthor] = React.useState<JaenAuthor | undefined>(read)

  React.useEffect(() => {
    setAuthor(read())

    return store.subscribe(() => {
      setAuthor(previous => {
        const next = read()

        // The subscription fires on every action, and the author of one field
        // changes about as often as somebody edits it, so the identity check
        // is what keeps this from re-rendering the whole page.
        if (previous?.sub === next?.sub && previous?.at === next?.at) {
          return previous
        }

        return next
      })
    })
  }, [read])

  return author
}
