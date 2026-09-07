/**
 * A deploy never leaves the installed app white.
 *
 * See okf/architecture/offline.md, "The installed app never goes white after
 * a deploy". The short version: gatsby-plugin-offline's worker precaches one
 * app shell, that shell names the chunks of the build it was installed with,
 * and a deploy takes those chunks off the server. The worker's navigation
 * route is network first for /app since today, so a reload lands on the new
 * document, but two cases stay:
 *
 *   1. The document was already open when the deploy landed. Gatsby then
 *      loads a route chunk of the old build on the next client-side
 *      navigation and the request answers 404.
 *   2. The document came out of the browser's own back/forward cache, or the
 *      worker answered from the shell before it updated.
 *
 * Both look the same from here: a script of this origin fails to load, or a
 * chunk load rejects. The page then says one line and reloads itself once,
 * which is the whole visible behaviour. It must work when React never
 * mounted, so it is an inline script in the document's head and not a
 * component: by the time the app bundle would run, the app bundle is the
 * thing that failed.
 *
 * The line lives here rather than in shared/locales because the script is
 * plain text in the HTML and imports nothing. It is the frame's own wording,
 * German first like the four catalogues.
 */

export type UpdateNoticeCode = 'de-AT' | 'en-US' | 'tr-TR' | 'ar-EG'

/** "Neue Version wird geladen", the decided wording, in the four languages. */
export const UPDATE_NOTICE: Record<UpdateNoticeCode, string> = {
  'de-AT': 'Neue Version wird geladen',
  'en-US': 'Loading the new version',
  'tr-TR': 'Yeni sürüm yükleniyor',
  'ar-EG': 'جارٍ تحميل الإصدار الجديد'
}

/** The paths the guard watches. The app, and the shell the worker falls back to. */
export const GUARDED_PATHS = ['/app', '/offline-plugin-app-shell-fallback']

/** Whether this document gets the guard, used by gatsby-ssr.tsx. */
export const isGuardedPath = (pathname?: string): boolean =>
  !!pathname && GUARDED_PATHS.some(p => pathname.startsWith(p))

/**
 * The guard, as the source of the inline script.
 *
 * It defines `window.__taxiAppUpdateNotice(reload)`, which paints the line
 * and, unless told otherwise, reloads. gatsby-browser calls the same function
 * when the service worker reports a new build ready, so the reload after a
 * deploy shows the line whichever of the two paths reaches it first.
 *
 * The reload is guarded by a stamp in sessionStorage: at most one reload per
 * document per twenty seconds. A chunk that 404s because it never existed
 * would otherwise be an endless loop, and a loop is worse than the white
 * screen it would be fixing.
 */
export const updateGuardSource = (): string => `(function(){
  var NOTICE = ${JSON.stringify(UPDATE_NOTICE)};
  var STAMP = 'taxi-app:update-reload';
  var GAP = 20000;

  function line(){
    var raw = '';
    try { raw = window.localStorage.getItem('jaen:uiLocale') || ''; } catch (e) {}
    if (!raw) raw = document.documentElement.lang || '';
    if (!raw && navigator.language) raw = navigator.language;
    var base = String(raw).replace('_', '-').split('-')[0].toLowerCase();
    if (base === 'en') return {text: NOTICE['en-US'], rtl: false};
    if (base === 'tr') return {text: NOTICE['tr-TR'], rtl: false};
    if (base === 'ar') return {text: NOTICE['ar-EG'], rtl: true};
    return {text: NOTICE['de-AT'], rtl: false};
  }

  function paint(){
    if (document.getElementById('taxi-app-update-notice')) return;
    var l = line();
    var box = document.createElement('div');
    box.id = 'taxi-app-update-notice';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    box.dir = l.rtl ? 'rtl' : 'ltr';
    var dark = false;
    try { dark = document.documentElement.classList.contains('dark'); } catch (e) {}
    box.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'display:flex', 'align-items:center', 'justify-content:center',
      'gap:0.75rem', 'padding:1rem', 'text-align:center',
      'font:500 1rem/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
      'background:' + (dark ? '#171717' : '#ffffff'),
      'color:' + (dark ? '#fafafa' : '#171717')
    ].join(';');
    box.textContent = l.text;
    var target = document.body || document.documentElement;
    target.appendChild(box);
  }

  function notice(reload){
    paint();
    if (reload === false) return;
    var now = Date.now();
    var last = 0;
    try { last = Number(window.sessionStorage.getItem(STAMP)) || 0; } catch (e) {}
    // One reload per document per twenty seconds. A chunk that will never
    // exist must not turn into a reload loop, which is worse than the white
    // screen this exists to remove: the line stays on the screen instead.
    if (now - last < GAP) return;
    try { window.sessionStorage.setItem(STAMP, String(now)); } catch (e) {}
    window.setTimeout(function(){ window.location.reload(); }, 120);
  }

  window.__taxiAppUpdateNotice = notice;

  function ours(url){
    if (!url) return false;
    try {
      var u = new URL(String(url), window.location.href);
      if (u.origin !== window.location.origin) return false;
      return /\\.js($|\\?)/.test(u.pathname + u.search) || /\\.css($|\\?)/.test(u.pathname);
    } catch (e) { return false; }
  }

  // A <script src> or a <link rel=stylesheet> of this origin that never
  // loaded. The event does not bubble, so it is taken in the capture phase.
  window.addEventListener('error', function(event){
    var target = event && event.target;
    if (!target || !target.tagName) return;
    var tag = String(target.tagName).toLowerCase();
    if (tag !== 'script' && tag !== 'link') return;
    if (!ours(target.src || target.href)) return;
    notice(true);
  }, true);

  // Gatsby's loader rejects with "Loading chunk N failed" when the chunk is
  // gone. Webpack's own error carries the request on .request.
  window.addEventListener('unhandledrejection', function(event){
    var reason = event && event.reason;
    if (!reason) return;
    var message = String((reason && reason.message) || reason);
    if (!/loading chunk|loading css chunk|dynamically imported module|importing a module script failed/i.test(message)) return;
    notice(true);
  });
})();`
