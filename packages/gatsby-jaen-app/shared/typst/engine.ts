/**
 * The Typst compiler as one object: the WASM instantiated once, the fonts
 * registered once, and a compile that takes a main file, the files beside
 * it and the document's data, and answers the PDF bytes.
 *
 * This file knows nothing about threads. compile.worker.ts runs it inside a
 * Web Worker and compile.ts runs it on the main thread when no worker can
 * be made, and both call the same two functions. The WASM and the fonts
 * arrive as URLs or bytes, fetched by whoever calls, so the module itself
 * imports no asset and works wherever `fetch` and `WebAssembly` do.
 *
 * The compiler (`@myriaddreamin/typst-ts-web-compiler` 0.7, Typst 0.14) is
 * built without fonts and without network: every font, every template file
 * and the data are put into its shadow file system by path before a
 * compile, and a `#import`, `json()` or `image()` of anything else fails
 * with "file not found", which is the intended behaviour, an offer must not
 * depend on a package registry at compile time.
 */
import init, {
  TypstCompilerBuilder,
  type TypstCompiler
} from '@myriaddreamin/typst-ts-web-compiler'

/** A file of the template family: Typst source as text, anything else as bytes. */
export type TypstFileContent = string | Uint8Array

/**
 * The files a compile sees, keyed by their path under the root without a
 * leading slash: `offer.typ`, `brands/limosen.typ`, `vendor/zebra/zebra.wasm`.
 */
export type TypstFiles = Record<string, TypstFileContent>

/**
 * Further `sys.inputs` beside `data`: the offer template reads `brand`
 * (limosen | booklimo) from them, the way the notebook passes
 * `--input brand=limosen` to the local binary.
 */
export type TypstInputs = Record<string, string>

/** One line of what the compiler said, as Typst's own diagnostics format spells it. */
export interface TypstDiagnostic {
  severity: 'error' | 'warning'
  path: string
  /** `line:column-line:column`, zero based. */
  range: string
  message: string
}

/** The compile failed. `diagnostics` holds every error and warning, `message` the errors in one string. */
export class TypstCompileError extends Error {
  constructor(
    message: string,
    public readonly diagnostics: TypstDiagnostic[]
  ) {
    super(message)
    this.name = 'TypstCompileError'
  }
}

/** What the engine needs once: the compiler module and the fonts it may use. */
export interface EngineSources {
  /** The compiler's `.wasm` (or `.wasm.gz`), as a URL to fetch or the bytes already fetched. */
  wasm: string | URL | ArrayBuffer | Uint8Array
  /** Every font file the templates may name, as bytes. */
  fonts: Array<ArrayBuffer | Uint8Array>
}

const DIAGNOSTICS_AS_OBJECTS = 3

const normalise = (path: string): string => '/' + path.replace(/^\/+/, '')

const asBytes = (value: ArrayBuffer | Uint8Array): Uint8Array =>
  value instanceof Uint8Array ? value : new Uint8Array(value)

/**
 * The compiler's throw and its diagnostics object, read into one list.
 * With the format above the compiler answers `{hasError, diagnostics}` for
 * a failing document and throws on a few internal failures with a Rust
 * Debug string, `[SourceDiagnostic { severity: Error, message: "..." }]`,
 * which the fallback branch turns back into a message a person can read.
 */
const readDiagnostics = (raw: unknown): TypstDiagnostic[] => {
  if (Array.isArray(raw)) {
    return raw
      .map((d: any): TypstDiagnostic | null => {
        if (!d || typeof d !== 'object') return null
        return {
          severity: d.severity === 'warning' ? 'warning' : 'error',
          path: String(d.path ?? '').replace(/^\//, ''),
          range: String(d.range ?? ''),
          message: String(d.message ?? '')
        }
      })
      .filter((d): d is TypstDiagnostic => d !== null)
  }
  const text =
    typeof raw === 'string'
      ? raw
      : raw instanceof Error
        ? raw.message
        : JSON.stringify(raw)
  const messages = [...text.matchAll(/message: "((?:[^"\\]|\\.)*)"/g)].map(
    m => m[1] ?? ''
  )
  return (messages.length ? messages : [text]).map(message => ({
    severity: 'error',
    path: '',
    range: '',
    message
  }))
}

const describe = (diagnostics: TypstDiagnostic[]): string =>
  diagnostics
    .filter(d => d.severity === 'error')
    .map(d => (d.path ? `${d.path} ${d.range}: ${d.message}` : d.message))
    .join('\n') || 'The document did not compile'

