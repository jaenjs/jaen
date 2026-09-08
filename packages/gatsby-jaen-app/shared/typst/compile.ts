/**
 * Typst in the browser: the compiler loaded once, lazily, as a chunk of its
 * own, and `compileToPdf(mainFile, files, data)` answering the PDF bytes.
 * okf/architecture/offers-and-documents.md, "The offer, generated with Typst
 * in the browser".
 *
 * Nothing imports this module statically. The offer dialog does
 * `await import('../../typst/compile')` when it opens, so this file, the
 * engine, the compiler's JavaScript and, behind them, the 10.8 MB gzipped
 * WASM module and the four faces are fetched the first time somebody makes
 * an offer and never on the board, the detail page or a driver's phone.
 *
 * How the assets reach the browser. Gatsby copies only the site's own
 * `static/` directory to `public/`, never a plugin's, so the plugin cannot
 * drop files there. What it can do is let webpack carry them: the fonts are
 * ES imports, which Gatsby's `rules.fonts` (url-loader) writes to
 * `/static/<name>-<hash>.ttf` and answers as their URL; the WASM and the
 * template files are `new URL(..., import.meta.url)` references, which
 * webpack 5 emits as asset modules under `/static/` with a content hash and
 * no rule at all. Both end up as URLs `fetch` can read from the site's own
 * origin, and both are cached by the browser like every other hashed asset.
 *
 * Off the main thread. The compiler package is plain ES modules and works in
 * a Web Worker, so the module is instantiated in compile.worker.ts and a
 * compile never freezes the dialog it runs for. When no worker can be made
 * (no `Worker`, or the worker's first message fails) the same engine runs
 * on the main thread, which is slower for the page and otherwise the same.
 */
import {appError} from '../errors'
import arabicBoldFont from './fonts/NotoSansArabic-Bold.ttf'
import mathFont from './fonts/NotoSansMath-Regular.ttf'
import arabicFont from './fonts/NotoSansArabic-Regular.ttf'
import boldFont from './fonts/OpenSans-Bold.ttf'
import regularFont from './fonts/OpenSans-Regular.ttf'
import booklimoLogo from './templates/brands/booklimo-logo.svg'
import limosenLogo from './templates/brands/limosen-logo.svg'
import {
  TypstCompileError,
  type TypstDiagnostic,
  type TypstFileContent,
  type TypstFiles,
  type TypstInputs
} from './engine'

export {TypstCompileError}
export type {TypstDiagnostic, TypstFileContent, TypstFiles, TypstInputs}

/**
 * The compiler's module, the package's `typst_ts_web_compiler_bg.wasm`
 * gzipped into vendor/ (see the README there): the raw module is 27 MiB
 * and `wrangler pages deploy` refuses any file over 25, so the 10.8 MB
 * `.gz` is the asset, inflated by the engine with DecompressionStream
 * and instantiated from the bytes. It is never imported as a module.
 */
const WASM_URL = new URL(
  './vendor/typst-ts-web-compiler-0.7.0.wasm.gz',
  import.meta.url
)

/**
 * Open Sans regular and bold, the two faces the house layout uses, Noto
 * Sans Arabic behind them for the letters Open Sans does not have, the
 * Arabic offer being left to right with Arabic text, and Noto Sans Math
 * for the arrow of a route (U+2192), which neither of the others carries.
 * The same five files the notebook compiles with (fonts/README.md), so a
 * page renders the same in both.
 */
const FONT_URLS: string[] = [
  regularFont,
  boldFont,
  arabicFont,
  arabicBoldFont,
  mathFont
]

/**
 * The template family, every file the templates may `#import`, `json()`,
 * `image()` or `plugin()`, keyed by its path under app/shared/typst. The
 * list is static because webpack has to see every path at build time. A
 * file the template agent adds under templates/ is added here, and a
 * compile of a template that names a file missing here fails with Typst's
 * own "file not found" naming the path.
 *
 * Text files (.typ, .toml) are fetched as text and become sources, the rest
 * (.svg, .wasm) as bytes.
 */
