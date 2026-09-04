import {PageConfig} from 'jaen'
import {PageProps, navigate as gatsbyNavigate} from 'gatsby'
import React from 'react'
import {AppWrapper} from '../../../AppWrapper'
import {BookingView} from '../../../../shared/views/BookingView'

const BookingPage: React.FC<PageProps> = () => {
  const nav = React.useMemo(() => ({
    navigate: (path: string) => gatsbyNavigate(`/app${path}`),
    params: {}
  }), [])

  return (
    <AppWrapper nav={nav}>
      <BookingView />
    </AppWrapper>
  )
}

export default BookingPage

export const pageConfig: PageConfig = {
  label: 'Booking',
  icon: 'FaCalendarCheck',
  menu: {
    order: 15,
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
