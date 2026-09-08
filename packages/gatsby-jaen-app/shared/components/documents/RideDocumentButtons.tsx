/**
 * The offer and the invoice of a ride as buttons, drawn only where the
 * document exists (okf/architecture/customer-experience.md, section 5):
 * never a placeholder, never a button that answers NOT_FOUND. Nothing is
 * rendered for a ride that has neither, so a table cell or a card stays
 * empty rather than showing a disabled control. The click fetches the
 * signed link through documentUrl and opens it, the way the booking detail
 * does. The monthly statement's files are a different thing and keep their
 * own buttons, worded "Monatsabrechnung", in StatementsView.
 *
 * Used by the bookings list, the offers screen and the statement's rides.
 * The word on the button is the kind, "Angebot" or "Rechnung", the number
 * sits in the title, so a row with both reads as two documents and not as
 * two copies of one.
 */
import {useState} from 'react'
import {Button, HStack, type StackProps} from '@chakra-ui/react'
import {FaFilePdf} from '@react-icons/all-files/fa/FaFilePdf'
import {useI18nCode} from '../../i18n'
import {getI18nOffers} from '../../locales/i18nOffers'
import {openDocument, type DocumentKind} from '../../hooks/documents'
import {toaster} from '../toaster'
import {failureText} from '../../errors'

/** What a button needs of a document: the id documentUrl takes, the kind, the number for the title. */
export interface DocumentRef {
  id: string
  kind: DocumentKind
  number?: string
}

export interface RideDocumentButtonsProps extends Omit<StackProps, 'children'> {
  docs?: {offer?: DocumentRef; invoice?: DocumentRef}
  size?: 'xs' | 'sm'
}

function DocumentButton({doc, size}: {doc: DocumentRef; size: 'xs' | 'sm'}) {
  const code = useI18nCode()
  const {strings: so} = getI18nOffers(code)
  const [opening, setOpening] = useState(false)
  const open = async (e: React.MouseEvent) => {
    // The row underneath opens the ride on a click, this click opens the file.
    e.stopPropagation()
    setOpening(true)
    try {
      await openDocument(doc.id)
    } catch (err) {
      toaster.error({
        title: so.OpenFailed,
        description: failureText(err)
      })
    } finally {
      setOpening(false)
    }
  }
  const label = doc.kind === 'INVOICE' ? so.Doc_INVOICE : so.Doc_OFFER
  return (
    <Button
      size={size}
      variant="outline"
      minH={{base: '44px', md: size === 'xs' ? '6' : '8'}}
      loading={opening}
      onClick={e => void open(e)}
      title={doc.number ? `${label} ${doc.number}` : label}
      data-testid={`document-${doc.kind.toLowerCase()}`}>
      <FaFilePdf /> {label}
    </Button>
  )
}

export function RideDocumentButtons({
  docs,
  size = 'xs',
  ...rest
}: RideDocumentButtonsProps) {
  const offer = docs?.offer
  const invoice = docs?.invoice
  if (!offer && !invoice) return null
  return (
    <HStack gap="2" flexWrap="wrap" {...rest}>
      {offer && <DocumentButton doc={offer} size={size} />}
      {invoice && <DocumentButton doc={invoice} size={size} />}
    </HStack>
  )
}
