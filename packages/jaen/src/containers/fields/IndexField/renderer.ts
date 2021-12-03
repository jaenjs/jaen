import {PageType, ResolvedPageType} from '@src/types'

export interface IndexRenderArgs {
  page: ResolvedPageType
  /**
   * A list of template names that are available for this page.
   */
  templates: string[]
  /**
   * Add a new child page to the one on which the IndexField is configured.
   *
   * Warning: This method uses the internal `PageType`, which offers more flexibility.
   *          Be aware that setting other values than `slug`, `title`, `pageMetadata`,
   *          and `template` might lead to unexpected behavior!
   *
   * @param {PageType} page - The page to render
   */
  addPage: (page: Partial<PageType>) => void
}

export type IndexRenderFn = ({page, addPage}: IndexRenderArgs) => JSX.Element
