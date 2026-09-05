/**
 * The Mapbox token, read once for every map the app draws.
 *
 * The define is the documented source: gatsby/gatsby-node.ts writes
 * `__JAEN_MAPBOX_TOKEN__` from GATSBY_MAPBOX_TOKEN at build time. The two
 * fallbacks are the older spellings the site may still carry, and a token
 * placed on window by a script in the head, which is the only way one build
 * can serve two brands with two tokens. An empty string means no token, and
 * every map says so inline instead of waiting for a style that never loads.
 */
declare const __JAEN_MAPBOX_TOKEN__: string | undefined

export const mapboxToken = (): string => {
  try {
    const defined =
      typeof __JAEN_MAPBOX_TOKEN__ !== 'undefined' ? __JAEN_MAPBOX_TOKEN__ : ''
    if (defined) return defined
  } catch {
    /* the define is absent in the preview build, the fallbacks are below */
  }
  try {
    const onWindow =
      typeof window !== 'undefined' ? (window as any).__MAPBOX_TOKEN__ : undefined
    if (typeof onWindow === 'string' && onWindow) return onWindow
  } catch {
    /* no window */
  }
  return process.env.GATSBY_MAPBOX_TOKEN || process.env.GATSBY_MAPBOX_ACCESS_TOKEN || ''
}

/** The map style for the colour mode, the same two on every map. */
export const mapStyleFor = (colorMode: 'light' | 'dark'): string =>
  colorMode === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12'

/** The centre a map starts on before it knows anything: Vienna. */
export const DEFAULT_CENTER: [number, number] = [16.3738, 48.2082]
export const DEFAULT_ZOOM = 12

/**
 * mapbox-gl, loaded on the client only. The Gatsby SSR build must not touch
 * it, so every map imports it inside an effect, through this one function
 * that also pulls the stylesheet in.
 */
export const loadMapbox = async (): Promise<any> => {
  // @ts-ignore no types are installed for the package
  const mod = await import('mapbox-gl')
  try {
    // @ts-ignore the stylesheet import is handled by webpack
    await import('mapbox-gl/dist/mapbox-gl.css')
  } catch {
    /* the css failed to load, the map still works, only the controls look bare */
  }
  return mod.default ?? mod
}

/**
 * The driver's silver default means "nobody chose a colour" and is drawn as
 * a neutral grey rather than as silver, so the one driver who never chose is
 * not the brightest marker on the map.
 */
export const DRIVER_DEFAULT_COLOR = '#C0C0C0'
export const NEUTRAL_MARKER_COLOR = '#6B7280'

export const markerColorFor = (color: string | null | undefined): string =>
  color && /^#[0-9a-f]{6}$/i.test(color) && color.toUpperCase() !== DRIVER_DEFAULT_COLOR
    ? color
    : NEUTRAL_MARKER_COLOR

/** A customer on the dispatcher's map. Customers have no colour of their own. */
export const CUSTOMER_MARKER_COLOR = '#3B82F6'

/** The colour a row on the dispatcher's map is drawn in. */
export const rowColorFor = (kind: 'driver' | 'customer', color: string | null | undefined): string =>
  kind === 'driver' ? markerColorFor(color) : CUSTOMER_MARKER_COLOR
