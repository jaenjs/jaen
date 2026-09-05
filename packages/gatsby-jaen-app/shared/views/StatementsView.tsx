/**
 * The statements of one person: a row per month that has one, with PDF and
 * Excel, and on request the rides the month contains, each under its code,
 * the same lines the tab carries. A return booking is two lines, -1 and -2.
 *
 * Reused in two places. The customer's own page passes the caller's id,
 * the dispatcher's user detail screen passes the user it is showing, and
 * the backend decides whether that pair is allowed: an admin about anybody,
 * everyone else about themselves. `kind` says whether the month is an
 * invoice or a driver settlement, a person who is both gets both rows.
 */
import React, {useMemo, useState} from 'react'
import {Box, Button, ButtonGroup, Flex, Stack, Table, Text} from '@chakra-ui/react'
import {FaFileInvoice} from '@react-icons/all-files/fa/FaFileInvoice'
import {FaFilePdf} from '@react-icons/all-files/fa/FaFilePdf'
import {FaFileExcel} from '@react-icons/all-files/fa/FaFileExcel'
import {FaChevronDown} from '@react-icons/all-files/fa/FaChevronDown'
import {FaChevronUp} from '@react-icons/all-files/fa/FaChevronUp'
import {useI18nCode} from '../i18n'
import {getI18nBookings} from '../locales/i18nBookings'
import {useAppNavigate} from '../navigation'
import {
  downloadStatement,
  useStatementLines,
  useStatementMonths,
  type StatementFormat,
  type StatementKind,
  type StatementMonth
} from '../hooks/finance'
import {EmptyState, ErrorBanner, LoadingOverlay, MoneyText, toaster, PageHeader} from '../components'

type Strings = ReturnType<typeof getI18nBookings>['strings']

/**
 * The rides of one month, code first. Loaded when the row is opened. The
 * code is the link to the ride, the uuid stays in the data attribute.
 */
