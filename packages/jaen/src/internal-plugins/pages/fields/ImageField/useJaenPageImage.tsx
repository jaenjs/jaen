import {useJaenPageContext} from '@jaen-pages/internal/services/page'
import {getImage, IGatsbyImageData} from 'gatsby-plugin-image'

export function useJaenPageImage(options: {
  id: string
}): IGatsbyImageData | undefined {
  const {id} = options

  const {staticJaenPage} = useJaenPageContext()

  if (!staticJaenPage) {
    return undefined
  }

  const file = staticJaenPage.jaenFiles.find(({file}) => file.id === id)?.file

  if (file) {
    return getImage(file.gatsbyImageData)
  }
}
