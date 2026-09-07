/**
 * The Dokumente source of jaen's Media tab: every offer and every invoice
 * of the brand, newest first, paged and filtered
 * (okf/architecture/media.md, "Sources").
 *
 * The bytes never leave the brand's private R2 bucket, so a card shows no
 * preview and no bucket URL: it shows what the row says (the kind, the
 * number, the ride's code, the addressee, the date and the size) and opens
 * the signed `documentUrl` in a new tab on a click, the fifteen minute link
 * every other screen of the app uses. That is the whole reason documents do
 * not live on the storage gateway, which is public and permanent, see
 * okf/architecture/offers-and-documents.md, "Documents live in R2".
 *
 * The read is the app's own TanStack Query hook (`useDocumentsPage`), so
 * the tab shows this grid's skeleton first and the rows when they land, the
 * way every app view waits (design-consistency.md, rule 3). Remove is
 * `deleteTransferDocument` behind the shared ConfirmDialog, because a
 * document is a customer's paper and a mis-click is not undoable.
 *
 * The component is rendered by the Media tab with the source's own `open`
 * and `remove` as props, which is the contract of MediaSourceListProps in
 * gatsby-plugin-jaen: it knows nothing about how a document is opened, only
 * which row was clicked.
 */
import {useMemo, useState} from 'react'
import {
  Box,
  Button,
  ButtonGroup,
  chakra,
  HStack,
  Icon,
  Input,
  SimpleGrid,
  Skeleton,
  Stack,
  Text
} from '@chakra-ui/react'
import {FaFilePdf} from '@react-icons/all-files/fa/FaFilePdf'
import {FaFileInvoiceDollar} from '@react-icons/all-files/fa/FaFileInvoiceDollar'
import type {MediaSourceListProps} from 'gatsby-plugin-jaen'
import {useI18nCode} from '../../i18n'
import {getI18nCommon} from '../../locales/i18nCommon'
import {fill, getI18nMediaSources} from '../../locales/i18nMediaSources'
import {
  useDocumentsPage,
  type DocumentKind,
  type DocumentListRow
} from '../../hooks/documents'
import {ConfirmDialog} from '../ConfirmDialog'
import {ErrorBanner} from '../ErrorBanner'
import {toaster} from '../toaster'

/**
 * A native select through Chakra's factory: the list is twelve months and a
 * Chakra menu would be a second popover inside jaen's own tab panel, where
 * the phone has no room for it.
 */
const MonthSelect = chakra('select')

/** How many cards a page of the source holds. */
const PAGE_SIZE = 24

/** 06.09.2026, 14:30 in the account's language, or the raw string. */
const stamp = (iso: string, code: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  try {
    return new Intl.DateTimeFormat(code, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d)
  } catch {
    return d.toISOString()
  }
}

/** 143 kB, 1,4 MB. Bytes are what the row carries and nobody reads bytes. */
const sizeOf = (bytes: number, code: string): string => {
  if (!bytes) return ''
  const kb = bytes / 1024
  const value = kb < 1024 ? kb : kb / 1024
  const unit = kb < 1024 ? 'kB' : 'MB'
  try {
    return `${new Intl.NumberFormat(code, {maximumFractionDigits: value < 10 ? 1 : 0}).format(value)} ${unit}`
  } catch {
    return `${Math.round(value)} ${unit}`
  }
}

/** The month the person may filter by: this one and the eleven before it. */
const recentMonths = (): string[] => {
  const now = new Date()
  return Array.from({length: 12}, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  })
}

