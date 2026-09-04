import {PageConfig} from 'jaen'
import {PageProps, navigate as gatsbyNavigate} from 'gatsby'
import React from 'react'
import {AppWrapper} from '../../../AppWrapper'
import {TransfersView} from '../../../../shared/views/TransfersView'

const TransfersPage: React.FC<PageProps> = () => {
  const nav = React.useMemo(() => ({
    navigate: (path: string) => gatsbyNavigate(`/app${path}`),
    params: {}
  }), [])

  return (
    <AppWrapper nav={nav}>
      <TransfersView />
    </AppWrapper>
  )
}

export default TransfersPage

export const pageConfig: PageConfig = {
  label: 'Transfers',
  icon: 'FaExchangeAlt',
  menu: {
    order: 10,
    type: 'app'
  },
  auth: {
    isRequired: false
  },
  layout: {
    name: 'jaen',
    type: 'full'
  }
}

export {Head} from 'jaen'