function StatementLines({
  userId,
  month,
  kind,
  t
}: {
  userId: string | undefined
  month: string
  kind: StatementKind
  t: Strings
}) {
  const navigate = useAppNavigate()
  const {lines, isLoading, error, refetch} = useStatementLines(userId, month, kind, true)

  if (error) return <ErrorBanner message={t.StatementsLinesError} onRetry={refetch} />
  if (!isLoading && lines.length === 0) {
    return (
      <Text textStyle="sm" color="fg.muted" px="3" py="2">
        {t.StatementsLinesEmpty}
      </Text>
    )
  }

  return (
    <Box position="relative" overflowX="auto" minH={isLoading ? '12' : undefined}>
      {isLoading && <LoadingOverlay overlay />}
      <Table.Root size="sm" variant="line">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader w="1">#</Table.ColumnHeader>
            <Table.ColumnHeader>{t.StatementsColCode}</Table.ColumnHeader>
            <Table.ColumnHeader>{t.StatementsColDate}</Table.ColumnHeader>
            <Table.ColumnHeader>{t.StatementsColRoute}</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">{t.StatementsColAmount}</Table.ColumnHeader>
            {kind === 'DRIVER' && <Table.ColumnHeader textAlign="end">{t.StatementsColShare}</Table.ColumnHeader>}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {lines.map(line => (
            <Table.Row
              key={line.transferId}
              data-transfer-id={line.transferId}
              cursor="pointer"
              _hover={{bg: 'bg.subtle'}}
              onClick={() => navigate(`/transfers/${line.code || line.transferId}`)}>
              <Table.Cell color="fg.muted" fontVariantNumeric="tabular-nums">
                {line.nr}
              </Table.Cell>
              <Table.Cell fontFamily="mono" fontWeight="medium" whiteSpace="nowrap">
                {line.code}
              </Table.Cell>
              <Table.Cell whiteSpace="nowrap" fontVariantNumeric="tabular-nums">
                {line.date} {line.time}
              </Table.Cell>
              <Table.Cell color="fg.muted" maxW="sm">
                <Text lineClamp={1}>
                  {line.pickup} → {line.dropoff}
                </Text>
              </Table.Cell>
              <Table.Cell textAlign="end">
                <MoneyText value={line.amount} />
              </Table.Cell>
              {kind === 'DRIVER' && (
                <Table.Cell textAlign="end">
                  <MoneyText value={line.share} />
                </Table.Cell>
              )}
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  )
}

export interface StatementsViewProps {
  /** Whose statements. The backend refuses a user that is not the caller's own unless the caller is an admin. */
  userId: string | undefined
  /** Without the page heading, for embedding in another screen. */
  embedded?: boolean
}

export function StatementsView({userId, embedded = false}: StatementsViewProps) {
  const code = useI18nCode()
  const {strings: t} = getI18nBookings(code)
  const {months, isLoading, error, refetch} = useStatementMonths(userId)
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const rowKey = (row: StatementMonth) => `${row.kind}-${row.month}`
  const toggle = (row: StatementMonth) => setOpen(prev => (prev === rowKey(row) ? null : rowKey(row)))

  const monthLabel = useMemo(() => {
    const format = new Intl.DateTimeFormat(code, {month: 'long', year: 'numeric'})
    return (month: string) => {
      const [y, m] = month.split('-').map(Number)
      if (!y || !m) return month
      return format.format(new Date(y, m - 1, 1))
    }
  }, [code])

  const kindLabel = (kind: StatementMonth['kind']) =>
    kind === 'DRIVER' ? t.StatementsKindDRIVER : t.StatementsKindCUSTOMER

  const download = async (row: StatementMonth, format: StatementFormat) => {
    if (!userId) return
    const key = `${row.kind}:${row.month}:${format}`
    setBusy(key)
    try {
      await downloadStatement(userId, row.month, format, row.kind)
    } catch (err) {
      toaster.error({
        title: t.StatementsDownloadError,
        description: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setBusy(null)
    }
  }

  const buttons = (row: StatementMonth) => (
    <ButtonGroup size="sm" variant="outline">
      <Button
        variant="ghost"
        onClick={() => toggle(row)}
        aria-expanded={open === rowKey(row)}>
        {open === rowKey(row) ? <FaChevronUp /> : <FaChevronDown />}{' '}
        {open === rowKey(row) ? t.StatementsLinesHide : t.StatementsLinesShow}
      </Button>
      <Button
        onClick={() => void download(row, 'pdf')}
        loading={busy === `${row.kind}:${row.month}:pdf`}
        disabled={busy !== null && busy !== `${row.kind}:${row.month}:pdf`}>
        <FaFilePdf /> {t.StatementsDownloadPdf}
      </Button>
      <Button
        onClick={() => void download(row, 'xlsx')}
        loading={busy === `${row.kind}:${row.month}:xlsx`}
        disabled={busy !== null && busy !== `${row.kind}:${row.month}:xlsx`}>
        <FaFileExcel /> {t.StatementsDownloadXlsx}
      </Button>
    </ButtonGroup>
  )

  const body = (
    <Box position="relative" bg="bg.surface" borderWidth="1px" borderColor="border.default" rounded="lg" overflow="hidden">
      {isLoading && <LoadingOverlay overlay />}
      {!isLoading && !error && months.length === 0 ? (
        <EmptyState title={t.StatementsEmpty} description={t.StatementsEmptyHint} icon={<FaFileInvoice />} />
      ) : (
        <>
          <Box display={{base: 'none', md: 'block'}} overflowX="auto">
            <Table.Root size="md">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>{t.StatementsColMonth}</Table.ColumnHeader>
                  <Table.ColumnHeader>{t.StatementsColKind}</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end" />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {months.map(row => (
                  <React.Fragment key={rowKey(row)}>
                    <Table.Row>
                      <Table.Cell fontWeight="medium" whiteSpace="nowrap">
                        {monthLabel(row.month)}
                      </Table.Cell>
                      <Table.Cell color="fg.muted">{kindLabel(row.kind)}</Table.Cell>
                      <Table.Cell textAlign="end">
                        <Flex justify="end">{buttons(row)}</Flex>
                      </Table.Cell>
                    </Table.Row>
                    {open === rowKey(row) && (
                      <Table.Row>
                        <Table.Cell colSpan={3} p="0" bg="bg.subtle">
                          <StatementLines userId={userId} month={row.month} kind={row.kind} t={t} />
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </React.Fragment>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>

          <Stack display={{base: 'flex', md: 'none'}} gap="3" p="3">
            {months.map(row => (
              <Box key={rowKey(row)} borderWidth="1px" borderColor="border.default" rounded="md" p="3" bg="bg.canvas">
                <Text fontWeight="medium">{monthLabel(row.month)}</Text>
                <Text textStyle="sm" color="fg.muted" mb="3">
                  {kindLabel(row.kind)}
                </Text>
                {buttons(row)}
                {open === rowKey(row) && (
                  <Box mt="3" mx="-3" mb="-3" borderTopWidth="1px" borderColor="border.default" bg="bg.subtle">
                    <StatementLines userId={userId} month={row.month} kind={row.kind} t={t} />
                  </Box>
                )}
              </Box>
            ))}
          </Stack>
        </>
      )}
    </Box>
  )

  if (embedded) {
    return (
      <Stack gap="3">
        {error && <ErrorBanner message={error} onRetry={refetch} />}
        {body}
      </Stack>
    )
  }

  return (
    <Box p={{base: '4', md: '6'}} maxW="full">
      <Stack gap="6">
        <PageHeader title={t.StatementsHeading} subtitle={t.StatementsSubtitle} />
        {error && <ErrorBanner message={error} onRetry={refetch} />}
        {body}
      </Stack>
    </Box>
  )
}
