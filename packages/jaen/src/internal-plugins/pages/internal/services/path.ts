import {ITreeJaenPage} from '../../types'

export const generateOriginPath = (
  jaenPageTree: ITreeJaenPage[],
  node: ITreeJaenPage,
  path = `/${node.slug}`
): string | undefined => {
  const parentId = node.parent?.id
  const parent = jaenPageTree.find(n => n.id === parentId)

  if (parent) {
    return generateOriginPath(jaenPageTree, parent, `/${parent.slug}${path}`)
  }

  return path
}

export const generatePagePaths = (
  jaenPageTree: ITreeJaenPage[],
  pageId: string
) => {
  const originNode = jaenPageTree.find(node => node.id === pageId)

  if (originNode) {
    const paths: {[path: string]: string} = {}

    const originPath = generateOriginPath(jaenPageTree, originNode!)

    const lookupPath = (node: ITreeJaenPage, pathPrefix = '/') => {
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
