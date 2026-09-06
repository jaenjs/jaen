/**
 * The compiler off the main thread.
 *
 * compile.ts starts this worker with `new Worker(new URL('./compile.worker.ts',
 * import.meta.url), {type: 'module'})`, which webpack turns into a chunk of
 * its own beside the compiler's, so the 28 MB module is fetched and
 * instantiated here and a compile never freezes the dialog it runs for.
 *
 * Two messages in, one answer each, matched by `id`:
 *
 *   {id, type: 'init', wasm, fonts}          wasm an absolute URL, fonts the
 *                                            font files as ArrayBuffers
 *   {id, type: 'compile', mainFile, files, data, inputs}
 *
 *   {id, ok: true}                           after init
 *   {id, ok: true, pdf}                      the PDF bytes, transferred
 *   {id, ok: false, error, diagnostics}      the failure in words
 */
import {
  createEngine,
  TypstCompileError,
  type TypstEngine,
  type TypstFiles,
  type TypstInputs
} from './engine'

type Request =
  | {id: number; type: 'init'; wasm: string; fonts: ArrayBuffer[]}
  | {
      id: number
      type: 'compile'
      mainFile: string
      files: TypstFiles
      data: unknown
      inputs?: TypstInputs
    }

let engine: Promise<TypstEngine> | null = null

const scope = self as unknown as {
  postMessage: (message: unknown, transfer?: Transferable[]) => void
  onmessage: ((event: MessageEvent<Request>) => void) | null
}

const fail = (id: number, error: unknown) => {
  const diagnostics =
    error instanceof TypstCompileError ? error.diagnostics : []
  const message = error instanceof Error ? error.message : String(error)
  scope.postMessage({id, ok: false, error: message, diagnostics})
}

scope.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data
  try {
    if (request.type === 'init') {
      engine = createEngine({wasm: request.wasm, fonts: request.fonts})
      await engine
      scope.postMessage({id: request.id, ok: true})
      return
    }
    if (!engine) throw new Error('compile before init')
    const pdf = (await engine).compile(
      request.mainFile,
      request.files,
      request.data,
      request.inputs
    )
    // A copy, because the compiler's answer may be a view on WASM memory.
    const bytes = new Uint8Array(pdf)
    scope.postMessage({id: request.id, ok: true, pdf: bytes}, [bytes.buffer])
  } catch (error) {
    fail(request.id, error)
  }
}
