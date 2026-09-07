import React, {useCallback} from 'react'

import {TuneSelectorProps} from '../components/TuneSelectorButton'
import {useField} from '../hooks/use-field'
import {useFieldAuthor} from '../hooks/use-field-author'
import {JaenAuthor} from '../redux/apply-change'
import {IJaenConnection} from '../types'

export interface JaenFieldProps {
  id?: string
  name: string
  style?: React.CSSProperties
  className?: string
  relatedName?: string
  idStrategy?: 'auto' | 'value'
  tunes?: TuneSelectorProps['tunes']
  isDisabled?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface FieldOptions<_IValue, _IProps = {}> {
  fieldType: string
}
/**
 * @function connectField - Connects a field to Jaen.
 *
 * @param Component The component to wrap
 *
 * @example
 * ```
 * const T = connectField<string>(props => {
 *   const {name, style, className} = props.jaenField
 *   return null
 * })
 * ```
 */

/**
 * What connectField hands back.
 *
 * Naming it matters: without it the return type is inferred, and a consumer
 * that re-exports a connected field cannot write its own declaration without
 * pointing at a path inside jaen's dist. Under classic node resolution
 * TypeScript let that slide; under "bundler" it reports TS2742 and the package
 * stops building. Every field in every consuming package goes through here.
 */
export type ConnectedField<P = {}> = React.NamedExoticComponent<
  P & JaenFieldProps
>

export const connectField = <IValue, P = {}>(
  Component: React.ComponentType<
    React.PropsWithChildren<
      P & {
        jaenField: JaenFieldProps & {
          staticValue?: IValue
          value?: IValue
          isEditing: boolean
          onUpdateValue: (value: IValue | undefined) => void
          register: (props: Record<string, any>) => void

          tunes: TuneSelectorProps['tunes']
          activeTunes: TuneSelectorProps['activeTunes']
          tune: TuneSelectorProps['onTune']

          /**
           * Who last wrote this field and when, out of the shared draft. It is
           * undefined on a site without the agent and on a field nobody has
           * written since the head patch was made.
           */
          lastAuthor?: JaenAuthor
        }
      }
    >
  >,
  options: FieldOptions<IValue, P>
): ConnectedField<P> => {
  const MyComp: IJaenConnection<P & JaenFieldProps, typeof options> = ({
    id,
    name,
    idStrategy = 'auto',
    relatedName,
    tunes,
    isDisabled,
    ...rest
  }) => {
    const field = useField<IValue>(name, options.fieldType)

    const lastAuthor = useFieldAuthor({
      pageId: field.jaenPageId,
      section: field.SectionBlockContext
        ? {
            path: field.SectionBlockContext.path,
            id: field.SectionBlockContext.id
          }
        : undefined,
      fieldType: options.fieldType,
      fieldName: name
    })

    if (!id) {
      if (idStrategy === 'auto') {
        id = name

        if (field.SectionBlockContext) {
          const {path, position} = field.SectionBlockContext

          // Generate a fully qualified name (fqn) by mapping the path array and joining field names with section IDs (if present) using hyphens
          const fqn = path
            .map(p =>
              p.sectionId ? `${p.fieldName}-${p.sectionId}` : p.fieldName
            )
            .join('-')

          // Construct the final id by combining fqn, name, and position using hyphens
          id = `${fqn}-${position}-${name}`
        }
      } else if (idStrategy === 'value') {
        // Strip all HTML and all non-alphanumeric characters from the value and use it as the id
        // Also make sure that spaces are replaced with hyphens

        const value = field.value || field.staticValue

        if (value && typeof value === 'string') {
          id = `${value
            .replace(/(<([^>]+)>)/gi, '')
            .replace(/[^a-zA-Z0-9 ]/g, '')
            .replace(/\s+/g, '-')
            .toLowerCase()}`
        }
      }

      if (!id) {
        // fallback to name
        id = name
      }
    }

    // useEffect(() => {
    //   // skip initial render

    //   if (!field.isEditing) return

    //   field.register({id, relatedName})
    // }, [id, relatedName, field.isEditing])

    const register = useCallback(
      (newProps: Record<string, any>) => {
        field.register({
          id,
          relatedName,
          ...field.props,
          ...newProps
        })
      },
      [id, relatedName, field.props]
    )

    const tune: TuneSelectorProps['onTune'] = useCallback(
      info => {
        let activeTunes =
          (field.props?.activeTunes as TuneSelectorProps['activeTunes']) || []

        activeTunes = activeTunes.filter(
          activeTune =>
            activeTune.name !== info.name &&
            activeTune.groupName !== info.groupName
        )

        if (!info.isActive) {
          activeTunes.push({
            name: info.name,
            groupName: info.groupName
          })
        }

        register({
          activeTunes: activeTunes.length > 0 ? activeTunes : undefined
        })
      },
      [field.props?.activeTunes, register]
    )

    return (
      <Component
        jaenField={{
          id,
          idStrategy,
          name,
          staticValue: field.staticValue,
          value: field.value,
          isEditing: field.isEditing && !isDisabled,
          onUpdateValue: field.write,
          register,
          tune,
          style: rest.style,
          className: rest.className,
          relatedName,
          tunes: tunes || [],
          activeTunes: field.props?.activeTunes,
          isDisabled,
          lastAuthor
        }}
        {...(rest as P)}
      />
    )
  }

  MyComp.options = options

  return React.memo(MyComp)
}

export type IFieldConnection = ReturnType<typeof connectField>
