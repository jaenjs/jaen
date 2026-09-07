/**
 * `deepmergeArrayIdMerge`, copied from `packages/jaen/src/utils/deepmerge.ts`.
 *
 * It is copied rather than imported because that module sits in a package
 * whose entry pulls in gatsby and react, and because the build already has a
 * second copy of it in gatsby-source-jaen for the same reason. The three must
 * stay identical: it decides how two patches merge at build time and how one
 * change merges into a section here, and a divergence would show up as a
 * field that reads differently in the CMS and on the built site.
 */
import deepmerge from 'deepmerge'

export const deepmergeArrayIdMerge = (
  target: any[],
  source: any[],
  options: any
): any[] => {
  if (target == null) {
    return source ? source.slice() : []
  }

  if (source == null) {
    return target.slice()
  }

  const groups = ['id', 'fieldName']

  for (const group of groups) {
    if (target.every(v => v?.[group]) && source.every(v => v?.[group])) {
      const mergeArrays = (arr1: any[] = [], arr2: any[] = [], key = 'id') => {
        const elements: any[] = []

        const arr2Copy = arr2.slice()

        for (const element of arr1) {
          const el = arr2Copy.find(v => v && v[key] === element[key])

          if (el) {
            elements.push(
              deepmerge(element, el, {
                ...(options || {}),
                arrayMerge: deepmergeArrayIdMerge
              })
            )
            arr2Copy.splice(arr2Copy.indexOf(el), 1)
          } else {
            elements.push(element)
          }
        }

        elements.push(...arr2Copy)

        return elements
      }

      return mergeArrays(target || [], source || [], group)
    }
  }

  const destination = target.slice()

  if (target.every(v => ['string', 'number'].includes(typeof v))) {
    return source
  }

  source.forEach((item, index) => {
    if (typeof destination[index] === 'undefined') {
      destination[index] = options.cloneUnlessOtherwiseSpecified(item, options)
    } else if (options.isMergeableObject(item)) {
      destination[index] = deepmerge(target[index], item, {
        ...(options || {}),
        arrayMerge: deepmergeArrayIdMerge
      })
    } else if (!target.includes(item)) {
      destination.push(item)
    }
  })

  return destination
}
