import './src/styles/app.css'
import React from 'react'
import { I18nProvider } from './shared/i18n'

export const wrapRootElement = ({ element }: { element: React.ReactNode }) => (
  <I18nProvider code="de-AT">
    {element}
  </I18nProvider>
)
