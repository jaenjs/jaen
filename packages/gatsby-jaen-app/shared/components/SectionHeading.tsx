/**
 * A section heading under the page title.
 *
 * jaen's heading recipe remaps the `size` axis to v2's scale, where
 * `size="md"` is fontSize 4xl, 36px (see PageHeader for the same story on
 * the title). That is how the two headings of the customer's Abrechnungen,
 * Monatsabrechnungen and Rechnungen und Zahlungen, came to stand taller than
 * the 24px title above them, measured on the live booklimo.at at 1440 on
 * 2026-09-07, and the dashboard's Heute, Morgen and Fahrer are 36px for the
 * same reason. The size is pinned as a style prop the way PageHeader pins
 * its own: the lg text style, 18px semibold, so the hierarchy reads title,
 * section, table whichever recipe is in scope. `data-section-heading` is
 * what the design notebook reads them by.
 */
import React from 'react'
import {Heading} from '@chakra-ui/react'

export interface SectionHeadingProps {
  children: React.ReactNode
}

export function SectionHeading({children}: SectionHeadingProps) {
  return (
    <Heading
      as="h2"
      textStyle="lg"
      fontWeight="semibold"
      letterSpacing="normal"
      lineHeight="1.4"
      data-section-heading="">
      {children}
    </Heading>
  )
}
