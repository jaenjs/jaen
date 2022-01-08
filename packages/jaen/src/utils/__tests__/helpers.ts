import {generateOriginPath, generatePagePaths} from '../helpers'
import {TreeNode} from '../hooks/jaen/useJaenPageTree'

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

    expect(path).toBe('/')

    const path2 = generateOriginPath(jaenPageTree, jaenPageTree[1])

    expect(path2).toBe('/contact')

    const path3 = generateOriginPath(jaenPageTree, jaenPageTree[2])

    expect(path3).toBe('/contact/subcontact')
  })
})

describe('generatePagePaths', () => {
  test('should generate paths for a page', () => {
    const pageId = '1'
    const paths = generatePagePaths(jaenPageTree, pageId)

    expect(paths).toEqual({
      '/': '1',
      '/contact': '2',
      '/contact/subcontact': '3'
    })

    const paths2 = generatePagePaths(jaenPageTree, '2')

    expect(paths2).toEqual({
      '/contact': '2',
      '/contact/subcontact': '3'
    })

    const paths3 = generatePagePaths(jaenPageTree, '3')

    expect(paths3).toEqual({
      '/contact/subcontact': '3'
    })
  })
})
