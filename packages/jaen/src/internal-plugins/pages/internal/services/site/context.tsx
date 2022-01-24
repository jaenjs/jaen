import {withRedux} from '@internal/redux'
import React from 'react'
import {IPageConnection} from '../../../connectors'
import {useDynamicRedirect} from '../routing/hooks'

export interface ISiteContext {
  templatesPaths: {[key: string]: string}
  templateLoader: (name: string) => Promise<IPageConnection>
}

export const SiteContext = React.createContext<ISiteContext | undefined>(
  undefined
)

export const SiteProvider: React.FC<{
  templatesPaths: ISiteContext['templatesPaths']
}> = withRedux(({children, templatesPaths}) => {
  const templateLoader = async (name: string) => {
    //@ts-ignore
    return (await import(`${___JAEN_TEMPLATES___}/${templatesPaths[name]}`))
      .default
  }

  console.log('🚀 ~ file: jaen.tsx ~ line: 62 ~ JaenProvider ~ JaenProvider')

  useDynamicRedirect()

  return (
    <SiteContext.Provider
      value={{
        templateLoader,
        templatesPaths
      }}>
      {children}
    </SiteContext.Provider>
  )
})

/**
 * Access the SiteContext.
 *
 * @example
 * ```
 * const { jaen } = useSiteContext()
 * ```
 */
export const useSiteContext = () => {
  const context = React.useContext(SiteContext)

  if (context === undefined) {
    throw new Error('useSiteContext must be within SiteContextProvider')
  }

  return context
}
