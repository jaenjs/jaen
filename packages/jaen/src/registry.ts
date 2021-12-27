// registry for jean pages and sections
import {
  ConnectedPage,
  ConnectedSection,
  JaenPageOptions,
  JaenTemplateOptions,
  JaenSectionOptions
} from './utils/types'

export const registry: {
  pages: {
    [key: string]: {
      element: JSX.Element
      options: JaenPageOptions | JaenTemplateOptions
    }
  }
  sections: {
    [key: string]: {
      element: JSX.Element
      options: JaenSectionOptions
    }
  }
} = {
  pages: {},
  sections: {}
}