export function DocumentsSource({onOpen, onRemove}: MediaSourceListProps) {
  const code = useI18nCode()
  const {strings: s} = getI18nMediaSources(code)
  const {strings: c} = getI18nCommon(code)

  const [kind, setKind] = useState<DocumentKind | undefined>(undefined)
  const [month, setMonth] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [pending, setPending] = useState<DocumentListRow | null>(null)
  const [busy, setBusy] = useState(false)

  const page = useDocumentsPage({
    pageSize: PAGE_SIZE,
    kind,
    month: month || undefined,
    search
  })

  const months = useMemo(recentMonths, [])

  const open = async (row: DocumentListRow) => {
    try {
      await onOpen?.(row.id)
    } catch (err) {
      toaster.error({
        title: s.OpenFailed,
        description: err instanceof Error ? err.message : String(err)
      })
    }
  }

  const remove = async () => {
    if (!pending) return
    setBusy(true)
    try {
      await onRemove?.(pending.id)
      setPending(null)
      await page.refetch()
    } catch (err) {
      toaster.error({
        title: s.RemoveDocumentFailed,
        description: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setBusy(false)
    }
  }

  const chip = (value: DocumentKind | undefined, label: string) => (
    <Button
      key={label}
      size="xs"
      minH={{base: '44px', md: '8'}}
      variant={kind === value ? 'solid' : 'subtle'}
      colorPalette={kind === value ? 'brand' : undefined}
      onClick={() => setKind(value)}
      data-testid={`documents-filter-${value ? value.toLowerCase() : 'all'}`}>
      {label}
    </Button>
  )

  return (
    <Stack gap="4" data-testid="documents-source">
      <HStack gap="2" flexWrap="wrap">
        <ButtonGroup gap="2" attached={false}>
          {chip(undefined, s.FilterAll)}
          {chip('OFFER', s.Kind_OFFER)}
          {chip('INVOICE', s.Kind_INVOICE)}
        </ButtonGroup>

        <MonthSelect
          minH={{base: '44px', md: '8'}}
          px="2"
          borderWidth="1px"
          borderColor="border.emphasized"
          borderRadius="control"
          bg="bg.surface"
          aria-label={s.MonthLabel}
          data-testid="documents-month"
          value={month}
          onChange={event => setMonth(event.target.value)}>
          <option value="">{s.MonthAny}</option>
          {months.map(m => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </MonthSelect>

        <Input
          size="sm"
          maxW="64"
          minH={{base: '44px', md: '8'}}
          placeholder={s.SearchPlaceholder}
          aria-label={c.Search}
          value={search}
          onChange={event => setSearch(event.target.value)}
          data-testid="documents-search"
        />
      </HStack>

      {page.error && !page.unavailable && (
        <ErrorBanner title={s.LoadFailed} message={page.error} />
      )}

      {page.isLoading ? (
        <SimpleGrid columns={{base: 1, sm: 2, md: 3, lg: 4}} gap="3">
          {Array.from({length: 8}, (_, i) => (
            <Skeleton key={i} h="32" borderRadius="surface" />
          ))}
        </SimpleGrid>
      ) : page.unavailable ? (
        <Text
          color="fg.muted"
          textStyle="sm"
          data-testid="documents-unavailable">
          {s.Unavailable}
        </Text>
      ) : page.rows.length === 0 ? (
        <Stack gap="1" data-testid="documents-empty">
          <Text fontWeight="medium">{s.EmptyDocuments}</Text>
          <Text color="fg.muted" textStyle="sm">
            {s.EmptyDocumentsHint}
          </Text>
        </Stack>
      ) : (
        <SimpleGrid columns={{base: 1, sm: 2, md: 3, lg: 4}} gap="3">
          {page.rows.map(row => (
            <Stack
              key={row.id}
              gap="2"
              p="3"
              borderWidth="1px"
              borderColor="border.emphasized"
              borderRadius="surface"
              bg="bg.surface"
              data-testid="document-card"
              data-document-id={row.id}
              data-document-number={row.number ?? ''}>
              <HStack gap="2">
                <Icon color="fg.muted" boxSize="4">
                  {row.kind === 'INVOICE' ? (
                    <FaFileInvoiceDollar />
                  ) : (
                    <FaFilePdf />
                  )}
                </Icon>
                <Text fontWeight="semibold" truncate>
                  {row.number || row.filename}
                </Text>
              </HStack>

              <Stack gap="0.5">
                <Text textStyle="xs" color="fg.muted">
                  {row.kind === 'INVOICE' ? s.Kind_INVOICE : s.Kind_OFFER}
                  {row.code ? ` · ${row.code}` : ''}
                </Text>
                {row.customer && (
                  <Text textStyle="xs" color="fg.muted" truncate>
                    {row.customer}
                  </Text>
                )}
                <Text textStyle="xs" color="fg.muted">
                  {[stamp(row.createdAt, code), sizeOf(row.size, code)]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                <Text textStyle="xs" color="fg.muted" truncate>
                  {row.sentTo
                    ? fill(s.SentTo, {email: row.sentTo})
                    : s.NotSentYet}
                </Text>
              </Stack>

              <HStack gap="2" flexWrap="wrap">
                <Button
                  size="xs"
                  variant="outline"
                  minH={{base: '44px', md: '8'}}
                  onClick={() => void open(row)}
                  data-testid="document-open">
                  {s.Open}
                </Button>
                {onRemove && (
                  <Button
                    size="xs"
                    variant="outline"
                    colorPalette="red"
                    minH={{base: '44px', md: '8'}}
                    onClick={() => setPending(row)}
                    data-testid="document-remove">
                    {s.Remove}
                  </Button>
                )}
              </HStack>
            </Stack>
          ))}
        </SimpleGrid>
      )}

      {!page.unavailable && page.rows.length > 0 && (
        <HStack gap="2" flexWrap="wrap">
          <Text textStyle="xs" color="fg.muted" data-testid="documents-count">
            {fill(s.CountDocuments, {
              total: page.totalCount,
              count: page.rows.length
            })}
          </Text>
          <Box flex="1" />
          <Button
            size="xs"
            variant="outline"
            minH={{base: '44px', md: '8'}}
            disabled={!page.hasPreviousPage}
            onClick={page.prevPage}
            data-testid="documents-prev">
            {c.Previous}
          </Button>
          <Text textStyle="xs" color="fg.muted">
            {fill(s.PageOf, {page: page.currentPage, pages: page.totalPages})}
          </Text>
          <Button
            size="xs"
            variant="outline"
            minH={{base: '44px', md: '8'}}
            disabled={!page.hasNextPage}
            onClick={page.nextPage}
            data-testid="documents-next">
            {c.Next}
          </Button>
        </HStack>
      )}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={remove}
        loading={busy}
        destructive
        title={s.RemoveDocumentTitle}
        body={fill(s.RemoveDocumentBody, {
          name: pending?.number || pending?.filename || ''
        })}
        confirmLabel={s.Remove}
      />
    </Stack>
  )
}
