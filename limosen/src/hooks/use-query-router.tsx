// use-query-router.tsx
import { useEffect, useState } from 'react'

export const useQueryRouter = (
  location: { pathname: string; search: string },
  paramKey: string
) => {
  const [isCalled, setIsCalled] = useState(false)
  const [paramValue, setParamValue] = useState('')

  useEffect(() => {
    // Check the URL query string for the provided key
    const params = new URLSearchParams(location.search)
    setIsCalled(params.has(paramKey))
    setParamValue(params.get(paramKey) as string)
  }, [location.pathname, location.search, paramKey])

  return {
    isCalled,
    paramValue,
  }
}
