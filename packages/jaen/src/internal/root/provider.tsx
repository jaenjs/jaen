import {navigate} from 'gatsby'
import React from 'react'

import {useAppSelector} from '@src/internal/store'
import {withRedux} from '@src/internal/store/withRedux'
import {
  JaenConnection,
  JaenPageOptions,
  JaenPageProps,
  JaenPluginOptions
} from '@src/internal/types'

export interface JaenContext {
  templatesPaths: JaenPluginOptions['templates']['paths']
  templateLoader: (
    name: string
  ) => Promise<JaenConnection<JaenPageProps, JaenPageOptions>>
}

export const JaenContext = React.createContext<JaenContext | undefined>(
  undefined
)

export const useDynamicRedirect = () => {
  const windowPathname =
    typeof window !== 'undefined' ? window.location.pathname : ''

  const dynamicPaths = useAppSelector(state => state.general.dynamicPaths)

  React.useEffect(() => {
    const withoutTrailingSlash = windowPathname.replace(/\/$/, '')

    const pageId = dynamicPaths[withoutTrailingSlash]

    if (pageId) {
      const withDynamicPrefix = `/_${withoutTrailingSlash}`

      navigate(withDynamicPrefix)
    }
  }, [windowPathname])
}

export const JaenProvider: React.FC<{
  templatesPaths: JaenContext['templatesPaths']
}> = withRedux(({children, templatesPaths}) => {
  const templateLoader = async (name: string) => {
    //@ts-ignore
    return (await import(`${___JAEN_TEMPLATES___}/${templatesPaths[name]}`))
      .default
  }

  console.log('🚀 ~ file: jaen.tsx ~ line: 62 ~ JaenProvider ~ JaenProvider')

  useDynamicRedirect()

  return (
    <JaenContext.Provider
      value={{
        templatesPaths,
        templateLoader
      }}>
      {children}
    </JaenContext.Provider>
  )
})

/**
 * Access the JaenContext.
 *
 * @example
 * ```
 * const { jaen } = useJaenContext()
 * ```
 */
export const useJaenContext = () => {
  const context = React.useContext(JaenContext)

  if (context === undefined) {
    throw new Error('useJaenContext must be within JaenContextProvider')
  }

  return context
}
