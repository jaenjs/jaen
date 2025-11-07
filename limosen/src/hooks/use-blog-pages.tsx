// hooks/use-blog-pages.tsx
import {useMemo} from 'react'
import {usePageContext} from 'jaen'
import {IGatsbyImageData} from 'gatsby-plugin-image'

/**
 * ProductCard-compatible blog item.
 * We keep the same field names/shape as your IJaenProduct so that
 * ProductCard can be reused for blog entries without any change.
 */
export interface IJaenBlog {
  // --- keep "variants" to satisfy ProductCard props (dummy for blogs)
  variants: Array<{
    id: string
    shopifyId: string
    taxable: boolean
    sku: string
    compareAtPrice: number | null
    price: number
    availableForSale: boolean
  }>
  hasOnlyDefaultVariant?: boolean

  // --- identifiers / routing
  id: string
  shopifyId: string // dummy
  handle: string    // used by ProductCard to link to the entry

  // --- content
  description: string
  descriptionHtml: string
  title: string
  tags: Array<string> // we use categories + (optional) "Neu" tag
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT' // static ACTIVE for blogs

  // --- misc meta
  totalInventory: number | null // dummy
  createdAt: string             // blog post date
  category: string              // from jaenPageMetadata.blogPost.category
  date: string                  // same as createdAt, kept for parity
  vendor: string                // dummy
  productType: string           // dummy

  // --- media
  media: Array<{
    id: string
    image: {
      src: string
      gatsbyImageData: IGatsbyImageData | null
      altText: string | null
    }
  }>
  featuredMedia: {
    id: string
    image: {
      src: string
      gatsbyImageData: IGatsbyImageData | null
      altText: string | null
    }
  } | null

  // --- metafields (unused for blogs, kept for parity)
  metafields: Array<{
    key: string
    value: string
    namespace: string
  }>

  // --- original index & resolved section media (kept for parity)
  index?: any
  sections?: any
}

/** Minimal Jaen page node used by this hook */
interface IJaenPage {
  id: string
  slug: string
  jaenPageMetadata: {
    image?: string
    description?: string
    title?: string
    blogPost?: {
      author?: string
      category?: string
      date?: string
      tags?: string[] // if you ever add tags here
    }
    date?: string
  }
  sections: Array<Section>
}

interface Section {
  fieldName: string
  items: Array<{
    jaenFields: {
      [key: string]: any
    }
    id: string
    altText?: string
  }>
}

interface IJaenIndex {
  childPages: IJaenPage[]
  [key: string]: any
}

interface UseJaenBlogsOptions {
  /** return all posts instead of slicing to the default 5 */
  unlimited?: boolean
  /** override the slice limit if not unlimited (default 5) */
  limit?: number
  /** override which section contains the inline images (default: "content") */
  contentSectionFieldName?: string
  /** override which section to mirror into "sections" (default: "productImageSection") */
  imageSectionMirrorFieldName?: string
  /** max days to still mark an entry as "Neu" (default: 30) */
  recentDaysThreshold?: number
}

/**
 * useJaenBlogs
 * Mirrors the structure/behavior of useJaenProducts, but operates on blog pages.
 *
 * @param blogIndex     The Jaen index for /blog/ (e.g., from useJaenPageIndex)
 * @param cmsmediapage  The CMS media page (used to resolve media node ids → URLs)
 * @param options       Parity options similar to useJaenProducts
 *
 * @returns posts, featuredPosts, morePosts, abcPosts (and spreads the incoming index)
 */
