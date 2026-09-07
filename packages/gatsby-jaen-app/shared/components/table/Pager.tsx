/**
 * The board's pager: the page of pages on the left, the page size beside it,
 * first, previous and next on the right, every control at least 44px tall for
 * a thumb.
 *
 * The size is the reader's (design-consistency.md, rule 10): the four sizes
 * as a native select, so the phone gets its own wheel and the keyboard walks
 * the list, remembered per table beside its column layout. Choosing one lands
 * on page 1, which the pager's own state does, see usePager.
 */
import {useId} from 'react'
import {
  Button,
  HStack,
  IconButton,
  NativeSelect,
  Text,
  chakra
} from '@chakra-ui/react'
import {FaAngleDoubleLeft} from '@react-icons/all-files/fa/FaAngleDoubleLeft'
import {FaChevronLeft} from '@react-icons/all-files/fa/FaChevronLeft'
import {FaChevronRight} from '@react-icons/all-files/fa/FaChevronRight'
import {useI18nCode} from '../../i18n'
import {fill, getI18nCommon} from '../../locales/i18nCommon'
import {PAGE_SIZES} from './columns'

export interface PagerProps {
  page: number
  pages: number
  hasNext: boolean
  onFirst: () => void
  onPrev: () => void
  onNext: () => void
  /** The rows a page holds. Without it the table offers no size. */
  pageSize?: number
  /** The four sizes, unless the screen names its own. */
  pageSizes?: readonly number[]
  onPageSize?: (size: number) => void
}

export function Pager({
  page,
  pages,
  hasNext,
  onFirst,
  onPrev,
  onNext,
  pageSize,
  pageSizes = PAGE_SIZES,
  onPageSize
}: PagerProps) {
  const code = useI18nCode()
  const {strings: tc} = getI18nCommon(code)
  // Two tables can stand on one screen, so the label points at its own select.
  const selectId = useId()
  const sizes = pageSize !== undefined && onPageSize !== undefined
  return (
    <HStack justify="space-between" flexWrap="wrap" gap="2">
      <HStack gap="3" flexWrap="wrap">
        <Text textStyle="sm" color="fg.muted">
          {fill(tc.PageLabel, {page, pages})}
        </Text>
        {sizes && (
          <HStack gap="2">
            <chakra.label
              htmlFor={selectId}
              textStyle="sm"
              color="fg.muted"
              whiteSpace="nowrap">
              {tc.PerPage}
            </chakra.label>
            <NativeSelect.Root size="sm" w="20" data-page-size="root">
              <NativeSelect.Field
                id={selectId}
                aria-label={tc.PerPage}
                minH="44px"
                value={String(pageSize)}
                onChange={e => onPageSize(Number(e.currentTarget.value))}>
                {pageSizes.map(size => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </HStack>
        )}
      </HStack>
      <HStack gap="2">
        <IconButton
          size="sm"
          variant="outline"
          aria-label={tc.Previous}
          disabled={page <= 1}
          onClick={onFirst}
          minH="44px">
          <FaAngleDoubleLeft />
        </IconButton>
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={onPrev}
          minH="44px">
          <FaChevronLeft />
          <chakra.span display={{base: 'none', sm: 'inline'}}>
            {tc.Previous}
          </chakra.span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!hasNext}
          onClick={onNext}
          minH="44px">
          <chakra.span display={{base: 'none', sm: 'inline'}}>
            {tc.Next}
          </chakra.span>
          <FaChevronRight />
        </Button>
      </HStack>
    </HStack>
  )
}
