import {JaenPage} from 'utils/types'

import {useAppDispatch, useAppSelector} from '../../store'
import {field_write, JaenPageState} from '../../store/slices/pagesSlice'
import {withRedux} from '../../store/withRedux'
import {useJaenPageContext} from '../providers/JaenPageProvider'
import {useJaenSectionContext} from '../providers/JaenSectionProvider'

export interface JaenFieldProps<T> {
  name: string
  defaultValue: T
  style?: React.CSSProperties
  styleClassName?: string
}

export interface FieldConnection<T> {
  jaenField: JaenFieldProps<T> & {
    staticValue?: T
    value?: T
    isEditing: boolean
    onUpdateValue: (value: T) => void
  }
}

/**
 * @function connectField - Connects a field to Jaen.
 *
 * @param Component The component to wrap
 *
 * @example
 * ```
 * const T = connectField<string>(props => {
 *   const {name, defaultValue, style, styleClassName} = props.jaenField
 *   return null
 * })
 * ```
 */
export const connectField = <T, P>(
  Component: React.ComponentType<P & FieldConnection<T>>,
  options: {
    fieldType: string
  }
): React.FC<P & JaenFieldProps<T>> =>
  withRedux(props => {
    const dispatch = useAppDispatch()
    const {staticJaenPage} = useJaenPageContext()

    if (!staticJaenPage) {
      throw new Error('connectField must be used within a JaenPage')
    }

    const sectionContext = useJaenSectionContext()

    function getPageField<T>(page: JaenPage | JaenPageState): T | undefined {
      let fields

      if (!sectionContext) {
        fields = page.jaenFields
      } else {
        const {chapterName, sectionId} = sectionContext

        fields = page.chapters?.[chapterName]?.sections[sectionId]?.jaenFields
      }

      return fields?.[options.fieldType]?.[props.name] as T
    }

    const value = useAppSelector<T | undefined>(state => {
      const page = state.pages[staticJaenPage.id]

      if (page) {
        return getPageField(page)
      }
    })

    const staticValue = getPageField<T>(staticJaenPage)

    const isEditing = true

    const handleUpdateValue = (value: T) => {
      dispatch(
        field_write({
          pageId: staticJaenPage.id,
          section: sectionContext,
          fieldType: options.fieldType,
          fieldName: props.name,
          value
        })
      )
    }

    return (
      <Component
        jaenField={{
          name: props.name,
          defaultValue: props.defaultValue,
          staticValue: staticValue,
          value: value,
          isEditing: isEditing,
          onUpdateValue: handleUpdateValue,
          style: props.style,
          styleClassName: props.styleClassName
        }}
        {...props}
      />
    )
  })
