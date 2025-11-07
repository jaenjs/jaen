// src/contexts/language.tsx
import { useCallback } from 'react'
import { useIntl } from 'react-intl'

export type TranslateFn = (id: string, defaultMessage?: string) => string

/** Returns a stable translate function tied to the current Intl context. */
export const useT = (): TranslateFn => {
  const intl = useIntl()
  return useCallback<TranslateFn>(
    (id, defaultMessage) => intl.formatMessage({ id, defaultMessage }),
    [intl]
  )
}
