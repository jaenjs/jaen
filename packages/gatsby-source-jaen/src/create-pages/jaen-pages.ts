import {CreatePagesArgs} from 'gatsby'

import {onCreatePage} from '../on-create-page/jaen-page'
import {readPageConfig} from '../utils/page-config-reader'
import {generatePageOriginPath} from '../utils/path'
import {ResolvedJaenSourcePluginOptions} from '../utils/plugin-options'

type JaenPageNode = {
  id: string
  template: string | null
  slug: string
  parentPage: {
    id: string
  } | null
  locale?: string | null
  defaultLocale?: string | null
  localePagesId?: string | null
  localePages?: Array<{id: string} | null> | null
}

const deriveGroupKey = (node: JaenPageNode): string => {
  if (node.localePagesId) {
    return node.localePagesId
  }

  const localePageIds =
    node.localePages?.map(page => page?.id).filter(Boolean) ?? []

  if (localePageIds.length > 0) {
    const sorted = [...localePageIds, node.id].sort()
    return sorted[0]!
  }

  return node.id
}

const deriveLocalePrefix = (
  locale: string | null | undefined,
  options: ResolvedJaenSourcePluginOptions
): string => {
  if (!locale) {
    return ''
  }

  const trimmed = locale.trim()

  if (!trimmed) {
    return ''
  }

  const match = options.localeMap.get(trimmed)

  if (match) {
    return match.prefix
  }

  // Ensure a defined value for language before calling toLowerCase
  const parts = trimmed.split('-')
  const language = (parts[0] ?? trimmed).toLowerCase()
  return language
}

const applyLocalePrefix = (path: string, prefix: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const sanitizedPrefix = prefix.replace(/^\/+|\/+$/g, '')

  if (!sanitizedPrefix) {
    return normalizedPath
  }

  const strippedPath = normalizedPath.replace(/^\/+/, '')

  if (!strippedPath) {
    return `/${sanitizedPrefix}/`
  }

  return `/${sanitizedPrefix}/${strippedPath}`.replace(/\/+$/, '/')
}

interface PageTranslation {
  locale: string
  path: string
}

export const createPages = async (
  args: CreatePagesArgs,
  options: ResolvedJaenSourcePluginOptions
) => {
  const {actions, graphql, reporter} = args

  reporter.info('Creating pages...')

  const result = await graphql<{
    allJaenTemplate: {
      nodes: Array<{
        id: string
        absolutePath: string
        relativePath: string
      }>
    }
    allJaenPage: {
      nodes: Array<JaenPageNode>
    }
  }>(`
    query {
      allJaenTemplate {
        nodes {
          id
          absolutePath
          relativePath
        }
      }
      allJaenPage {
        nodes {
          id
          template
          slug
          parentPage {
            id
          }
        }
      }
    }
  `)

  if (result.errors || !result.data) {
    reporter.panicOnBuild(`Error while running GraphQL query. ${result.errors}`)

    return
  }

  const {allJaenTemplate, allJaenPage} = result.data

  const templateById = new Map(
    allJaenTemplate.nodes.map(template => [template.id, template])
  )

  const nodes = allJaenPage.nodes
  const localizedPathById = new Map<string, string>()
  const translationsById = new Map<string, PageTranslation[]>()
  const nodesById = new Map(nodes.map(node => [node.id, node]))

  for (const node of nodes) {
    const pagePath = generatePageOriginPath(nodes, node)

    if (!pagePath) {
      reporter.panicOnBuild(`Error while generating path for page ${node.id}`)
      return
    }

    const prefix = deriveLocalePrefix(
      node.locale ?? options.defaultLocale,
      options
    )
    const localizedPath = applyLocalePrefix(pagePath, prefix)

    localizedPathById.set(node.id, localizedPath)
  }

  const groups = new Map<string, string[]>()

  for (const node of nodes) {
    const key = deriveGroupKey(node)
    const list = groups.get(key)

    if (list) {
      list.push(node.id)
    } else {
      groups.set(key, [node.id])
    }
  }

  // Build translations without relying on Map iteration protocol
  groups.forEach(ids => {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!
      const translations: PageTranslation[] = []

      for (let j = 0; j < ids.length; j++) {
        const otherId = ids[j]!
        if (otherId === id) continue

        const otherNode = nodesById.get(otherId)
        const otherPath = localizedPathById.get(otherId)

        const otherLocale = otherNode?.locale ?? options.defaultLocale

        if (!otherNode || !otherPath || !otherLocale) {
          continue
        }

        translations.push({
          locale: otherLocale,
          path: otherPath
        })
      }

      translationsById.set(id, translations)
    }
  })

  for (const node of nodes) {
    if (!node.template) {
      continue
    }

    const pagePath = localizedPathById.get(node.id)

    if (!pagePath) {
      reporter.panicOnBuild(`Error while generating path for page ${node.id}`)
      return
    }

    const jaenTemplate = templateById.get(node.template)

    if (!jaenTemplate) {
      reporter.panicOnBuild(`Template ${node.template} not found`)
      return
    }

    const pageConfig = readPageConfig(jaenTemplate.absolutePath)
    const translations = translationsById.get(node.id) ?? []

    const page = {
      path: pagePath,
      component: jaenTemplate.absolutePath,
      context: {
        jaenPageId: node.id,
        pageConfig,
        locale: node.locale ?? options.defaultLocale,
        defaultLocale: node.defaultLocale ?? options.defaultLocale,
        localePagesId: node.localePagesId ?? null,
        translations
      }
    }

    actions.createPage(page)

    await onCreatePage(
      {
        page,
        ...args
      },
      options,
      {
        skipSitemap: true
      }
    )
  }
}
