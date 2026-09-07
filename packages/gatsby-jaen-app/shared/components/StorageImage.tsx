/**
 * A picture that lives on the storage gateway, drawn with the right
 * credential.
 *
 * The gateway is private since 2026-09-07 (okf/architecture/media.md,
 * "Private storage", and the design in jaen's
 * docs/architecture/private-storage.md): `GET /storage/<id>` answers 401
 * without a bearer, so a car's picture can no longer be a bare
 * `<img src="https://osg...">` anywhere a person is signed in. There are
 * exactly two ways a picture is fetched on this platform and both meet here:
 *
 *   with a session   jaen's `useFileObjectUrl` fetches the bytes with the
 *                    signed-in person's own Zitadel token, the same token the
 *                    pylon takes, and hands back an object URL that is
 *                    revoked when the component goes away. Every screen of
 *                    the app is this case.
 *   without one      the URL is drawn as it stands, which on a page with no
 *                    account is a signed gateway link the pylon minted
 *                    (`?exp=&sig=`, fifteen minutes) and on a public site a
 *                    path the build wrote. Neither needs a token and neither
 *                    may be sent one.
 *
 * The decision is not a guess: `storageFileId` says whether the source is a
 * gateway file at all, and `storageBearer` says whether there is a session to
 * fetch it with. A signed link is a gateway file too, so a signed-in reader
 * fetches it with the token instead, which is the same bytes by a better
 * door.
 */
import {Image, type ImageProps} from '@chakra-ui/react'
import {storageBearer, storageFileId, useFileObjectUrl} from 'jaen'

/**
 * What to put in `src`, or undefined while the bytes are still coming.
 *
 * Undefined is deliberate and is what every caller draws its own placeholder
 * for: the alternative is painting the gateway's URL for one frame, which is
 * a 401 and a broken image icon in the layout.
 */
export function useStorageSrc(src?: string | null): string | undefined {
  const source = src ?? undefined
  // The hook is called on every render either way, hooks having no branches.
  const objectUrl = useFileObjectUrl(source)

  if (!source) return undefined

  const authenticated =
    Boolean(storageFileId(source)) && Boolean(storageBearer())

  return authenticated ? objectUrl : source
}

export interface StorageImageProps extends Omit<ImageProps, 'src'> {
  src?: string | null
}

/** The Chakra image, drawn through the rule above. */
export function StorageImage({src, ...props}: StorageImageProps) {
  const resolved = useStorageSrc(src)

  return <Image src={resolved} {...props} />
}