export interface TypstEngine {
  /**
   * Compiles `mainFile` (a key of `files`) to a PDF. `data` is serialised
   * once and reaches the template twice, as `sys.inputs.data` and as
   * `data.json` beside the main file, so a template may read whichever is
   * simpler and the notebook's local binary gets the same document from the
   * same JSON file. `inputs` are further `sys.inputs`, `brand` for the
   * offer. Throws TypstCompileError with the errors in words.
   */
  compile(
    mainFile: string,
    files: TypstFiles,
    data: unknown,
    inputs?: TypstInputs
  ): Uint8Array
  /** The font families the compiler knows, for a diagnostic line. */
  fonts(): string[]
}

let instantiated: Promise<void> | null = null

/**
 * The module's bytes from a URL. A `.gz` URL is the vendored copy of
 * app/shared/typst/vendor (Cloudflare Pages takes no file over 25 MiB, the
 * raw module is 27), inflated here with the browser's own gzip decoder.
 * Anything else is fetched as is.
 */
const fetchModule = async (url: URL): Promise<ArrayBuffer> => {
  const response = await fetch(url)
  if (!response.ok || !response.body)
    throw new Error(`${response.status} for the compiler module`)
  if (!/\.gz(\?.*)?$/i.test(url.pathname)) return response.arrayBuffer()
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'this browser cannot inflate the compiler module (no DecompressionStream)'
    )
  }
  return new Response(
    response.body.pipeThrough(new DecompressionStream('gzip'))
  ).arrayBuffer()
}

/**
 * Instantiates the WASM once per thread. A second call with different bytes
 * is a programming error and is not supported: the module is a singleton
 * inside the package.
 */
const instantiate = (wasm: EngineSources['wasm']): Promise<void> => {
  if (!instantiated) {
    const bytes =
      wasm instanceof Uint8Array || wasm instanceof ArrayBuffer
        ? Promise.resolve(wasm)
        : fetchModule(new URL(String(wasm)))
    instantiated = bytes
      .then(source => init({module_or_path: source}))
      .then(() => undefined)
    instantiated.catch(() => {
      instantiated = null
    })
  }
  return instantiated
}

/**
 * Builds the engine: the WASM, then a compiler with no access to any real
 * file system (`set_dummy_access_model`) and the fonts registered as raw
 * bytes. About 100 ms in node for the module and two Open Sans faces, the
 * fetch of the 28 MB module is what a first call waits for in a browser.
 */
export async function createEngine(
  sources: EngineSources
): Promise<TypstEngine> {
  await instantiate(sources.wasm)

  const builder = new TypstCompilerBuilder()
  builder.set_dummy_access_model()
  for (const font of sources.fonts) await builder.add_raw_font(asBytes(font))
  const compiler: TypstCompiler = await builder.build()

  const encoder = new TextEncoder()

  return {
    compile(mainFile, files, data, inputs) {
      const main = normalise(mainFile)
      const json = JSON.stringify(data ?? {})
      const sysInputs: Array<[string, string]> = [
        ['data', json],
        ...Object.entries(inputs ?? {}).filter(([k]) => k !== 'data')
      ]

      // Every compile starts from an empty shadow: a file dropped from
      // `files` between two compiles must not linger from the last one.
      compiler.reset_shadow()
      for (const [path, content] of Object.entries(files)) {
        // Typst source goes in as a source, so `#import` parses it once
        // and diagnostics name the path. Everything else, a JSON label
        // set, an SVG, a plugin, is bytes, whatever the transport was.
        if (typeof content === 'string' && /\.typ$/i.test(path))
          compiler.add_source(normalise(path), content)
        else
          compiler.map_shadow(
            normalise(path),
            typeof content === 'string' ? encoder.encode(content) : content
          )
      }
      const dataPath = main.slice(0, main.lastIndexOf('/') + 1) + 'data.json'
      compiler.map_shadow(dataPath, encoder.encode(json))

      let answer: any
      try {
        answer = compiler.compile(
          main,
          sysInputs,
          'pdf',
          DIAGNOSTICS_AS_OBJECTS
        )
      } catch (raw) {
        const diagnostics = readDiagnostics(raw)
        throw new TypstCompileError(describe(diagnostics), diagnostics)
      }

      if (answer?.hasError || !(answer?.result instanceof Uint8Array)) {
        const diagnostics = readDiagnostics(answer?.diagnostics)
        throw new TypstCompileError(describe(diagnostics), diagnostics)
      }
      return answer.result
    },
    fonts() {
      try {
        return compiler.get_loaded_fonts()
      } catch {
        return []
      }
    }
  }
}
