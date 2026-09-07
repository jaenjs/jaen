/**
 * Registers the app's two sources on jaen's Media tab, the way
 * useFrameMenu registers the app's navigation on the frame's menus.
 *
 * The frame's menu context carries `registerMediaSource({id, label, icon,
 * list, open, remove})` beside `extendMenu`, and the Media tab renders one
 * tab per registered source next to the page images
 * (okf/architecture/media.md, "Sources"). The app registers two:
 *
 * - `vehicles` "Fahrzeuge": every car with a picture, opening the fleet's
 *   vehicle form, remove clears the picture.
 * - `documents` "Dokumente": every offer and invoice of the brand, paged
 *   and filtered, opening the signed link, remove deletes the document.
 *
 * Both are admin only, because both reads are: `cars` is admin and driver
 * and `transferDocumentsPage` is admin. A driver or a customer signed in
 * registers nothing and sees the Media tab exactly as it was.
 *
 * Registration is keyed by id and replaces in place, so running this again
 * after a language change rewrites the labels and duplicates nothing. Like
 * useFrameMenu it cannot remove: an entry stays until the page reloads,
 * which a sign-out does through the OIDC redirect.
 *
 * Called from AppFrameMenu, mounted by the plugin's wrapPageElement on
 * every page, so the tabs are there for an admin who walks straight to
 * /cms/media/ without passing through /app.
 */
import {useEffect, useRef} from 'react'
import {navigate} from 'gatsby'
import {useJaenFrameMenuContext} from 'gatsby-plugin-jaen'
import {FaCar} from '@react-icons/all-files/fa/FaCar'
import {FaFilePdf} from '@react-icons/all-files/fa/FaFilePdf'
import type {Caller} from '../../shared/auth'
import {useI18nCode} from '../../shared/i18n'
import {getI18nMediaSources} from '../../shared/locales/i18nMediaSources'
import {DocumentsSource} from '../../shared/components/media/DocumentsSource'
import {VehiclesSource} from '../../shared/components/media/VehiclesSource'
import {deleteDocument, openDocument} from '../../shared/hooks/documents'
import {clearCarImageMutation} from '../../shared/hooks/car-images'

/** The order of the two tabs after the page images. */
const VEHICLES_ORDER = 10
const DOCUMENTS_ORDER = 20

/**
 * Where a car is edited. The fleet screen keeps its vehicle form as a
 * dialog and has no route of its own for one car, so the source lands on
 * the fleet with the car named in the query string, and the screen opens
 * the form on that car once the fleet has landed (FleetView.tsx).
 */
export const fleetPathFor = (carId: string) =>
  `/app/fleet/?car=${encodeURIComponent(carId)}`

export function useMediaSources(caller: Caller) {
  const {registerMediaSource} = useJaenFrameMenuContext()
  const code = useI18nCode()

  const {isAdmin, loading} = caller

  // The registrar is stable, unlike extendMenu, so the effect may depend on
  // it without registering in a loop; the ref is only here to keep the
  // dependency list to what decides the entries.
  const latest = useRef({registerMediaSource})
  latest.current = {registerMediaSource}

  useEffect(() => {
    if (loading || !isAdmin) return

    const {strings} = getI18nMediaSources(code)

    latest.current.registerMediaSource({
      id: 'vehicles',
      label: strings.TabVehicles,
      icon: FaCar,
      order: VEHICLES_ORDER,
      list: VehiclesSource,
      open: carId => {
        void navigate(fleetPathFor(carId))
      },
      remove: carId => clearCarImageMutation(carId)
    })

    latest.current.registerMediaSource({
      id: 'documents',
      label: strings.TabDocuments,
      icon: FaFilePdf,
      order: DOCUMENTS_ORDER,
      list: DocumentsSource,
      // The signed link is fetched on the click and opened in the tab the
      // click already opened, see hooks/documents.ts.
      open: documentId => openDocument(documentId),
      remove: documentId => deleteDocument({id: documentId})
    })
  }, [isAdmin, loading, code])
}
