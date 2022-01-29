import {JaenPageProvider} from '../../internal/services/page'

export interface IndexFieldProps {
  name: string
}

/**
 * @example
 * ```
 * <IndexField name="test"/>
 * {(children, withProvider) => (
 *  {children.map(child => {
 *   return withProvider(child)
 *  })}
 * )}
 * </IndexField>
 * ```
 */
export const IndexField = () => {}

export const Test = () => {
  return (
    <IndexField name="test">
      {children => (
        <>
          {children.map(child => {
            ;<JaenPageProvider jaenPageId={child.id}>{child}</JaenPageProvider>
          })}
        </>
      )}
    </IndexField>
  )
}
