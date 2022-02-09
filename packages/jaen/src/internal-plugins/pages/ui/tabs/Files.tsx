import {useSnekFinder} from '@jaenjs/snek-finder'

export const FilesContainer = () => {
  const finder = useSnekFinder({mode: 'browser'})

  return finder.finderElement
}
