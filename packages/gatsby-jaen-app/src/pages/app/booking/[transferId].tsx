import {PageConfig} from 'jaen'
import {PageProps, navigate as gatsbyNavigate} from 'gatsby'
import React from 'react'
import {AppWrapper} from '../../../AppWrapper'
import {BookingDetailView} from '../../../../shared/views/BookingDetailView'

const BookingDetailPage: React.FC<PageProps> = ({params}) => {
  const nav = React.useMemo(() => ({
    navigate: (path: string) => gatsbyNavigate(`/app${path}`),
    params: {bookingId: params.transferId ?? ''}
  }), [params.transferId])

  return (
    <AppWrapper nav={nav}>
      <BookingDetailView />
    </AppWrapper>
  )
}

export default BookingDetailPage

export const pageConfig: PageConfig = {
  label: 'Booking Detail',
  auth: {
    isRequired: false
  },
  layout: {
    name: 'jaen',
    type: 'full'
  }
}

export {Head} from 'jaen'
