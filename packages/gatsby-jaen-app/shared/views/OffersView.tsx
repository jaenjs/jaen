/**
 * /app/offers/ is the customer half of the billing screen since the screen
 * grew both sides (okf/architecture/finance.md, "The billing screen, both
 * sides", and navigation.md, "The bar's five places"): the offers table
 * lives on /app/statements/ under the Kunden tab, and this route sends
 * everybody there. The redirect replaces the history entry so the back
 * button does not return to a page that only forwards. An old bookmark and
 * the frame's entry, until it is gone, keep working.
 */
import {useEffect} from 'react'
import {Box} from '@chakra-ui/react'
import {useAppNavigate} from '../navigation'
import {TableSkeleton} from '../components/skeletons'
import {useI18nCode} from '../i18n'
import {getI18nOffers} from '../locales/i18nOffers'

/** Where the offers live now, relative to the app's root. */
export const OFFERS_REDIRECT = '/statements/?tab=kunden'

export function OffersView() {
  const navigate = useAppNavigate()
  const code = useI18nCode()
  const {strings: s} = getI18nOffers(code)

  useEffect(() => {
    navigate(OFFERS_REDIRECT)
  }, [navigate])

  // The table's skeleton while the route changes, so nothing of the old
  // screen flashes and no frame carries a loading word (design-consistency.md).
  return (
    <Box p={{base: '4', md: '6'}} maxW="full" data-testid="offers-redirect">
      <TableSkeleton
        columns={[
          {id: 'number', label: s.ColNumber, width: 110},
          {id: 'date', label: s.ColDate, width: 160},
          {id: 'customer', label: s.ColCustomer, width: 170},
          {id: 'total', label: s.ColTotal, width: 100, align: 'end'},
          {id: 'status', label: s.ColStatus, width: 180}
        ]}
        rows={6}
      />
    </Box>
  )
}
