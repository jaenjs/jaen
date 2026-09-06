/**
 * The controls every map of the app carries, decided in one place.
 *
 * design-consistency.md, rule 6, measured 2026-09-06 on the phone: the plus
 * and minus buttons sat bottom right under the glass bar, and pinching zooms
 * anyway. So below Chakra's `md` (48em) the zoom control is not added at
 * all, the locate control is one 44 px round button in the top right corner
 * of the map, below the app's header and with `env(safe-area-inset-top)`
 * added on top, and nothing of mapbox's sits in the bottom right corner.
 * From `md` up the zoom and the locate control stack in the top right, the
 * zoom above. The width is watched, so a window dragged across `md` gets
 * the zoom control added or taken away without a reload.
 *
 * The group's surface follows the colour mode through Chakra's variables,
 * so the button reads the same on the dark style as on the light one.
 */

/** Chakra's `md`, the width the table becomes cards under (useIsMobile). */
export const MD_QUERY = '(min-width: 48em)'

/** The class on the map's container the stylesheet below is scoped to. */
export const MAP_CLASS = 'taxi-map'

const STYLE_ID = 'taxi-map-controls'

/**
 * mapbox-gl.css puts every control in a 32 px box 10 px from the corner. The
 * app's spacing is 12 px, and below md the one button is 44 px and round, the
 * hit area of hard-rules.md. `env(safe-area-inset-top)` is 0 wherever the
 * page does not opt into `viewport-fit=cover`, and is added regardless so a
 * build that does never puts the button under the status bar.
 */
const CSS = `
.${MAP_CLASS} .mapboxgl-ctrl-top-right{padding-top:env(safe-area-inset-top, 0px)}
.${MAP_CLASS} .mapboxgl-ctrl-top-right .mapboxgl-ctrl{margin:12px 12px 0 0}
.${MAP_CLASS} .mapboxgl-ctrl-group{background:var(--chakra-colors-bg-surface, #fff);border-radius:var(--chakra-radii-control, 8px)}
.${MAP_CLASS} .mapboxgl-ctrl-group:not(:empty){box-shadow:0 0 0 1px var(--chakra-colors-border-default, rgba(0,0,0,.1)),0 1px 3px rgba(0,0,0,.12)}
.${MAP_CLASS} .mapboxgl-ctrl-group button+button{border-top-color:var(--chakra-colors-border-default, #ddd)}
.${MAP_CLASS} .mapboxgl-ctrl button:not(:disabled):hover{background-color:var(--chakra-colors-bg-subtle, #eee)}
.dark .${MAP_CLASS} .mapboxgl-ctrl button .mapboxgl-ctrl-icon{filter:invert(1) hue-rotate(180deg)}
@media (max-width: 47.99em){
  .${MAP_CLASS} .mapboxgl-ctrl-top-right .mapboxgl-ctrl-group{border-radius:9999px}
  .${MAP_CLASS} .mapboxgl-ctrl-top-right .mapboxgl-ctrl-group button{width:44px;height:44px;border-radius:9999px}
  .${MAP_CLASS} .mapboxgl-ctrl-top-right .mapboxgl-ctrl-group button:focus{box-shadow:none}
  .${MAP_CLASS} .mapboxgl-ctrl-top-right .mapboxgl-ctrl-group button:focus-visible{box-shadow:0 0 0 2px var(--chakra-colors-brand-focus-ring, #0096ff)}
}
`

const ensureStyles = () => {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}

export interface MapControlsOptions {
  /**
   * The "my location" button. On the dispatcher's map it is the
   * dispatcher's own position, never sent anywhere. The tracking map under
   * a booking does without it: its camera follows the driver, and a second
   * thing to follow would fight that.
   */
  locate?: boolean
}

/**
 * Add the controls to a map and return the function that takes them away.
 * Call it once the map exists, before `remove()`.
 */
export const attachMapControls = (
  map: any,
  mapboxgl: any,
  {locate = false}: MapControlsOptions = {}
): (() => void) => {
  ensureStyles()
  map.getContainer()?.classList.add(MAP_CLASS)

  const geolocate = locate
    ? new mapboxgl.GeolocateControl({
        positionOptions: {enableHighAccuracy: true},
        trackUserLocation: true,
        showUserHeading: true
      })
    : null
  let navigation: any = null
  let geolocateAdded = false

  const mq = window.matchMedia(MD_QUERY)

  // mapbox stacks a corner's controls in the order they were added, so the
  // locate control is re-added after the zoom to stay below it.
  const apply = () => {
    if (mq.matches && !navigation) {
      navigation = new mapboxgl.NavigationControl({showCompass: false})
      if (geolocate && geolocateAdded) {
        map.removeControl(geolocate)
        geolocateAdded = false
      }
      map.addControl(navigation, 'top-right')
    } else if (!mq.matches && navigation) {
      map.removeControl(navigation)
      navigation = null
    }
    if (geolocate && !geolocateAdded) {
      map.addControl(geolocate, 'top-right')
      geolocateAdded = true
    }
  }

  apply()
  mq.addEventListener('change', apply)

  return () => {
    mq.removeEventListener('change', apply)
    // The map may already be gone: removeControl on a removed map throws.
    try {
      if (navigation) map.removeControl(navigation)
      if (geolocate && geolocateAdded) map.removeControl(geolocate)
    } catch {
      /* the map was removed first, and took its controls with it */
    }
    navigation = null
    geolocateAdded = false
  }
}
