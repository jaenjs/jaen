/**
 * Registers the app's two folders on jaen's Media tree, the way
 * useFrameMenu registers the app's navigation on the frame's menus.
 *
 * There is one gallery and it is jaen's (okf/architecture/media.md, "One
 * gallery, jaen's"): no tab, no chrome of the app's own. The frame's menu
 * context carries `registerMediaFolders({id, label, tree, nodes,
 * onDelete})` beside `extendMenu`, and what it registers appears in the
 * same tree as the pages with its nodes in the same grid as the page
 * images. The app registers two:
 *
 * - "Fahrzeuge", one subfolder per car that has pictures, its nodes the
 *   car's pictures, delete removing one picture from the car. A car nobody
 *   has photographed draws no folder, because an empty one can neither be
 *   opened onto anything nor uploaded into.
 * - "Dokumente", one subfolder per month, its nodes the brand's offers and
 *   invoices as PDF nodes opening the gateway's url, delete deleting the
 *   document row.
 *
 * The nodes come from the pylon, not from the CMS field, so nothing needs a
 * publish and every admin sees the same list on every device. Upload inside
 * either folder is refused with the hint that a car's picture is uploaded
 * on the car and a document on its ride.
 *
 * Both folders are admin only, because both reads are: `cars` is admin and
 * driver and `transferDocumentsPage` is admin. A driver or a customer
 * signed in registers nothing and reads nothing, and sees the Media tab
 * exactly as it was.
 *
 * Registration is keyed by id and replaces in place, so a language change
 * rewrites the labels and a fresh read replaces the nodes, and nothing is
 * duplicated. Like useFrameMenu it cannot remove: an entry stays until the
 * page reloads, which a sign-out does through the OIDC redirect.
 *
 * Called from AppFrameMenu, mounted by the plugin's wrapPageElement on
 * every page, so the folders are there for an admin who walks straight to
 * /cms/media/ without passing through /app.
 */
import {useEffect, useMemo, useRef} from 'react'
import {useJaenFrameMenuContext} from 'gatsby-plugin-jaen'
import type {MediaFolderNode, MediaFolderTreeNode} from 'gatsby-plugin-jaen'
import type {Caller} from '../../shared/auth'
import {useI18nCode} from '../../shared/i18n'
import {fill, getI18nMediaFolders} from '../../shared/locales/i18nMediaFolders'
import {
  removeCarImage,
  useCarImages,
  type CarWithImages
} from '../../shared/hooks/car-images'
import {
  deleteDocument,
  useDocumentsPage,
  type DocumentListRow
} from '../../shared/hooks/documents'

/** The ids of the two folders, and the stem of every subfolder's id. */
export const VEHICLES_FOLDER_ID = 'app-media:vehicles'
export const DOCUMENTS_FOLDER_ID = 'app-media:documents'

/** The order of the two branches under the page tree. */
const VEHICLES_ORDER = 10
const DOCUMENTS_ORDER = 20

/**
 * One page of documents, big enough that a brand's paper is one read. The
 * folder is a tree, not a table, so there is no pager to turn: what the
 * first page does not carry is not shown, and the number is high enough
 * that no brand reaches it in this build.
 */
const DOCUMENTS_PAGE_SIZE = 200

export const carFolderId = (carId: string) => `${VEHICLES_FOLDER_ID}:${carId}`

export const monthFolderId = (month: string) =>
  `${DOCUMENTS_FOLDER_ID}:${month}`

