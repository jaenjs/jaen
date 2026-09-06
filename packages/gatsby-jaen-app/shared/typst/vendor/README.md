# The compiler's WASM, gzipped

`typst-ts-web-compiler-0.7.0.wasm.gz` is
`node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm`
of the pinned 0.7.0 (Typst 0.14.2), compressed with `gzip -9 -n`, 10.8 MB
instead of 28.3 MB.

Why a file in the repository and not the package's own: the sites deploy
with `wrangler pages deploy`, and Cloudflare Pages refuses any file over
25 MiB, which the raw module is. The browser has no brotli decoder in
`DecompressionStream`, gzip it has (Chrome 80, Firefox 113, Safari 16.4),
so gzip it is, inflated once in the compiler worker
(app/shared/typst/engine.ts) and instantiated from the bytes. Cloudflare
does not recompress a `.gz`, so what is on disk is what travels.

Regenerate after bumping the dependency, and rename the file to the new
version so a stale copy is impossible:

    gzip -9 -n -c node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm \
      > app/shared/typst/vendor/typst-ts-web-compiler-<version>.wasm.gz

and point `WASM_URL` in compile.ts at it.
