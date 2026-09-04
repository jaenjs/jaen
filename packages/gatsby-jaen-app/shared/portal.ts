let portalRoot: HTMLElement | null = null

export function getPortalRoot(): HTMLElement | null {
  // Inverted guard: this returned document.body in exactly the case where
  // document does not exist, so any server-side render of a view that portals
  // threw instead of skipping the portal.
  if (typeof document === 'undefined') return null

  if (portalRoot && document.body.contains(portalRoot)) return portalRoot

  const existing = document.getElementById('jaen-portal-root')
  if (existing) {
    portalRoot = existing
    return portalRoot
  }

  const el = document.createElement('div')
  el.id = 'jaen-portal-root'
  el.className = 'jaen-app dark'
  document.body.appendChild(el)
  portalRoot = el
  return portalRoot
}
