import {PageConfig} from 'jaen'
import {CreatePageArgs, Node} from 'gatsby'

import {getJaenPageParentId} from '../utils/get-jaen-page-parent-id'
import {readPageConfig} from '../utils/page-config-reader'
import {ResolvedJaenSourcePluginOptions} from '../utils/plugin-options'
import {ensureSitemapManager} from '../utils/sitemap-manager'

interface CreatePageExtras {
  skipSitemap?: boolean
}

export const onCreatePage = async ({
  actions,
  page,
  getNode,
  createContentDigest,
  reporter
}: CreatePageArgs,
options: ResolvedJaenSourcePluginOptions,
extras: CreatePageExtras = {}
) => {
  const expectedJaenPageId = `JaenPage ${page.path}`
  // Gatsby attaches this property at runtime, but it's not declared on the Page TS type.
  // Use a narrowed shape to make TypeScript happy without changing runtime behavior.
  type MaybeStateful = {
    isCreatedByStatefulCreatePages?: boolean
  }
  const isStateful = Boolean(
    (page as unknown as MaybeStateful).isCreatedByStatefulCreatePages
  )

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
    pageConfig,
    locale: (page.context as any)?.locale ?? jaenPageNode?.locale ?? null,
    defaultLocale:
      (page.context as any)?.defaultLocale ?? jaenPageNode?.defaultLocale ?? null,
    localePagesId:
      (page.context as any)?.localePagesId ?? jaenPageNode?.localePagesId ?? null
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

  if (!extras.skipSitemap) {
    const sitemapManager = ensureSitemapManager({
      siteUrl: options.siteUrl,
      publicDirectory: options.publicDirectory,
      reporter
    })

    const contextTranslations = Array.isArray((page.context as any)?.translations)
      ? ((page.context as any).translations as Array<{
          locale?: string | null
          path?: string | null
        }>)
          .map(translation => ({
            locale: translation.locale ?? null,
            path: translation.path ?? ''
          }))
          .filter(translation => Boolean(translation.path))
      : []

    await sitemapManager.trackPage({
      path: page.path,
      createdAt,
      lastModified: modifiedAt,
      locale: (page.context as any)?.locale ?? null,
      defaultLocale:
        (page.context as any)?.defaultLocale ?? options.defaultLocale ?? null,
      localePagesId: (page.context as any)?.localePagesId ?? null,
      translations: contextTranslations
    })
  }
}
