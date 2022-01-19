import {useSnekFinder} from '@jaenjs/snek-finder'
import {withSnekFinder} from '@src/internal/root/hooks/withSnekFinder'

export const FilesContainer = withSnekFinder(() => {
  const finder = useSnekFinder({mode: 'browser'})

  return finder.finderElement
})
