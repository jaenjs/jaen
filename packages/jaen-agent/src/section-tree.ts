/**
 * `insertSectionIntoTree` and `findSection`, copied from
 * `packages/jaen/src/utils/page/section.ts`.
 *
 * The design's rule is that the browser and the agent can never disagree
 * about what `sectionMove` means, so the two must run the same code. Copying
 * rather than importing is the concession the module graph forces: jaen's
 * own file imports `../../types`, which imports gatsby, gatsby-plugin-image,
 * react-icons and jaen's auth context, and none of those belong in a Worker
 * bundle. Only the type annotations differ from the original, and they are
 * structurally the same shapes (see ./types).
 *
 * When jaen's copy changes, this one changes with it in the same commit.
 */
import deepmerge from 'deepmerge'
import {v4 as uuidv4} from 'uuid'

import {deepmergeArrayIdMerge} from './deepmerge'
import type {JaenBlock, JaenSection, SectionPath} from './types'

export const updateItem = <T>(
  items: JaenBlock[],
  id: string,
  newData: Partial<T>
): JaenBlock[] => {
  const index = items.findIndex(item => item.id === id)

  if (index === -1) {
    items.push({
      id,
      ...newData
    } as JaenBlock)
  } else {
    items[index] = deepmerge(items[index] as any, newData as any, {
      arrayMerge: deepmergeArrayIdMerge
    }) as JaenBlock
  }

  return items
}

export const insertSectionIntoTree = (
  sections: JaenSection[],
  path: SectionPath,
  options?: {
    between?: [string | null, string | null]
    sectionId?: string
    shouldDelete?: true
    blockData?: Partial<JaenBlock>
    move?: {
      direction: 'up' | 'down'
      ptrNew: string | null
    }
  }
): JaenSection | null => {
  const between = options?.between
  const sectionId = options?.sectionId
  const shouldDelete = options?.shouldDelete
  const blockData = options?.blockData || {}
  const move = options?.move

  const [head, ...tail] = path

  if (
    sections.find(({fieldName}) => head && fieldName === head.fieldName) == null
  ) {
    if (head?.fieldName) {
      sections.push({
        fieldName: head.fieldName,
        items: []
      })
    }
  }

  for (const section of sections) {
    if (section.fieldName === head?.fieldName) {
      if (tail.length === 0) {
        if (sectionId && shouldDelete) {
          updateItem(section.items, sectionId, {
            ...blockData,
            deleted: true
          })

          if (between) {
            const [prev, next] = between

            if (prev && !next) {
              updateItem(section.items, prev, {ptrNext: null})

              section.ptrTail = prev
            } else if (!prev && next) {
              updateItem(section.items, next, {ptrPrev: null})

              section.ptrHead = next
            } else if (prev && next) {
              if (shouldDelete) {
                updateItem(section.items, prev, {ptrNext: next})
                updateItem(section.items, next, {ptrPrev: prev})
              } else {
                updateItem(section.items, prev, {ptrNext: null})
                updateItem(section.items, next, {ptrPrev: null})
              }
            } else {
              section.ptrHead = null
              section.ptrTail = null
            }
          }
        } else if (sectionId && move && between) {
          const [prev, next] = between
          const {direction, ptrNew} = move

          if (direction === 'down') {
            if (ptrNew) {
              updateItem(section.items, ptrNew, {ptrPrev: sectionId})
            } else {
              section.ptrTail = sectionId
            }

            if (prev) {
              updateItem(section.items, prev, {ptrNext: next})
            } else {
              section.ptrHead = next
            }

            if (next) {
              updateItem(section.items, next, {
                ptrPrev: prev,
                ptrNext: sectionId
              })
            } else {
              section.ptrTail = sectionId
            }

            updateItem(section.items, sectionId, {
              ptrPrev: next,
              ptrNext: ptrNew
            })
          } else if (direction === 'up') {
            if (ptrNew) {
              updateItem(section.items, ptrNew, {ptrNext: sectionId})
            } else {
              section.ptrHead = sectionId
            }

            if (prev) {
              updateItem(section.items, prev, {
                ptrNext: next,
                ptrPrev: sectionId
              })
            } else {
              section.ptrHead = sectionId
            }

            if (next) {
              updateItem(section.items, next, {ptrPrev: prev})
            } else {
              section.ptrTail = prev
            }

            updateItem(section.items, sectionId, {
              ptrPrev: ptrNew,
              ptrNext: prev
            })
          }
        } else {
          const genSectionId = sectionId || `JaenSection ${uuidv4()}`

          if (between && blockData.type) {
            const [prev, next] = between

            if (!prev && !next) {
              section.items.push({
                id: genSectionId,
                jaenFields: null,
                jaenFiles: [],
                ptrNext: null,
                ptrPrev: null,
                sections: [],
                type: blockData.type,
                ...blockData
              })

              section.ptrHead = genSectionId
              section.ptrTail = genSectionId
            } else if (prev && !next) {
              section.items.push({
                id: genSectionId,
                jaenFields: null,
                jaenFiles: [],
                ptrNext: null,
                ptrPrev: prev,
                sections: [],
                type: blockData.type,
                ...blockData
              })

              updateItem(section.items, prev, {ptrNext: genSectionId})

              section.ptrTail = genSectionId
            } else if (!prev && next) {
              section.items.push({
                id: genSectionId,
                jaenFields: null,
                jaenFiles: [],
                ptrNext: next,
                ptrPrev: null,
                sections: [],
                type: blockData.type,
                ...blockData
              })

              updateItem(section.items, next, {ptrPrev: genSectionId})

              section.ptrHead = genSectionId
            } else if (prev && next) {
              section.items.push({
                id: genSectionId,
                jaenFields: null,
                jaenFiles: [],
                ptrNext: next,
                ptrPrev: prev,
                sections: [],
                type: blockData.type,
                ...blockData
              })

              updateItem(section.items, prev, {ptrNext: genSectionId})
              updateItem(section.items, next, {ptrPrev: genSectionId})
            }
          } else {
            updateItem(section.items, genSectionId, {
              ...blockData,
              id: genSectionId
            })
          }
        }

        return section
      }

      let item = section.items.find(({id}) => id === tail[0]?.sectionId)

      if (item == null) {
        item = {
          id: tail[0]?.sectionId
        } as JaenBlock

        section.items.push(item)
      }

      item.sections = item.sections || []

      return insertSectionIntoTree(item.sections, tail, options)
    }
  }

  return null
}

export const findSection = (
  sections: JaenSection[],
  path: SectionPath
): JaenSection | null => {
  const [head, ...tail] = path

  for (const section of sections) {
    if (section.fieldName === head?.fieldName) {
      if (tail.length === 0) {
        return section
      }

      for (const item of section.items) {
        if (item.id === tail?.[0]?.sectionId) {
          if (item.sections) {
            return findSection(item.sections, tail)
          }
        }
      }
    }
  }

  return null
}
