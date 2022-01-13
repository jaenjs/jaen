import {useJaenPageContext, useJaenSectionContext} from '@src/internal/page'
import {useAppDispatch, useAppSelector, withRedux} from '@src/internal/store'
import {field_write, JaenPageState} from '@src/internal/store/slices/pagesSlice'
import {JaenPage} from '@src/internal/types'

export interface JaenFieldProps<IDefaultValue> {
  name: string
  defaultValue: IDefaultValue
  style?: React.CSSProperties
  className?: string
}

export interface FieldConnection<IValue, IDefaultValue> {
  jaenField: JaenFieldProps<IDefaultValue> & {
    staticValue?: IValue
    value?: IValue
    isEditing: boolean
    onUpdateValue: (value: IValue) => void
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
 *   const {name, defaultValue, style, className} = props.jaenField
 *   return null
 * })
 * ```
 */
export const connectField = <IValue, IDefaultValue = IValue, IProps = {}>(
  Component: React.ComponentType<
    IProps & FieldConnection<IValue, IDefaultValue>
  >,
  options: {
    fieldType: string
  }
): React.FC<IProps & JaenFieldProps<IDefaultValue>> =>
  withRedux(props => {
    const dispatch = useAppDispatch()

    const {staticJaenPage, jaenPageId} = useJaenPageContext()

    if (!jaenPageId) {
      throw new Error(
        'JaenPage id is undefined! connectField must be used within a JaenPage'
      )
    }

    const sectionContext = useJaenSectionContext()

    function getPageField<T>(
      page: JaenPage | JaenPageState | null
    ): T | undefined {
      if (page) {
        let fields

        if (!sectionContext) {
          fields = page.jaenFields
        } else {
          const {chapterName, sectionId} = sectionContext

          fields = page.chapters?.[chapterName]?.sections[sectionId]?.jaenFields
        }

        return fields?.[options.fieldType]?.[props.name] as T
      }
    }

    const value = useAppSelector<IValue | undefined>(state => {
      const page = state.pages.pages[jaenPageId]

      if (page) {
        return getPageField(page)
      }
    })

    const staticValue = getPageField<IValue>(staticJaenPage)

    const isEditing = useAppSelector(state => state.general.isEditing)

    const handleUpdateValue = (value: IValue) => {
      dispatch(
        field_write({
          pageId: jaenPageId,
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
          className: props.className
        }}
        {...props}
      />
    )
  })
