/**
 * The documents of a ride, the offer and the invoice in the brand's private
 * bucket, and the writes that move the customer's status with them. See
 * okf/architecture/offers-and-documents.md, "Documents live in R2" and
 * "The invoice, uploaded, not generated".
 *
 * A document is never linked by a bucket URL. `documentUrl(args:{id})`
 * answers a signed link that lives fifteen minutes, so a screen asks for
 * it the moment somebody clicks and opens what comes back, see openDocument.
 * The list is a query of the one client under `['documents', transferId]`,
 * invalidated by every write here.
 *
 * The status writes are the offer backend's: `sendInvoice(args:
 * {documentId})` mails the uploaded invoice and sets INVOICED, `markPaid
 * (args:{transferId})` sets PAID, and an admin's confirmation sets
 * CONFIRMED without the customer's link. Each answers the ride, and rather
 * than trust its shape the ride is read again through fetchTransfer and
 * remembered on every screen that shows it. The upload is the store's
 * `uploadTransferDocument`, base64 in the mutation, which is what a 10 MB
 * PDF fits in comfortably.
 *
 * The admin's confirmation is `confirmOffer(args:{transferId})`, the
 * customer's link is the same field with `token`, see pylon/src/offers.
 */
import {useCallback} from 'react'
import {fetchGraphQL} from '../../client/limosen'
import {
  cachedRead,
  invalidateTransfers,
  keys,
  queryClient,
  useAppQuery
} from './query'
import {call, invalidateOffers, isUnknownField} from './offers'
import {fetchTransfer, rememberTransfer, type TransferRow} from './transfers'

// --------------- The row ---------------

export type DocumentKind = 'OFFER' | 'INVOICE'

export interface TransferDocument {
  /** `document:<uuid>`, the key documentUrl takes. */
  id: string
  transferId: string
  kind: DocumentKind
  /** AN-260001 for an offer, whatever the invoice carries, or undefined. */
  number?: string
  filename: string
  contentType: string
  /** Bytes. */
  size: number
  /** de | en | tr | ar. */
  language: string
  createdAt: string
  updatedAt?: string
  /** When and to whom the document was last mailed, written by the send. */
  sentAt?: string
  sentTo?: string
  /** The offer's JSON, for a generated document. */
  data?: unknown
}

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length ? v : undefined

export const mapDocument = (node: any): TransferDocument => ({
  id: String(node?.id ?? ''),
  transferId: String(node?.transferId ?? ''),
  kind: node?.kind === 'INVOICE' ? 'INVOICE' : 'OFFER',
  number: str(node?.number),
  filename: str(node?.filename) ?? '',
  contentType: str(node?.contentType) ?? 'application/pdf',
  size: typeof node?.size === 'number' ? node.size : 0,
  language: str(node?.language) ?? 'de',
  createdAt: str(node?.createdAt) ?? '',
  updatedAt: str(node?.updatedAt),
  sentAt: str(node?.sentAt),
  sentTo: str(node?.sentTo),
  data: node?.data && typeof node.data === 'object' ? node.data : undefined
})

const DOCUMENT_FIELDS =
  '{ id transferId kind number filename contentType size language createdAt updatedAt sentAt sentTo }'

/** The offer's validity, from its stored JSON, for the timeline. */
const DOCUMENT_FIELDS_WITH_DATA =
  '{ id transferId kind number filename contentType size language createdAt updatedAt sentAt sentTo data }'

// --------------- The list ---------------

export const documentsKey = (transferId: string) =>
  ['documents', transferId] as const

export const invalidateDocuments = (transferId?: string) =>
  queryClient.invalidateQueries({
    queryKey: transferId ? documentsKey(transferId) : ['documents']
  })

const EMPTY: TransferDocument[] = []

/**
 * The documents of one ride, by id or code. A schema without the store,
 * which is a pylon from before 1.2.0, answers an empty list rather than an
 * error: the ride's page is not broken by a field it cannot have yet.
 */
export const readDocuments = async (
  transferId: string
): Promise<TransferDocument[]> => {
  try {
    const rows: any[] =
      (await call(
        'transferDocuments',
        {args: {transferId}},
        DOCUMENT_FIELDS_WITH_DATA
      )) ?? []
    return rows.map(mapDocument)
  } catch (err) {
    // The pylon from before the document store: no documents, not an error.
    if (isUnknownField(err)) return EMPTY
    throw err
  }
}

export function useTransferDocuments(transferId: string | undefined) {
  const key = transferId ?? ''
  const {
    query: q,
    isLoading,
    error,
    refetch
  } = useAppQuery({
    queryKey: documentsKey(key),
    queryFn: () => readDocuments(key),
    enabled: !!transferId
  })
  const documents = q.data ?? EMPTY
  const offer = documents.find(d => d.kind === 'OFFER')
  const invoice = documents.find(d => d.kind === 'INVOICE')

  /** A document as a write answered it, into the list at once. */
  const remember = useCallback(
    (doc: TransferDocument) => {
      queryClient.setQueryData<TransferDocument[]>(documentsKey(key), held => {
        const rows = held ?? []
        return rows.some(d => d.kind === doc.kind)
          ? rows.map(d => (d.kind === doc.kind ? doc : d))
          : [...rows, doc]
      })
    },
    [key]
  )

  return {documents, offer, invoice, isLoading, error, refetch, remember}
}

