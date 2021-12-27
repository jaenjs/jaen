import React from 'react'
import {JaenSectionOptions} from 'utils/types'

export type JaenSectionType = {
  chapterName: string
  sectionId: string
}

export const SectionOptionsContext = React.createContext<
  JaenSectionOptions | undefined
>(undefined)

export const JaenSectionContext = React.createContext<
  JaenSectionType | undefined
>(undefined)

export const JaenSectionProvider: React.FC<JaenSectionType> = ({
  children,
  chapterName,
  sectionId
}) => {
  const jaenSection = useJaenSectionContext()

  let chapterNameChain = chapterName

  if (jaenSection) {
    chapterNameChain = `${jaenSection.chapterName}.${chapterNameChain}`
  }

  return (
    <JaenSectionContext.Provider
      value={{
        chapterName: chapterNameChain,
        sectionId: sectionId
      }}>
      {children}
    </JaenSectionContext.Provider>
  )
}

/**
 * Access the SectionOptionsContext.
 *
 * @example
 * ```
 * const context = useSectionOptionsContext()
 * ```
 */
export const useSectionOptionsContext = () => {
  const context = React.useContext(SectionOptionsContext)

  return context
}

/**
 * Access the JaenSectionContext.
 *
 * @example
 * ```
 * const { name } = useJaenSectionContext()
 * ```
 */
export const useJaenSectionContext = () => {
  const context = React.useContext(JaenSectionContext)

  return context
}