const TEMPLATE_ASSETS: Record<string, string | URL> = {
  'hello.typ': new URL('./hello.typ', import.meta.url),
  'templates/letter.typ': new URL('./templates/letter.typ', import.meta.url),
  'templates/offer.typ': new URL('./templates/offer.typ', import.meta.url),
  'templates/invoice.typ': new URL('./templates/invoice.typ', import.meta.url),
  'templates/brands/index.typ': new URL(
    './templates/brands/index.typ',
    import.meta.url
  ),
  'templates/brands/limosen.typ': new URL(
    './templates/brands/limosen.typ',
    import.meta.url
  ),
  'templates/brands/limosen.json': new URL(
    './templates/brands/limosen.json',
    import.meta.url
  ),
  'templates/brands/booklimo.typ': new URL(
    './templates/brands/booklimo.typ',
    import.meta.url
  ),
  'templates/brands/booklimo.json': new URL(
    './templates/brands/booklimo.json',
    import.meta.url
  ),
  'templates/brands/limosen-logo.svg': limosenLogo,
  'templates/brands/booklimo-logo.svg': booklimoLogo,
  'templates/lang/de.json': new URL(
    './templates/lang/de.json',
    import.meta.url
  ),
  'templates/lang/en.json': new URL(
    './templates/lang/en.json',
    import.meta.url
  ),
  'templates/lang/tr.json': new URL(
    './templates/lang/tr.json',
    import.meta.url
  ),
  'templates/lang/ar.json': new URL(
    './templates/lang/ar.json',
    import.meta.url
  ),
  'templates/vendor/zebra/lib.typ': new URL(
    './templates/vendor/zebra/lib.typ',
    import.meta.url
  ),
  'templates/vendor/zebra/generic.typ': new URL(
    './templates/vendor/zebra/generic.typ',
    import.meta.url
  ),
  'templates/vendor/zebra/zebra.wasm': new URL(
    './templates/vendor/zebra/zebra.wasm',
    import.meta.url
  ),
  'templates/vendor/zebra/typst.toml': new URL(
    './templates/vendor/zebra/typst.toml',
    import.meta.url
  )
}

const TEXT_EXTENSIONS = /\.(typ|toml|json|txt|csv)$/i

// --------------- The compiler, once ---------------

interface Backend {
  compile(
    mainFile: string,
    files: TypstFiles,
    data: unknown,
    inputs?: TypstInputs
  ): Promise<Uint8Array>
  /** `worker` or `main`, for the diagnostic line the dialog shows. */
  readonly thread: 'worker' | 'main'
}

const fetchBytes = async (url: string | URL): Promise<ArrayBuffer> => {
  const response = await fetch(url)
  if (!response.ok)
    throw appError('Server', `${response.status} for ${String(url)}`)
  return response.arrayBuffer()
}

const fetchFonts = (): Promise<ArrayBuffer[]> =>
  Promise.all(FONT_URLS.map(fetchBytes))

/** The absolute URL of the module, so a worker with another base can fetch it. */
const wasmHref = (): string =>
  new URL(
    WASM_URL,
    typeof document !== 'undefined' ? document.baseURI : undefined
  ).href

type WorkerAnswer =
  | {id: number; ok: true; pdf?: Uint8Array}
  | {id: number; ok: false; error: string; diagnostics?: TypstDiagnostic[]}

/** The worker, wrapped: one pending promise per message id. */
const startWorker = async (): Promise<Backend> => {
  if (typeof Worker === 'undefined')
    throw appError('BrowserUnsupported', 'no Worker in this browser')

  const worker = new Worker(new URL('./compile.worker.ts', import.meta.url), {
    type: 'module'
  })
  const pending = new Map<
    number,
    {resolve: (a: WorkerAnswer) => void; reject: (e: Error) => void}
  >()
  let next = 1

  worker.onmessage = (event: MessageEvent<WorkerAnswer>) => {
    const answer = event.data
    const slot = pending.get(answer?.id)
    if (!slot) return
    pending.delete(answer.id)
    slot.resolve(answer)
  }
  worker.onerror = event => {
    const error = new Error(event.message || 'the compiler worker failed')
    for (const slot of pending.values()) slot.reject(error)
    pending.clear()
  }

  const send = (
    message: Record<string, unknown>,
    transfer: Transferable[] = []
  ): Promise<WorkerAnswer> =>
    new Promise((resolve, reject) => {
      const id = next++
      pending.set(id, {resolve, reject})
      worker.postMessage({id, ...message}, transfer)
    })

  const fonts = await fetchFonts()
  const ready = await send({type: 'init', wasm: wasmHref(), fonts}, fonts)
  if (!ready.ok) {
    worker.terminate()
    throw new Error(ready.error)
  }

  return {
    thread: 'worker',
    async compile(mainFile, files, data, inputs) {
      const answer = await send({
        type: 'compile',
        mainFile,
        files,
        data,
        inputs
      })
      if (!answer.ok)
        throw new TypstCompileError(answer.error, answer.diagnostics ?? [])
      if (!answer.pdf)
        throw appError('Server', 'the compiler answered without a PDF')
      return answer.pdf
    }
  }
}

