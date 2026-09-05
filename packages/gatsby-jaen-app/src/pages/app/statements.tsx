import {PageConfig} from 'jaen'
import {PageProps, navigate as gatsbyNavigate} from 'gatsby'
import React from 'react'
import {AppWrapper} from '../../AppWrapper'
import {useCaller} from '../../../shared/auth'
import {StatementsView} from '../../../shared/views/StatementsView'

/**
 * The caller's own statements. The id is the signed-in account's, read from
 * the same currentUser answer the shell uses, and the backend refuses any
 * other id for a caller who is not an admin.
 */
const OwnStatements: React.FC = () => {
  const caller = useCaller()
  return <StatementsView userId={caller.loading ? undefined : caller.userId} />
}

const StatementsPage: React.FC<PageProps> = () => {
  const nav = React.useMemo(() => ({
    navigate: (path: string) => gatsbyNavigate(`/app${path}`),
    params: {}
  }), [])

  return (
    <AppWrapper nav={nav}>
      <OwnStatements />
    </AppWrapper>
  )
}

export default StatementsPage

export const pageConfig: PageConfig = {
  label: 'Statements',
  icon: 'FaFileInvoice',
  // No `menu` here: the frame would list this page for every signed-in
  // person, in English, in an unlabelled group beside the brand's. The app
  // registers its entries itself, per role and per language, see
  // src/components/useFrameMenu.ts.
  // Every /app route is for a signed-in person. jaen sends anybody else to
  // /login and brings them back here afterwards. Which role they need is the
  // backend's decision, made per field, and the shell's, made per nav item.
  auth: {
    isRequired: true
  },
  layout: {
    name: 'jaen',
    type: 'full'
  }
}

export {Head} from 'jaen'
