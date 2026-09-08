/**
 * The two names the rest of the agent still needs of the old head patch.
 *
 * Until 2026-09-08 this file described `jaen-data/live.json` and
 * `jaen-data/live-media.json`, the two files the first build of the shared
 * draft committed every save into, together with the split between them, the
 * merge back and the code that kept them as the last two lines of
 * `patches.txt`. All of it is gone: a draft is not a file in a repository and
 * an unpublished edit must never reach a built site
 * (`okf/decisions/hard-rules.md`, "The CMS's draft is not the site's
 * content"). The draft lives in one Durable Object per site (./draft) and the
 * repository is written only by a publish (./publish).
 *
 * What is left is two constants, because two things outlived the head patch:
 * the chain still has an index, and the media catalogue is still the one jaen
 * field that holds a catalogue rather than a value.
 */

/** The chain's index, relative to the repository root or to the site's cwd. */
export const PATCHES_PATH = 'jaen-data/patches.txt'

/**
 * The one field that is a catalogue rather than a value.
 *
 * `containers/media.tsx` reads and writes `useField('media_nodes',
 * 'IMA:MEDIA_NODES')`, so every picture in the library is one key of one field
 * of one page. On booklimo that field is 118,617 bytes of a 120 KB draft,
 * which is why the object stores its entries one key per node instead of
 * writing the whole catalogue whenever a picture changes.
 */
export const MEDIA_FIELD_TYPE = 'IMA:MEDIA_NODES'