/** The engine on this thread, the fallback. */
const startInline = async (): Promise<Backend> => {
  const {createEngine} = await import('./engine')
  const engine = await createEngine({
    wasm: wasmHref(),
    fonts: await fetchFonts()
  })
  return {
    thread: 'main',
    compile: async (mainFile, files, data, inputs) =>
      engine.compile(mainFile, files, data, inputs)
  }
}

let backend: Promise<Backend> | null = null

/**
 * The compiler, loaded once per page. The worker is tried first, and a
 * worker that cannot start (an old browser, a blocked module worker, a
 * server that refused the WASM) falls back to the main thread with a line
 * in the console saying why, so a slow dialog can be traced to it.
 */
export function loadTypst(): Promise<Backend> {
  if (!backend) {
    backend = startWorker().catch(async (reason: unknown) => {
      console.warn(
        'typst: no worker, compiling on the main thread:',
        reason instanceof Error ? reason.message : reason
      )
      return startInline()
    })
    backend.catch(() => {
      // A failed load is not kept: the next call tries again.
      backend = null
    })
  }
  return backend
}

/** Whether the compiler is already loaded on this page, without loading it. */
export const isTypstLoaded = (): boolean => backend !== null

/**
 * Compiles `mainFile`, one of the keys of `files`, to a PDF. `data` reaches
 * the template as `sys.inputs.data` and as `data.json` beside the main
 * file, `inputs` are further `sys.inputs` such as the offer's `brand`.
 * The first call on a page fetches and instantiates the compiler,
 * every later one answers within the second on an offer. Throws
 * TypstCompileError with Typst's diagnostics in words when the template
 * does not compile, and a plain Error when the compiler could not be loaded.
 */
export async function compileToPdf(
  mainFile: string,
  files: TypstFiles,
  data: unknown,
  inputs?: TypstInputs
): Promise<Uint8Array> {
  const compiler = await loadTypst()
  return compiler.compile(mainFile, files, data, inputs)
}

// --------------- The bundled template files ---------------

let bundled: Promise<TypstFiles> | null = null

const fetchAsset = async (
  path: string,
  url: string | URL
): Promise<TypstFileContent> => {
  const response = await fetch(url)
  if (!response.ok) throw appError('Server', `${response.status} for ${path}`)
  return TEXT_EXTENSIONS.test(path)
    ? response.text()
    : new Uint8Array(await response.arrayBuffer())
}

/**
 * Every file of the template family, fetched once and kept. The keys are
 * the paths under app/shared/typst, so a template at `templates/offer.typ`
 * imports its letter as `letter.typ` and its brand as `brands/limosen.typ`,
 * the same relative paths the notebook's local binary resolves on disk.
 */
export function templateFiles(): Promise<TypstFiles> {
  if (!bundled) {
    bundled = (async () => {
      const entries = await Promise.all(
        Object.entries(TEMPLATE_ASSETS).map(
          async ([path, url]) => [path, await fetchAsset(path, url)] as const
        )
      )
      return Object.fromEntries(entries)
    })()
    bundled.catch(() => {
      bundled = null
    })
  }
  return bundled
}

/** The paths the bundle carries, for a check that a template's imports are all there. */
export const templatePaths = (): string[] => Object.keys(TEMPLATE_ASSETS)

/**
 * A PDF as a URL an `<object>` or `<iframe>` can show. The caller revokes
 * it when the dialog closes, `URL.revokeObjectURL`.
 */
export const pdfObjectUrl = (pdf: Uint8Array): string =>
  URL.createObjectURL(new Blob([pdf as BlobPart], {type: 'application/pdf'}))
