import {useEffect, useState} from 'react'

/**
 * Below Chakra's `md` (48em) a table is cards and the driver's detail is the
 * phone screen. matchMedia after mount, false during SSR, so the server and
 * the first client render agree.
 */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 47.99em)')
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return mobile
}