// --------------- The link ---------------

/** A signed link to the document, good for fifteen minutes from now. */
export const fetchDocumentUrl = async (id: string): Promise<string> => {
  const url = await call('documentUrl', {args: {id}}, '')
  if (typeof url !== 'string' || !url) throw new Error('no link in the answer')
  return url
}

/**
 * Open a document in a new tab. The tab is opened on the click, before the
 * link is fetched, so a popup blocker sees a user gesture, and it is pointed
 * at the signed link when that arrives. A refusal closes the tab again and
 * throws, so the screen can say why.
 */
export const openDocument = async (id: string): Promise<void> => {
  const tab = typeof window !== 'undefined' ? window.open('', '_blank') : null
  try {
    const url = await fetchDocumentUrl(id)
    if (tab) tab.location.href = url
    else if (typeof window !== 'undefined') window.location.href = url
  } catch (err) {
    tab?.close()
    throw err
  }
}

// --------------- The upload ---------------

export const MAX_INVOICE_BYTES = 10 * 1024 * 1024

const fileBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.readAsDataURL(file)
  })

/** The bytes start with %PDF, whatever the file's name says. */
const looksLikePdf = async (file: Blob): Promise<boolean> => {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  return (
    head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46
  )
}

export class InvoiceFileError extends Error {
  constructor(public readonly reason: 'type' | 'size') {
    super(reason === 'size' ? 'file too large' : 'not a PDF')
    this.name = 'InvoiceFileError'
  }
}

/**
 * The invoice as the ride's INVOICE document. One row per ride and kind on
 * the store, so a second upload replaces the file, keeps the row and clears
 * the sent instant. The number is what the invoice carries, typed by the
 * dispatcher, optional.
 */
export const uploadInvoice = async (
  transfer: {id: string; language?: string},
  file: File,
  number?: string
): Promise<TransferDocument> => {
  if (file.size > MAX_INVOICE_BYTES) throw new InvoiceFileError('size')
  if (!(await looksLikePdf(file))) throw new InvoiceFileError('type')
  const node = await call(
    'uploadTransferDocument',
    {
      args: {
        transferId: transfer.id,
        kind: 'INVOICE',
        contentBase64: await fileBase64(file),
        filename: file.name || 'invoice.pdf',
        contentType: 'application/pdf',
        number: number?.trim() || undefined,
        language: transfer.language || undefined
      }
    },
    DOCUMENT_FIELDS,
    'mutation'
  )
  const doc = mapDocument(node)
  if (!doc.id) throw new Error('no document id in the answer')
  await invalidateDocuments(transfer.id)
  return doc
}

export const deleteDocument = async (doc: {
  id: string
  transferId: string
}): Promise<void> => {
  await call('deleteTransferDocument', {args: {id: doc.id}}, '', 'mutation')
  await invalidateDocuments(doc.transferId)
}

// --------------- The status writes ---------------

/** The mutation fields the deployed schema carries, asked once per session through the client. */
const readMutationNames = async (): Promise<string[]> => {
  const result: any = await fetchGraphQL(
    {
      query: 'query { __schema { mutationType { fields { name } } } }',
      variables: undefined,
      operationName: undefined
    },
    {}
  )
  const fields = result?.data?.__schema?.mutationType?.fields
  return Array.isArray(fields)
    ? fields.map((f: any) => String(f?.name)).filter(Boolean)
    : []
}

const mutationNames = async (): Promise<Set<string>> => {
  try {
    return new Set(
      await cachedRead(keys.schema('mutationNames'), readMutationNames)
    )
  } catch {
    return new Set()
  }
}

/** After a status write: the ride read fresh and remembered on every screen, the lists read again. */
const settle = async (transferId: string): Promise<TransferRow | null> => {
  const row = await fetchTransfer(transferId)
  if (row) rememberTransfer(row)
  void invalidateTransfers()
  void invalidateOffers()
  void invalidateDocuments(transferId)
  return row
}

/**
 * One status write. The answer's shape is the backend's business (the ride,
 * a boolean, the document), so only `__typename` is asked of an object and
 * nothing of a scalar, which the introspected mutation type decides, and
 * the ride is then read again.
 */
const statusWrite = async (
  field: string,
  args: Record<string, unknown>,
  transferId: string
): Promise<TransferRow | null> => {
  const names = await mutationNames()
  // An endpoint that will not introspect is taken to answer an object.
  const object = names.size === 0 || names.has(field)
  await call(field, {args}, object ? '{ __typename }' : '', 'mutation')
  return settle(transferId)
}

/** Mails the uploaded invoice in the booking's language and sets INVOICED. */
export const sendInvoice = (doc: {id: string; transferId: string}) =>
  statusWrite('sendInvoice', {documentId: doc.id}, doc.transferId)

/** INVOICED to PAID, with the instant. */
export const markPaid = (transferId: string) =>
  statusWrite('markPaid', {transferId}, transferId)

/**
 * OFFERED to CONFIRMED by the dispatcher, the customer having said yes on
 * the phone: the same `confirmOffer` the customer's link calls, with the
 * ride's id in place of the token, which the resolver takes from an admin
 * only.
 */
export const confirmAsAdmin = (
  transferId: string
): Promise<TransferRow | null> =>
  statusWrite('confirmOffer', {transferId}, transferId)
