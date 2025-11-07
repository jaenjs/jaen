// hooks/use-blog-pages.ts
import {useJaenPageIndex, usePageContext} from 'jaen'
import {useMemo} from 'react'

export interface UseBlogPagesOptions {
  /** Set true to return all children (no slice). Default: false (max 5). */
  unlimited?: boolean
}

/**
 * Lightweight index hook for /blog/ pages.
 * - Excludes the currently opened page
 * - Sorts by jaenPageMetadata.blogPost.date (DESC)
 * - Returns the first entry as `featuredBlog` and the remainder as `moreBlogs`
 */
export const useBlogPages = (options?: UseBlogPagesOptions) => {
  const index = useJaenPageIndex({
    jaenPageId: 'JaenPage /docs/'
  })

  const {jaenPage} = usePageContext()

  const children = useMemo(() => {
    const sorted = (index.childPages ?? [])
      .filter(child => child.id !== jaenPage.id)
      .sort((a, b) => {
        const aDate = new Date(a.jaenPageMetadata?.blogPost?.date || '').getTime()
        const bDate = new Date(b.jaenPageMetadata?.blogPost?.date || '').getTime()
        return bDate - aDate
      })

    return options?.unlimited ? sorted : sorted.slice(0, 5)
  }, [index.childPages, jaenPage.id, options?.unlimited])

  const {featuredBlog, moreBlogs} = useMemo(() => {
    const featuredBlog = children[0]
    const moreBlogs = children.slice(1)
    return {featuredBlog, moreBlogs}
  }, [children])

  return {
    ...index,
    children,
    featuredBlog,
    moreBlogs
  }
}

export default useBlogPages
