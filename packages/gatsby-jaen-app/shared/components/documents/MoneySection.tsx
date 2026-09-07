/**
 * The money side of one ride on the detail page: the customer's status as
 * a timeline with its instants, the offer and the invoice as documents,
 * and the dispatcher's writes on them. okf/architecture/offers-and-documents.md.
 *
 * The timeline is the happy path NEW, OFFERED, CONFIRMED, INVOICED, PAID,
 * each step with the instant the pylon wrote (`offeredAt` to `paidAt`),
 * the document's own `sentAt` standing in where the column is not there
 * yet, and DECLINED as the branch drawn in red after OFFERED. The
 * documents are read through hooks/documents.ts and opened through
 * documentUrl, never by a bucket link.
 *
 * The dispatcher's actions, offered by the status alone and refused by the
 * backend for real: "Bestätigen" while OFFERED (the customer said yes on
 * the phone), the dropzone "Rechnung hochladen" from CONFIRMED on (PDF
 * only, one file, 10 MB, a new file replaces the row's), "Rechnung senden"
 * once an invoice is there, "Als bezahlt markieren" while INVOICED.
 * "Angebot senden" lives in the page header beside the other actions and
 * opens the OfferDialog, see ../../views/TransferDetailView.tsx.
 */
import {useEffect, useMemo, useRef, useState} from 'react'
import {
  Box,
  Button,
  HStack,
  Input,
  Stack,
  Text,
  Timeline
} from '@chakra-ui/react'
import {uploadFile} from 'jaen'
import {MediaDropzone, type MediaDropzoneControl} from 'gatsby-plugin-jaen'
import {FaCheck} from '@react-icons/all-files/fa/FaCheck'
import {FaTimes} from '@react-icons/all-files/fa/FaTimes'
import {FaFilePdf} from '@react-icons/all-files/fa/FaFilePdf'
import {useI18nCode} from '../../i18n'
import {fill, getI18nOffers, type OffersStrings} from '../../locales/i18nOffers'
import {isOfflineError} from '../../offline'
import {
  asCustomerStatus,
  canUploadInvoice,
  CUSTOMER_STEPS,
  INSTANT_OF,
  isUnknownField,
  type CustomerStatus
} from '../../hooks/offers'
import {
  assertInvoiceFile,
  confirmAsAdmin,
  gatewayFileOf,
  InvoiceFileError,
  markPaid,
  MAX_INVOICE_BYTES,
  openDocument,
  sendInvoice,
  uploadInvoice,
  useTransferDocuments,
  type TransferDocument
} from '../../hooks/documents'
import type {TransferRow} from '../../hooks/transfers'
import {ConfirmDialog} from '../ConfirmDialog'
import {ErrorBanner} from '../ErrorBanner'
import {toaster} from '../toaster'
import {CustomerStatusBadge} from '../CustomerStatusBadge'

// --------------- Words ---------------

const useWords = () => {
  const code = useI18nCode()
  return useMemo(() => ({code, s: getI18nOffers(code).strings}), [code])
}

