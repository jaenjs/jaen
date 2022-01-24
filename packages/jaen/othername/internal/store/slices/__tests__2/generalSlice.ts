import type {TreeJaenPage} from '@src/internal/types'

import reducer, {
  GeneralState,
  setEditing,
  updateDynamicPaths
} from '../generalSlice'

const jaenPageTree: TreeJaenPage[] = [
  {
    id: '1',
    slug: 'root',
    children: [
      {
        id: '2'
      }
    ],
    parent: null,
    jaenPageMetadata: {
      title: 'Root'
    },
    template: null
  },
  {
    id: '2',
    slug: 'contact',
    children: [
      {
        id: '3'
      }
    ],
    parent: {id: '1'},
    jaenPageMetadata: {
      title: 'Root'
    },
    template: null
  },
  {
    id: '3',
    slug: 'subcontact',
    children: [],
    parent: {id: '2'},
    jaenPageMetadata: {
      title: 'Root'
    },
    template: null
  }
]

const previousState: GeneralState = {isEditing: false, dynamicPaths: {}}

describe('setEditing', () => {
  it('should set isEditing', () => {
    const newEM = !previousState.isEditing
    const nextState = reducer(previousState, setEditing(newEM))

    expect(nextState.isEditing).toBe(newEM)
  })
})

describe('updateDynamicPaths', () => {
  test('should handle dynamic path generation for a pageId', () => {
    const action = updateDynamicPaths({
      jaenPageTree,
      pageId: '3',
      create: true
    })

    const newState = reducer(previousState, action)

    expect(newState.dynamicPaths).toEqual({
      '/root/contact/subcontact': {
        pageId: '3',
        templateName: undefined
      }
    })
  })
})
