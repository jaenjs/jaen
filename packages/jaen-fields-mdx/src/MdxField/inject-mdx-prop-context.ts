import {createContext, useContext} from 'react'

export const InjectMdxPropContext = createContext<{
  injectProp: (prop: string, id: string, src: string) => void
} | null>(null)

export const useInjectMdxPropContext = () => {
  return useContext(InjectMdxPropContext)
}
