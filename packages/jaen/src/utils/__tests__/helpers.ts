import {TreeNode} from '@src/utils/hooks/jaen/useJaenPageTree'

import {generateOriginPath, generatePagePaths} from '../helpers'

const jaenPageTree: TreeNode[] = [
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

describe('generateOriginPath', () => {
  test('should generate paths for a page', () => {
    const path = generateOriginPath(jaenPageTree, jaenPageTree[0])

    expect(path).toBe('/root')

    const path2 = generateOriginPath(jaenPageTree, jaenPageTree[1])

    expect(path2).toBe('/root/contact')

    const path3 = generateOriginPath(jaenPageTree, jaenPageTree[2])

    expect(path3).toBe('/root/contact/subcontact')
  })
})

describe('generatePagePaths', () => {
  test('should generate paths for a page', () => {
    const pageId = '1'
    const paths = generatePagePaths(jaenPageTree, pageId)

    expect(paths).toEqual({
      '/root': '1',
      '/root/contact': '2',
      '/root/contact/subcontact': '3'
    })

    const paths2 = generatePagePaths(jaenPageTree, '2')

    expect(paths2).toEqual({
      '/root/contact': '2',
      '/root/contact/subcontact': '3'
    })

    const paths3 = generatePagePaths(jaenPageTree, '3')

    expect(paths3).toEqual({
      '/root/contact/subcontact': '3'
    })
  })
})
