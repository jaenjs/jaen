import React, {useContext, useMemo, useRef, useState} from 'react'

import {
  SectionBlockContextType,
  useSectionBlockContext
} from '../contexts/block'
import {usePageContext} from '../contexts/page'
import {RootState, store} from '../redux'
import {actions} from '../redux/slices/page'
import {JaenPage} from '../types'
import {findSection} from '../utils/page/section'
import {sameRegistration} from '../utils/registration'
import {useContentManagement} from './use-content-management'
import {EditingContext} from '../contexts/editing'

/**
 * What a field with no props of its own is handed back.
 *
 * Frozen and module level so its identity never changes. `props` is a
 * dependency of `connectField`'s register callback and of `write` below, and
 * an object literal built during render made both of them new on every render
 * for every field that carries no props, which is most of them.
 */
const NO_PROPS: Record<string, any> = Object.freeze({})

type FieldValue<IValue> = {
  value?: IValue
  props?: Record<string, any>
  position?: number
}

export function useField<IValue>(
  name: string,
  type: string,
  options?: {
    block?: {
      path: SectionBlockContextType['path']
      id: SectionBlockContextType['id']
    }
    isPageField?: boolean
  }
) {
  const {jaenPage} = usePageContext()

  if (!jaenPage.id) {
    throw new Error(
      'JaenPage id is undefined! connectField must be used within a JaenPage'
    )
  }

  const SectionBlockContext = useSectionBlockContext()

  function getPageField(page: JaenPage | Partial<JaenPage> | null):
    | {
        value: IValue
        props?: Record<string, any>
        position?: number
      }
    | undefined {
    if (page) {
      let fields

      const path = options?.block?.path || SectionBlockContext?.path
      const blockId = options?.block?.id || SectionBlockContext?.id

      if (path && !options?.isPageField) {
        fields = findSection(page.sections || [], path)?.items.find(
          ({id}) => id === blockId
        )?.jaenFields
      } else {
        fields = page.jaenFields
      }

      return fields?.[type]?.[name]
    }

    return undefined
  }

  const getField = (): ReturnType<typeof getPageField> => {
    const state = store.getState() as RootState

    const page = state.page.pages.nodes[jaenPage.id]

    if (page) {
      return getPageField(page)
    }

    return undefined
  }

  const getStaticField = () => {
    const page = jaenPage

    if (page) {
      return getPageField(page)
    }

    return undefined
  }

  /**
   * The current reader, held where an effect can reach it without depending on
   * its identity.
   *
   * `getField` closes over this render's context values, so it is a new
   * function every render. Both effects below used to carry it, or something
   * built out of it, in their dependency lists: the first therefore ran after
   * every render and set state, and the second tore down and rebuilt its store
   * subscription every time the field changed. That is the render loop
   * `docs/architecture/editing-performance.md` named as the engine of the
   * storm, and the ref is what takes it out of the dependency lists without
   * changing what is read.
   *
   * Assigned during render on purpose. The effects run after the commit of the
   * render that assigned it, so the reader they call is never older than the
   * render they belong to.
   */
  const readFieldRef = useRef(getField)
  readFieldRef.current = getField

  /**
   * The one field this hook is about, as a value rather than as an identity.
   *
   * `SectionBlockContext` is a fresh object on every render of its provider,
   * so a dependency list that carries it is unstable for every field inside a
   * section. What actually decides which field is being read is the page, the
   * type, the name and the section's path and id, and those are strings.
   */
  const fieldKey = [
    jaenPage.id,
    type,
    name,
    options?.isPageField ? 'page' : '',
    JSON.stringify(options?.block?.path ?? SectionBlockContext?.path ?? null),
    String(options?.block?.id ?? SectionBlockContext?.id ?? '')
  ].join('|')

  /**
   * The section a write and a registration name, content stable.
   *
   * `write` and `register` have always taken this from `SectionBlockContext`
   * alone and never from `options.block`, and that is kept exactly as it was:
   * this only stops the object's identity from changing when nothing about it
   * has.
   */
  const sectionKey = SectionBlockContext
    ? JSON.stringify([SectionBlockContext.path, SectionBlockContext.id])
    : ''

  const section = useMemo(
    () =>
      SectionBlockContext
        ? {
            path: SectionBlockContext.path,
            id: SectionBlockContext.id
          }
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sectionKey]
  )

  const [field, setField] = useState<FieldValue<IValue> | undefined>(getField)

  /**
   * The field this hook points at changed, so read the new one.
   *
   * It used to be `setField(getField)` with `getField` in the dependency list,
   * which ran after every render. `setField` was handed the reader itself,
   * React called it as an updater, and the state was replaced with whatever
   * came back whether or not it said anything new.
   */
  React.useEffect(() => {
    const next = readFieldRef.current()

    setField(current =>
      current === next || JSON.stringify(current) === JSON.stringify(next)
        ? current
        : next
    )
  }, [fieldKey])

  /**
   * The store answering that this field changed.
   *
   * The subscription is made once per field rather than once per change: its
   * dependency list used to carry `field`, which is the object it produces, so
   * every change unsubscribed and resubscribed.
   *
   * The identity test in front of the serialisation is what makes a dispatch
   * cheap for the fields it does not touch. The store is immer's, so a field
   * nothing wrote comes back as the very same object, and the old code
   * serialised both the new field and the old one on every dispatch for every
   * field on the page: forty-one fields on booklimo.at's home page, twice
   * each, per dispatch.
   */
  React.useEffect(() => {
    let last = readFieldRef.current()
    let lastSerialised = JSON.stringify(last)

    const unsubscribe = store.subscribe(() => {
      const next = readFieldRef.current()

      if (next === last) {
        return
      }

      const serialised = JSON.stringify(next)

      last = next

      if (serialised === lastSerialised) {
        return
      }

      lastSerialised = serialised

      setField(next)
    })

    return () => {
      unsubscribe()
    }
  }, [fieldKey])

  const staticField = getStaticField()

  const editingContext = useContext(EditingContext)
  const contentManagement = useContentManagement()

  const isEditing = editingContext
    ? editingContext.isEditing
    : contentManagement.isEditing

  const props = useMemo(() => {
    return field?.props || staticField?.props || NO_PROPS
  }, [field, staticField])

  const write = React.useCallback(
    (newValue: IValue | undefined) => {
      store.dispatch(
        actions.field_write({
          pageId: jaenPage.id,
          section,
          fieldType: type,
          fieldName: name,
          value: newValue,
          props
        })
      )
    },
    [jaenPage.id, section, type, name, props]
  )

  /**
   * The field says it is on the page, and what it looks like.
   *
   * **It dispatches only when the store would change.** A registration carries
   * no value and is never recorded as a change, so one that says exactly what
   * the store already says has no consequence except its cost, and its cost is
   * the whole storm: measured on booklimo.at on 2026-09-08, fifty-five
   * dispatches a second with edit mode on and nobody typing, every one of them
   * a `pages/field_register` from two fields whose subtree the site remounts,
   * each waking every connected field, every store subscriber and the
   * persister.
   *
   * The guard is here rather than in the reducer because a dispatch that
   * changes no state still runs every subscriber, still marks the persister
   * dirty and still costs a store notification. Damping it further down would
   * have left all of that. The reducer carries the same test as a second
   * line, for any caller that is not this hook.
   *
   * Not guarded: a field the store has never seen, which is `current`
   * undefined and always dispatches, and a registration that says anything new,
   * a tune above all.
   */
  const register = React.useCallback(
    (registerProps: object) => {
      const current = readFieldRef.current()

      if (current && sameRegistration(current.props, registerProps)) {
        return
      }

      store.dispatch(
        actions.field_register({
          pageId: jaenPage.id,
          fieldType: type,
          fieldName: name,
          section,
          props: registerProps
        })
      )
    },
    [jaenPage.id, section, type, name]
  )

  return {
    value: field?.value,
    staticValue: staticField?.value,
    props,
    jaenPageId: jaenPage.id,
    isEditing,
    SectionBlockContext,
    write,
    register
  }
}
