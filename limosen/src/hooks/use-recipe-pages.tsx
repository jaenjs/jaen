import {useJaenPageIndex, usePageContext} from 'jaen'
import {useMemo} from 'react'

export const useRecipePages = (options?: {unlimited?: boolean}) => {
  const index = useJaenPageIndex({
    jaenPageId: 'JaenPage /recipes/'
  })

  // override index children to exclude a blog page if it is the current page
  const {jaenPage} = usePageContext()

  // Limit children count to 3 (sort by date)
  const children = index.childPages
    .filter(child => child.id !== jaenPage.id)
    .sort((a, b) => {
      const aDate = new Date(a.jaenPageMetadata?.blogPost?.date || '')
      const bDate = new Date(b.jaenPageMetadata?.blogPost?.date || '')

      return bDate.getTime() - aDate.getTime()
    })

    // Limit if limit is set
    .slice(0, options?.unlimited ? undefined : 5)

  const {featuredBlog, moreBlogs} = useMemo(() => {
    // The first child is the featured blog

    const featuredBlog = children[0]

    // The rest are the more blogs
    const moreBlogs = children.slice(1)

    return {
      featuredBlog,
      moreBlogs
    }
  }, [children])

  return {
    ...index,
    children,
    featuredBlog,
    moreBlogs
  }
}
