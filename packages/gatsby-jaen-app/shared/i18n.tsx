import React, { createContext, useContext, useState, useCallback } from 'react'

export type I18nCode = 'en-US' | 'de-AT' | 'tr-TR' | 'ar-EG'

interface I18nContextValue {
  code: I18nCode
  setCode: (code: I18nCode) => void
}

const I18nContext = createContext<I18nContextValue>({
  code: 'de-AT',
  setCode: () => {},
})

export function I18nProvider({
  code: initialCode = 'de-AT',
  children,
}: {
  code?: I18nCode
  children: React.ReactNode
}) {
  const [code, setCode] = useState<I18nCode>(initialCode)

  const handleSetCode = useCallback((c: I18nCode) => setCode(c), [])

  return (
    <I18nContext.Provider value={{ code, setCode: handleSetCode }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18nCode(): I18nCode {
  return useContext(I18nContext).code
}

export function useI18n() {
  return useContext(I18nContext)
}
