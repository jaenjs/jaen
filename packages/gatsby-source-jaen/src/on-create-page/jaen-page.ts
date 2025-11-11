import path from 'path'

import {PageConfig} from 'jaen'
import {CreatePageArgs, Node} from 'gatsby'

import {getJaenPageParentId} from '../utils/get-jaen-page-parent-id'
import {readPageConfig} from '../utils/page-config-reader'
import {normalizePath, shouldSkipPageCreation} from '../utils/path-filters'
import {ensureSitemapManager} from '../utils/sitemap-manager'

export const onCreatePage = async ({
  actions,
  page,
  getNode,
  createContentDigest,
  store,
  reporter
}: CreatePageArgs) => {
  const normalizedPath = normalizePath(page.path)
  const expectedJaenPageId = `JaenPage ${page.path}`
  // Gatsby attaches this property at runtime, but it's not declared on the Page TS type.
  // Use a narrowed shape to make TypeScript happy without changing runtime behavior.
  type MaybeStateful = {
    isCreatedByStatefulCreatePages?: boolean
  }
  const isStateful = Boolean(
    (page as unknown as MaybeStateful).isCreatedByStatefulCreatePages
  )

  const existingJaenPageId = page.context?.jaenPageId as string | undefined
  let pageConfig = page.context?.pageConfig as PageConfig | undefined

  const shouldEnsureJaenPageId =
    existingJaenPageId === undefined ||
    (isStateful && existingJaenPageId !== expectedJaenPageId)

  const shouldEnsurePageConfig = pageConfig === undefined

  if (shouldSkipPageCreation(normalizedPath)) {
    actions.deletePage(page)

    return
  }

  if (shouldEnsureJaenPageId || shouldEnsurePageConfig) {
    pageConfig = pageConfig ?? readPageConfig(page.component)

    const nextJaenPageId = isStateful
      ? expectedJaenPageId
      : existingJaenPageId ?? expectedJaenPageId

    const preservedIntl = (page.context as {intl?: unknown} | undefined)?.intl

    const nextContext = (page.context ?? {}) as Record<string, unknown>

    if (preservedIntl !== undefined && nextContext.intl === undefined) {
      nextContext.intl = preservedIntl
    }

    nextContext.jaenPageId = nextJaenPageId
    nextContext.pageConfig = pageConfig

    actions.deletePage(page)

    actions.createPage({
      ...page,
      context: nextContext
    })

    return
  }

  const jaenPageId = existingJaenPageId ?? expectedJaenPageId

  // Find the JaenPage node with the same id
  const jaenPageNode = getNode(jaenPageId) as any | undefined

  const lastPathElement = normalizedPath.split('/').pop() || ''

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

  const programDirectory =
    (store?.getState().program?.directory as string | undefined) ?? process.cwd()
  const publicDirectory = path.join(programDirectory, 'public')
  type GatsbyStoreState = {
    config?: {
      siteMetadata?: {
        siteUrl?: string
      }
    }
  }

  const siteUrlFromConfig = (
    store?.getState() as GatsbyStoreState | undefined
  )?.config?.siteMetadata?.siteUrl

  const siteUrlFromEnv =
    siteUrlFromConfig ??
    (page.context?.siteUrl as string | undefined) ??
    process.env.GATSBY_SITE_URL ??
    process.env.SITE_URL ??
    'https://page.jaen.io'

  const sitemapManager = ensureSitemapManager({
    publicDirectory,
    siteUrl: siteUrlFromEnv,
    reporter
  })

  type PageContextWithLocales = {
    locale?: string | null
    localePagesId?: string | null
    translations?: Array<{locale?: string | null; path: string}>
    defaultLocale?: string | null
    intl?: {defaultLocale?: string | null} | null
  }

  const contextWithLocales = (page.context ?? {}) as PageContextWithLocales
  const defaultLocale =
    contextWithLocales.intl?.defaultLocale ?? contextWithLocales.defaultLocale ?? null

  await sitemapManager.trackPage({
    path: normalizedPath,
    createdAt,
    lastModified: modifiedAt,
    locale: contextWithLocales.locale ?? null,
    defaultLocale,
    localePagesId: contextWithLocales.localePagesId ?? null,
    translations: contextWithLocales.translations
  })
}
