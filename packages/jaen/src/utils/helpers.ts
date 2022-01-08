import {store} from '../store'
import {TreeNode} from './hooks/jaen/useJaenPageTree'

export const omitSingle = (key: string, {[key]: _, ...obj}) => obj

export const generateOriginPath = (
  jaenPageTree: TreeNode[],
  node: TreeNode,
  path = ''
): string | undefined => {
  const parentId = node.parent?.id
  const parent = jaenPageTree.find(n => n.id === parentId)

  if (parent) {
    return generateOriginPath(
      jaenPageTree,
      parent,
      path ? `${node.slug}/${path}` : node.slug
    )
  } else {
    return `/${path}`
  }
}

export const generatePagePaths = (jaenPageTree: TreeNode[], pageId: string) => {
  const originNode = jaenPageTree.find(node => node.id === pageId)

  if (originNode) {
    const paths: {[path: string]: string} = {}

    const originPath = generateOriginPath(jaenPageTree, originNode!)

    const lookupPath = (node: TreeNode, pathPrefix = '/') => {
      paths[pathPrefix] = node.id

      if (node.children.length) {
        for (const {id} of node.children) {
          const child = jaenPageTree.find(n => n.id === id)

          if (child) {
            lookupPath(
              child,
              pathPrefix !== '/'
                ? `${pathPrefix}/${child.slug}`
                : `/${child.slug}`
            )
          }
        }
      }
    }

    lookupPath(originNode, originPath)

    return paths
  } else {
    throw new Error('Could not generate paths for page with id: ' + pageId)
  }
}

// export const generatePath = (
//   pageId: string,
//   options: {disableDynamicTranslation: boolean} = {
//     disableDynamicTranslation: false
//   }
// ) => {
//   const jaenPageTree = getJaenPageTree()
//   console.log('🚀 ~ file: helpers.ts ~ line 67 ~ jaenPageTree', jaenPageTree)
//   const dynamicPaths = store.getState()?.dpaths.dynamicPaths
//   const node = jaenPageTree.find(node => node.id === pageId)
//   const path = generateOriginPath(jaenPageTree, node!)

//   if (path) {
//     if (
//       !options.disableDynamicTranslation &&
//       dynamicPaths &&
//       path in dynamicPaths
//     ) {
//       return `/_${path}`
//     }

//     return path
//   }
// }
