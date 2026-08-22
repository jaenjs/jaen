import React, {createContext, useContext, useMemo, useState} from 'react'

/**
 * A locale the visitor has picked but not yet saved.
 *
 * The settings page lets a user choose the account language. Saving writes it
 * to the identity server, and the account value then drives the CMS language
 * on every future visit. What was missing is the moment in between: picking a
 * language did nothing until Save, and a user who did not save saw no change
 * at all and could not tell whether the control worked.
 *
 * So the choice takes effect on the spot, in memory only. JaenIntlProvider
 * reads it ahead of the account's preferredLanguage. It is plain React state,
 * so it lives exactly as long as the page: leave without saving and the next
 * visit is back on the account's language, which is the behaviour asked for.
 */
type UiLocaleState = {
  previewLocale: string | null
  setPreviewLocale: (locale: string | null) => void
}

const UiLocaleContext = createContext<UiLocaleState>({
  previewLocale: null,
  setPreviewLocale: () => {}
})

export const UiLocaleProvider: React.FC<{children: React.ReactNode}> = ({
  children
}) => {
  const [previewLocale, setPreviewLocale] = useState<string | null>(null)

  const value = useMemo(
    () => ({previewLocale, setPreviewLocale}),
    [previewLocale]
  )

  return (
    <UiLocaleContext.Provider value={value}>
      {children}
    </UiLocaleContext.Provider>
  )
}

export const useUiLocale = (): UiLocaleState => useContext(UiLocaleContext)