export const useJaenBlogs = (
  blogIndex: IJaenIndex,
  cmsmediapage: any,
  options?: UseJaenBlogsOptions
) => {
  // We still use the page context to avoid including the current page itself
  const {jaenPage} = usePageContext()
  // Base for building a handle (kept identical to your original logic)
  const blogHandleBase = (jaenPage.buildPath || '').slice(1)

  // Name of the section that contains inline images to map into "media"
  const sectionFieldName = options?.contentSectionFieldName ?? 'content'
  // Name of the section we mirror into "sections"
  const mirrorSectionFieldName = options?.imageSectionMirrorFieldName ?? 'productImageSection'
  // "Neu" tag threshold in days
  const recentDays = options?.recentDaysThreshold ?? 30

  // Resolve global media dictionary (id → asset)
  const globalMedia =
    (cmsmediapage?.jaenFields || {
      'IMA:MEDIA_NODES': {
        media_nodes: {
          value: {}
        }
      }
    })['IMA:MEDIA_NODES'].media_nodes.value

  /**
   * Transform one Jaen child page to a ProductCard-compatible blog object (IJaenBlog)
   */
  const transformToBlog = (child: IJaenPage, i: number): IJaenBlog => {
    // --- release date parsing
    const releaseDateStr =
      child.jaenPageMetadata?.blogPost?.date ||
      child.jaenPageMetadata?.date ||
      ''
    const releaseDate = releaseDateStr ? new Date(releaseDateStr) : null

    // mark "Neu" if within recentDays or among first 4 entries (to emulate your old behavior)
    const isRecent =
      !!releaseDate &&
      (Date.now() - releaseDate.getTime()) / (1000 * 3600 * 24) < recentDays
    const isOneOfMostRecent = i < 4

    // --- categories → tags
    const categoryStr = child.jaenPageMetadata?.blogPost?.category || ''
    const categoryTags = categoryStr
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    const tags = [
      ...categoryTags,
      ...(isRecent || isOneOfMostRecent ? ['Neu'] : [])
    ]

    // --- media from a specific section's ImageField entries
    const sectionWithImages = child.sections?.find(
      s => s.fieldName === sectionFieldName
    )
    const media =
      sectionWithImages?.items
        .filter(it => it.jaenFields?.['IMA:ImageField'])
        .map(it => {
          const imageId = it.jaenFields['IMA:ImageField']?.image?.value
          const gm = imageId ? globalMedia[imageId] : undefined
          return {
            id: imageId ?? it.id,
            image: {
              src: gm?.preview?.url || gm?.url || '',
              gatsbyImageData: null as IGatsbyImageData | null,
              altText: gm?.altText || it?.altText || null
            }
          }
        }) ?? []

    // --- featured image (from jaenPageMetadata.image)
    const featuredMedia = child.jaenPageMetadata?.image
      ? {
          id: 'featured',
          image: {
            src: child.jaenPageMetadata.image,
            gatsbyImageData: null as IGatsbyImageData | null,
            altText: child.jaenPageMetadata?.title || null
          }
        }
      : null

    // --- sections mirror (parity with useJaenProducts)
    const mirrorSection = child.sections?.find(
      s => s.fieldName === mirrorSectionFieldName
    )
    const mirrored =
      mirrorSection?.items.map(item => {
        const imageId = item.jaenFields['IMA:ImageField']?.image?.value
        const gm = imageId ? globalMedia[imageId] : undefined
        return {
          item,
          id: item.id,
          image: {
            field: item.jaenFields['IMA:ImageField'],
            id: imageId,
            url: gm?.url,
            preview: gm?.preview?.url,
            gatsbyImageData: null as IGatsbyImageData | null,
            altText: item.altText || null
          }
        }
      }) ?? []

    // --- final object (keeps ProductCard shape)
    return {
      // variants & several fields kept as dummies for ProductCard compatibility
      variants: [
        {
          id: 'VariantId',
          shopifyId: 'blog-item',
          taxable: true,
          sku: 'BLOG',
          compareAtPrice: null,
          price: 0,
          availableForSale: true
        }
      ],
      hasOnlyDefaultVariant: true,

      id: child.id,
      shopifyId: 'blog-item',

      // Build a handle similar to your product version (base + slug)
      handle: (blogHandleBase || '') + (child.slug || 'none'),

      description: child.jaenPageMetadata?.description || '',
      descriptionHtml: child.jaenPageMetadata?.description || '',
      title: child.jaenPageMetadata?.title || '',
      tags,

      status: 'ACTIVE',
      totalInventory: 9999, // dummy

      createdAt: releaseDateStr,
      category: categoryStr,
      date: releaseDateStr,

      vendor: child.jaenPageMetadata?.blogPost?.author || 'Autor',
      productType: 'Blog',

      media,
      featuredMedia,
      metafields: [],

      index: blogIndex,

      sections: mirrored
    }
  }

  /**
   * Build posts list (filter out current page, newest first),
   * then slice unless unlimited.
   */
  const posts: IJaenBlog[] = blogIndex.childPages
    .filter(child => child.id !== usePageContext().jaenPage.id)
    .reverse() // mimic your original .reverse() behavior
    .map(transformToBlog)
    .slice(0, options?.unlimited ? undefined : options?.limit ?? 5)

  /**
   * Build alphabetical groups (by first letter of slug), mirroring useJaenProducts.
   */
  const abcPosts = blogIndex.childPages
    .filter(child => child.id !== usePageContext().jaenPage.id)
    .reverse()
    .reduce<{ [key: string]: IJaenBlog[] }>((acc, child, i) => {
      const blog = transformToBlog(child, i)
      const firstLetter = (child.slug?.[0] || '#').toUpperCase()
      if (!acc[firstLetter]) acc[firstLetter] = []
      acc[firstLetter].push(blog)
      return acc
    }, {})

  /**
   * Featured subset = first 4; more = rest (parity with useJaenProducts).
   */
  const {featuredPosts, morePosts} = useMemo(() => {
    const featuredPosts = posts.slice(0, 4)
    const morePosts = posts.slice(4)
    return {featuredPosts, morePosts}
  }, [posts])

  return {
    ...blogIndex,
    posts,
    featuredPosts,
    morePosts,
    abcPosts
  }
}