/** YYYY-MM of an instant, the month a document is filed under. */
const monthOf = (createdAt: string): string => {
  const at = new Date(createdAt)
  if (Number.isNaN(at.getTime())) return 'unbekannt'
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`
}

/** "September 2026" in the account's language, the month's own words. */
const monthLabel = (month: string, locale: string): string => {
  const [year, index] = month.split('-')
  if (!year || !index) return month
  const at = new Date(Number(year), Number(index) - 1, 1)
  if (Number.isNaN(at.getTime())) return month
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric'
    }).format(at)
  } catch {
    // An unknown locale tag, which no account of this app has: the month
    // reads as its own key rather than the screen failing.
    return month
  }
}

const carLabel = (car: CarWithImages): string =>
  car.carName ? `${car.licensePlate} ${car.carName}` : car.licensePlate

/** What the grid shows under a document, the number and the ride's code. */
const documentLabel = (row: DocumentListRow): string =>
  [row.number, row.code].filter(Boolean).join(' ') || row.filename

export function useMediaFolders(caller: Caller) {
  const {registerMediaFolders} = useJaenFrameMenuContext()
  const code = useI18nCode()

  const {isAdmin, loading} = caller
  const enabled = !loading && isAdmin

  const {cars} = useCarImages({enabled})
  const {rows: documents} = useDocumentsPage({
    pageSize: DOCUMENTS_PAGE_SIZE,
    enabled
  })

  // The registrar is stable, unlike extendMenu, so the effect may depend on
  // it without registering in a loop; the ref is only here to keep the
  // dependency list to what decides the entries.
  const latest = useRef({registerMediaFolders})
  latest.current = {registerMediaFolders}

  const vehicles = useMemo(() => {
    const {strings} = getI18nMediaFolders(code)

    // Only a car that owns a picture. A fleet is mostly cars nobody has
    // photographed yet, and drawing one folder per car turned the tree into
    // seven empty entries around the two that hold something. A picture is
    // uploaded on the car in the fleet, never here, so an empty folder
    // offers nothing to open and nothing to drop into. The car appears the
    // moment its first picture is saved.
    const photographed = cars.filter(car => car.images.length > 0)

    const tree: MediaFolderTreeNode[] = photographed.map(car => ({
      id: carFolderId(car.id),
      label: carLabel(car),
      children: []
    }))

    const nodes: MediaFolderNode[] = photographed.flatMap(car =>
      car.images.map((image, index) => ({
        id: image.id,
        fileUniqueId: image.fileId,
        createdAt: image.createdAt,
        modifiedAt: image.createdAt,
        description: fill(strings.ImageName, {
          plate: car.licensePlate,
          index: index + 1
        }),
        preview: image.thumbUrl ? {url: image.thumbUrl} : undefined,
        url: image.url,
        width: image.width ?? 0,
        height: image.height ?? 0,
        mimeType: undefined,
        jaenPageId: carFolderId(car.id)
      }))
    )

    return {
      id: VEHICLES_FOLDER_ID,
      label: strings.FolderVehicles,
      order: VEHICLES_ORDER,
      uploadHint: strings.UploadHintVehicles,
      tree,
      nodes,
      onDelete: (nodeId: string) => removeCarImage(nodeId)
    }
  }, [cars, code])

  const paper = useMemo(() => {
    const {strings} = getI18nMediaFolders(code)

    const months = Array.from(
      new Set(documents.map(row => monthOf(row.createdAt)))
    ).sort((a, b) => b.localeCompare(a))

    const tree: MediaFolderTreeNode[] = months.map(month => ({
      id: monthFolderId(month),
      label: monthLabel(month, code),
      children: []
    }))

    const nodes: MediaFolderNode[] = documents.map(row => ({
      id: row.id,
      fileUniqueId: row.fileId ?? row.id,
      createdAt: row.createdAt,
      modifiedAt: row.createdAt,
      description: documentLabel(row),
      preview: row.thumbUrl ? {url: row.thumbUrl} : undefined,
      url: row.url ?? '',
      // A PDF has no dimensions, and the grid draws the document icon for
      // it rather than measuring anything.
      width: 0,
      height: 0,
      mimeType: row.mimeType ?? row.contentType,
      jaenPageId: monthFolderId(monthOf(row.createdAt))
    }))

    return {
      id: DOCUMENTS_FOLDER_ID,
      label: strings.FolderDocuments,
      order: DOCUMENTS_ORDER,
      uploadHint: strings.UploadHintDocuments,
      tree,
      nodes,
      onDelete: (nodeId: string) => deleteDocument({id: nodeId})
    }
  }, [documents, code])

  useEffect(() => {
    if (!enabled) return

    latest.current.registerMediaFolders(vehicles)
  }, [enabled, vehicles])

  useEffect(() => {
    if (!enabled) return

    latest.current.registerMediaFolders(paper)
  }, [enabled, paper])
}