/** 06.09.2026, 14:30 in the account's language, or nothing. */
const stamp = (iso: string | undefined, code: string): string => {
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

/** The reason in words: offline, the two refusals apart, a field the pylon does not have, else the backend's own. */
const reasonOf = (err: unknown, s: OffersStrings): string => {
  if (isOfflineError(err)) return (err as Error).message
  const code = (err as {code?: unknown})?.code
  if (code === 'FORBIDDEN') return s.Forbidden
  if (code === 'AUTH_REQUIRED') return s.AuthRequired
  if (isUnknownField(err)) return s.NotDeployed
  if (err instanceof Error && err.message) return err.message
  return s.MarkPaidFailed
}

// --------------- The timeline ---------------

interface Step {
  status: CustomerStatus
  at?: string
  detail?: string
  state: 'done' | 'current' | 'pending' | 'declined'
}

const stepsOf = (
  transfer: TransferRow,
  offer: TransferDocument | undefined,
  invoice: TransferDocument | undefined,
  s: OffersStrings,
  code: string
): Step[] => {
  const status = asCustomerStatus(transfer.customerStatus) ?? 'NEW'
  const instant = (st: CustomerStatus): string | undefined => {
    if (st === 'NEW') return transfer.requestedAt
    const held = transfer[INSTANT_OF[st]]
    if (held) return held
    if (st === 'OFFERED') return offer?.sentAt
    if (st === 'INVOICED') return invoice?.sentAt
    return undefined
  }
  const detail = (st: CustomerStatus): string | undefined => {
    if (st === 'OFFERED') {
      // The validity the pylon wrote wins, the offer's stored JSON stands in for an older schema.
      const stored = (
        offer?.data as {meta?: {validUntil?: unknown}} | undefined
      )?.meta?.validUntil
      const validUntil = transfer.offerValidUntil
        ? stamp(transfer.offerValidUntil, code)
        : typeof stored === 'string'
          ? stored
          : ''
      const parts = [
        offer?.sentTo ? fill(s.SentTo, {email: offer.sentTo}) : '',
        validUntil ? fill(s.OfferValidUntil, {date: validUntil}) : ''
      ].filter(Boolean)
      return parts.join(', ') || undefined
    }
    if (st === 'INVOICED' && invoice?.sentTo)
      return fill(s.SentTo, {email: invoice.sentTo})
    return undefined
  }
  if (status === 'DECLINED') {
    const offered = instant('OFFERED')
    const path: CustomerStatus[] = offered
      ? ['NEW', 'OFFERED', 'DECLINED']
      : ['NEW', 'DECLINED']
    return path.map(st => ({
      status: st,
      at: stamp(instant(st), code) || undefined,
      detail: detail(st),
      state: st === 'DECLINED' ? 'declined' : 'done'
    }))
  }
  const reached = CUSTOMER_STEPS.indexOf(status)
  return CUSTOMER_STEPS.map((st, i) => ({
    status: st,
    at: stamp(instant(st), code) || undefined,
    detail: detail(st),
    state: i < reached ? 'done' : i === reached ? 'current' : 'pending'
  }))
}

function StatusTimeline({steps, s}: {steps: Step[]; s: OffersStrings}) {
  return (
    <Timeline.Root size="sm" variant="subtle" data-testid="customer-timeline">
      {steps.map((step, i) => {
        const palette =
          step.state === 'declined'
            ? 'red'
            : step.state === 'pending'
              ? 'gray'
              : 'brand'
        return (
          <Timeline.Item
            key={step.status}
            colorPalette={palette}
            data-step={step.status}
            data-state={step.state}>
            <Timeline.Connector>
              <Timeline.Separator />
              <Timeline.Indicator
                bg={
                  step.state === 'pending' ? 'bg.muted' : 'colorPalette.solid'
                }
                color={
                  step.state === 'pending'
                    ? 'fg.muted'
                    : 'colorPalette.contrast'
                }>
                {step.state === 'declined' ? (
                  <FaTimes size={10} />
                ) : step.state === 'pending' ? (
                  i + 1
                ) : (
                  <FaCheck size={10} />
                )}
              </Timeline.Indicator>
            </Timeline.Connector>
            <Timeline.Content pb={i === steps.length - 1 ? '0' : undefined}>
              <Timeline.Title
                fontWeight={step.state === 'current' ? 'semibold' : 'medium'}
                color={step.state === 'pending' ? 'fg.muted' : undefined}>
                {s[`Step_${step.status}`]}
              </Timeline.Title>
              <Timeline.Description data-instant={step.at ?? ''}>
                {step.at ?? (step.state === 'pending' ? s.StepPending : '')}
                {step.detail ? ` · ${step.detail}` : ''}
              </Timeline.Description>
            </Timeline.Content>
          </Timeline.Item>
        )
      })}
    </Timeline.Root>
  )
}

// --------------- The documents ---------------

function DocumentRow({
  doc,
  s,
  code
}: {
  doc: TransferDocument
  s: OffersStrings
  code: string
}) {
  const [opening, setOpening] = useState(false)
  const open = async () => {
    setOpening(true)
    try {
      await openDocument(doc.id)
    } catch (err) {
      toaster.error({title: s.OpenFailed, description: reasonOf(err, s)})
    } finally {
      setOpening(false)
    }
  }
  return (
    <HStack
      justify="space-between"
      gap="3"
      flexWrap="wrap"
      data-testid={`document-${doc.kind.toLowerCase()}`}
      data-document-id={doc.id}>
      <Box minW="0">
        <Text textStyle="sm" fontWeight="medium">
          {s[`Doc_${doc.kind}`]}
          {doc.number ? ` ${doc.number}` : ''}
        </Text>
        <Text textStyle="xs" color="fg.muted" truncate>
          {doc.sentAt && doc.sentTo
            ? fill(s.SentAt, {date: stamp(doc.sentAt, code), email: doc.sentTo})
            : s.NotSentYet}
          {doc.filename ? ` · ${doc.filename}` : ''}
        </Text>
      </Box>
      <Button
        size="sm"
        variant="outline"
        minH={{base: '44px', md: '8'}}
        loading={opening}
        onClick={() => void open()}>
        <FaFilePdf /> {s.OpenPdf}
      </Button>
    </HStack>
  )
}

// --------------- The section ---------------

export interface MoneySectionProps {
  transfer: TransferRow
  /** The dispatcher: the writes are offered. */
  editable: boolean
  onChanged: (row: TransferRow) => void
  /** Bumped by the parent after the offer dialog sent, so the documents are read again. */
  documentsVersion?: number
}

export function MoneySection({
  transfer,
  editable,
  onChanged,
  documentsVersion = 0
}: MoneySectionProps) {
  const {code, s} = useWords()
  const {
    documents,
    offer,
    invoice,
    error: docsError,
    refetch,
    remember
  } = useTransferDocuments(transfer.id)
  const status = asCustomerStatus(transfer.customerStatus)

  useEffect(() => {
    if (documentsVersion > 0) refetch()
  }, [documentsVersion, refetch])

  const [busy, setBusy] = useState<
    'confirm' | 'upload' | 'send' | 'paid' | null
  >(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [paidOpen, setPaidOpen] = useState(false)
  const [number, setNumber] = useState('')
  // The shared dropzone keeps the accepted file in its own state. Clearing
  // it after the upload needs the machine, so the control comes back through
  // a ref, and without the clear a second drop of the same file does nothing.
  const dropzone = useRef<MediaDropzoneControl | null>(null)

  const steps = useMemo(
    () => stepsOf(transfer, offer, invoice, s, code),
    [transfer, offer, invoice, s, code]
  )

  const run = async (
    kind: NonNullable<typeof busy>,
    work: () => Promise<TransferRow | null>,
    done: string
  ) => {
    setBusy(kind)
    setFailure(null)
    try {
      const row = await work()
      if (row) onChanged(row)
      toaster.success({title: done})
      return true
    } catch (err) {
      setFailure(reasonOf(err, s))
      return false
    } finally {
      setBusy(null)
    }
  }

  const confirm = async () => {
    if (await run('confirm', () => confirmAsAdmin(transfer.id), s.Confirmed))
      setConfirmOpen(false)
  }

  const paid = async () => {
    if (await run('paid', () => markPaid(transfer.id), s.MarkedPaid))
      setPaidOpen(false)
  }

  const send = () => {
    if (!invoice) return
    void run('send', () => sendInvoice(invoice), s.InvoiceSent)
  }

  /**
   * The dropped invoice: checked here, then uploaded to the storage gateway
   * with jaen's own `uploadFile`, the same call a page image and a car's
   * picture go through (okf/architecture/media.md, "Everything uploads to
   * the gateway"), and only then is the pylon told what came back. No file
   * bytes reach the pylon at all.
   */
  const upload = async (file: File) => {
    setBusy('upload')
    setFailure(null)
    try {
      await assertInvoiceFile(file)
      const uploaded = await uploadFile(file, file.name || 'invoice.pdf')
      const doc = await uploadInvoice(
        {id: transfer.id, language: transfer.language},
        gatewayFileOf(uploaded, file),
        number
      )
      remember(doc)
      toaster.success({title: fill(s.Uploaded, {filename: doc.filename})})
      dropzone.current?.clear()
    } catch (err) {
      setFailure(
        err instanceof InvoiceFileError
          ? s.UploadRejected
          : `${s.UploadFailed}: ${reasonOf(err, s)}`
      )
    } finally {
      setBusy(null)
    }
  }

  const uploadEnabled = editable && canUploadInvoice(status)
  const canSend =
    editable &&
    !!invoice &&
    (status === 'CONFIRMED' || status === 'INVOICED' || status === 'PAID')

  return (
    <Box
      rounded="surface"
      borderWidth="1px"
      borderColor="border.default"
      bg="bg.surface"
      p="4"
      id="offer-timeline"
      data-testid="money-section">
      <HStack justify="space-between" mb="3" flexWrap="wrap" gap="2">
        <Text
          textStyle="xs"
          fontWeight="semibold"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider">
          {s.TimelineTitle}
        </Text>
        <CustomerStatusBadge status={transfer.customerStatus} size="sm" />
      </HStack>

      <Box
        display="grid"
        gridTemplateColumns={{base: '1fr', lg: '1fr 1fr'}}
        gap="6">
        <StatusTimeline steps={steps} s={s} />

        <Stack gap="4">
          {(failure || docsError) && (
            <ErrorBanner
              message={failure ?? docsError ?? ''}
              onRetry={docsError ? refetch : undefined}
            />
          )}

          <Stack gap="2">
            <Text
              textStyle="xs"
              fontWeight="semibold"
              color="fg.muted"
              textTransform="uppercase"
              letterSpacing="wider">
              {s.DocumentsTitle}
            </Text>
            {documents.length === 0 ? (
              <Text textStyle="sm" color="fg.muted">
                {s.NoDocuments}
              </Text>
            ) : (
              documents.map(doc => (
                <DocumentRow key={doc.id} doc={doc} s={s} code={code} />
              ))
            )}
          </Stack>

          {editable && status === 'OFFERED' && (
            <Button
              size="sm"
              colorPalette="brand"
              alignSelf="flex-start"
              minH={{base: '44px', md: '8'}}
              onClick={() => setConfirmOpen(true)}
              data-testid="confirm-as-admin">
              <FaCheck /> {s.ConfirmAsAdmin}
            </Button>
          )}

          {editable && (
            <Stack
              gap="2"
              data-testid="invoice-upload"
              data-enabled={uploadEnabled ? 'true' : 'false'}>
              <Text
                textStyle="xs"
                fontWeight="semibold"
                color="fg.muted"
                textTransform="uppercase"
                letterSpacing="wider">
                {s.UploadInvoice}
              </Text>
              {uploadEnabled ? (
                <>
                  {/*
                    jaen's own upload control, the one the Media tab drops
                    on: the invoice used to have a dropzone of its own that
                    looked and behaved differently for the same gesture, and
                    the owner asked for one library and one control
                    (okf/architecture/media.md). It carries
                    MEDIA_DROPZONE_TESTID, and the outer element keeps
                    invoice-dropzone so a check can name this one.
                  */}
                  <MediaDropzone
                    accept="application/pdf"
                    maxFiles={1}
                    maxFileSize={MAX_INVOICE_BYTES}
                    uploading={busy === 'upload'}
                    controlRef={dropzone}
                    rootTestId="invoice-dropzone"
                    label={s.UploadInvoice}
                    uploadingLabel={s.Uploading}
                    hint={invoice ? s.UploadReplaceHint : s.UploadHint}
                    onReject={() => setFailure(s.UploadRejected)}
                    onUpload={files => {
                      const file = files[0]
                      if (file) void upload(file)
                    }}
                  />
                  <HStack gap="2" flexWrap="wrap">
                    <Input
                      size="sm"
                      maxW="56"
                      placeholder={s.InvoiceNumberPlaceholder}
                      aria-label={s.InvoiceNumberLabel}
                      value={number}
                      onChange={e => setNumber(e.target.value)}
                      data-testid="invoice-number"
                    />
                    {canSend && (
                      <Button
                        size="sm"
                        colorPalette="brand"
                        minH={{base: '44px', md: '8'}}
                        loading={busy === 'send'}
                        disabled={busy !== null && busy !== 'send'}
                        onClick={send}
                        data-testid="send-invoice">
                        {invoice?.sentAt ? s.SendInvoiceAgain : s.SendInvoice}
                      </Button>
                    )}
                    {status === 'INVOICED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        colorPalette="green"
                        minH={{base: '44px', md: '8'}}
                        disabled={busy !== null}
                        onClick={() => setPaidOpen(true)}
                        data-testid="mark-paid">
                        {s.MarkPaid}
                      </Button>
                    )}
                  </HStack>
                </>
              ) : (
                <Text textStyle="sm" color="fg.muted">
                  {s.NotBeforeConfirmed}
                </Text>
              )}
            </Stack>
          )}
        </Stack>
      </Box>

      {editable && (
        <>
          <ConfirmDialog
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={confirm}
            title={s.ConfirmAsAdminTitle}
            body={s.ConfirmAsAdminBody}
            confirmLabel={s.ConfirmAsAdmin}
            loading={busy === 'confirm'}
          />
          <ConfirmDialog
            open={paidOpen}
            onClose={() => setPaidOpen(false)}
            onConfirm={paid}
            title={s.MarkPaidTitle}
            body={s.MarkPaidBody}
            confirmLabel={s.MarkPaid}
            loading={busy === 'paid'}
          />
        </>
      )}
    </Box>
  )
}
