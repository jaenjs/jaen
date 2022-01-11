import type {TreeJaenPage} from '@src/internal/types'

import reducer, {updateForPage} from '../generalSlice'

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

describe('updateForPage', () => {
  test('should handle dynamic path generation for a pageId', () => {
    const state = {dynamicPaths: {}}

    const action = updateForPage({
      jaenPageTree,
      pageId: '3',
      create: true
    })

    const newState = reducer(state, action)

    expect(newState).toEqual({
      dynamicPaths: {
        '/root/contact/subcontact': '3'
      }
    })
  })
})
