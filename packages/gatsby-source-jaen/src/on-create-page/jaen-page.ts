import {PageConfig} from 'jaen'
import {CreatePageArgs, Node} from 'gatsby'

import {getJaenPageParentId} from '../utils/get-jaen-page-parent-id'
import {readPageConfig} from '../utils/page-config-reader'

export const onCreatePage = async ({
  actions,
  page,
  getNode,
  createContentDigest
}: CreatePageArgs) => {
  const expectedJaenPageId = `JaenPage ${page.path}`
  const isStateful = Boolean(page.isCreatedByStatefulCreatePages)

  let jaenPageId = page.context?.jaenPageId as string | undefined
  let pageConfig = page.context?.pageConfig as PageConfig | undefined

  const shouldEnsureJaenPageId =
    jaenPageId === undefined || (isStateful && jaenPageId !== expectedJaenPageId)

  const shouldEnsurePageConfig = pageConfig === undefined

  if (shouldEnsureJaenPageId || shouldEnsurePageConfig) {
    pageConfig = pageConfig ?? readPageConfig(page.component)

    const nextJaenPageId = isStateful
      ? expectedJaenPageId
      : jaenPageId ?? expectedJaenPageId

    actions.deletePage(page)

    actions.createPage({
      ...page,
      context: {
        ...page.context,
        jaenPageId: nextJaenPageId,
        pageConfig
      }
    })

    jaenPageId = nextJaenPageId
  }

  // Find the JaenPage node with the same id
  const jaenPageNode = getNode(jaenPageId) as any | undefined

  const path = page.path.replace(/\/+$/, '') // Remove trailing slashes from the path
  const lastPathElement = path.split('/').pop() || '' // Extract the last element

  const createdAt = (page as any).createdAt
    ? new Date((page as any).createdAt)
    : new Date()
  const modifiedAt = (page as any).updatedAt
    ? new Date((page as any).updatedAt)
    : new Date()

  const newJaenPageNode = {
    id: jaenPageId!,
    slug: lastPathElement,

    jaenPageMetadata: {
      title:
        pageConfig?.label ||
        lastPathElement.charAt(0).toUpperCase() + lastPathElement.slice(1)
    },
    jaenFields: null,
    sections: [],
    template: null,
    createdAt: createdAt.toISOString(),
    modifiedAt: modifiedAt.toISOString(),
    ...jaenPageNode,
    createdBy: jaenPageNode?.createdBy || 'gatsby-source-jaen',
    parentPage: getJaenPageParentId({
      parentPage: jaenPageNode?.parentPage
        ? {id: jaenPageNode.parentPage as string}
        : null,
      id: jaenPageId
    }),
    childPages: jaenPageNode?.childPages || [],
    childPagesOrder:
      jaenPageNode?.childPagesOrder ||
      jaenPageNode?.childPages?.map((child: Node) => child.id) ||
      [],
    pageConfig
  }

  const node = {
    ...newJaenPageNode,
    internal: {
      type: 'JaenPage',
      contentDigest: createContentDigest(newJaenPageNode),
      content: JSON.stringify(newJaenPageNode)
    }
  }

  await actions.createNode(node)
}
