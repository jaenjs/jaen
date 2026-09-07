/**
 * The words of the two folders the app adds to jaen's Media tree, the
 * vehicle pictures and the brand's documents. See
 * okf/architecture/media.md, "One gallery, jaen's".
 *
 * There is no screen of the app behind these: the gallery is jaen's, and
 * what the app contributes is a folder name, a subfolder name and the one
 * line the gallery shows where upload is refused. The words of the vehicle
 * form (Bilder hochladen, Titelbild, Bild entfernen) live with the fleet in
 * i18nFleet, because that is where the upload is, and the words of the
 * invoice dropzone live with the money in i18nOffers. German is the product
 * language and the other three are typed against it, so a key added to `de`
 * and forgotten in `ar` fails the typecheck.
 */
import type {I18nCode} from '../i18n'

const de = {
  FolderVehicles: 'Fahrzeuge',
  FolderDocuments: 'Dokumente',

  // What the gallery says where upload is refused, one line per folder.
  UploadHintVehicles:
    'Bilder eines Fahrzeugs werden beim Fahrzeug im Fuhrpark hochgeladen.',
  UploadHintDocuments: 'Ein Dokument wird bei seiner Fahrt hochgeladen.',

  // The name under a picture in the grid, the plate and its place.
  ImageName: '{plate} Bild {index}'
}

export type MediaFoldersStrings = typeof de

const en: MediaFoldersStrings = {
  FolderVehicles: 'Vehicles',
  FolderDocuments: 'Documents',

  UploadHintVehicles:
    "A vehicle's pictures are uploaded on the vehicle in the fleet.",
  UploadHintDocuments: 'A document is uploaded on its ride.',

  ImageName: '{plate} picture {index}'
}

const tr: MediaFoldersStrings = {
  FolderVehicles: 'Araçlar',
  FolderDocuments: 'Belgeler',

  UploadHintVehicles: 'Bir aracın fotoğrafları filodaki araçta yüklenir.',
  UploadHintDocuments: 'Bir belge kendi transferinde yüklenir.',

  ImageName: '{plate} fotoğraf {index}'
}

const ar: MediaFoldersStrings = {
  FolderVehicles: 'المركبات',
  FolderDocuments: 'المستندات',

  UploadHintVehicles: 'تُرفع صور المركبة من المركبة نفسها في الأسطول.',
  UploadHintDocuments: 'يُرفع المستند من رحلته.',

  ImageName: '{plate} صورة {index}'
}

export function getI18nMediaFolders(code: I18nCode): {
  code: I18nCode
  strings: MediaFoldersStrings
} {
  if (code === 'en-US') return {code, strings: en}
  if (code === 'tr-TR') return {code, strings: tr}
  if (code === 'ar-EG') return {code, strings: ar}
  return {code, strings: de}
}

export {fill} from './i18nCommon'
