/**
 * The board's pager: the page of pages on the left, first, previous and next
 * on the right, every button at least 44px tall for a thumb.
 */
import {Button, HStack, IconButton, Text, chakra} from '@chakra-ui/react'
import {FaAngleDoubleLeft} from '@react-icons/all-files/fa/FaAngleDoubleLeft'
import {FaChevronLeft} from '@react-icons/all-files/fa/FaChevronLeft'
import {FaChevronRight} from '@react-icons/all-files/fa/FaChevronRight'
import {useI18nCode} from '../../i18n'
import {fill, getI18nCommon} from '../../locales/i18nCommon'

export interface PagerProps {
  page: number
  pages: number
  hasNext: boolean
  onFirst: () => void
  onPrev: () => void
  onNext: () => void
}

export function Pager({page, pages, hasNext, onFirst, onPrev, onNext}: PagerProps) {
  const code = useI18nCode()
  const {strings: tc} = getI18nCommon(code)
  return (
    <HStack justify="space-between" flexWrap="wrap" gap="2">
      <Text textStyle="sm" color="fg.muted">
        {fill(tc.PageLabel, {page, pages})}
      </Text>
      <HStack gap="2">
        <IconButton size="sm" variant="outline" aria-label={tc.Previous} disabled={page <= 1} onClick={onFirst} minH="44px">
          <FaAngleDoubleLeft />
        </IconButton>
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={onPrev} minH="44px">
          <FaChevronLeft />
          <chakra.span display={{base: 'none', sm: 'inline'}}>{tc.Previous}</chakra.span>
        </Button>
        <Button size="sm" variant="outline" disabled={!hasNext} onClick={onNext} minH="44px">
          <chakra.span display={{base: 'none', sm: 'inline'}}>{tc.Next}</chakra.span>
          <FaChevronRight />
        </Button>
      </HStack>
    </HStack>
  )
}
