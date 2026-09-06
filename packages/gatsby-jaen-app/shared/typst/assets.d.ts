/**
 * The asset imports of the compiler module. Gatsby's webpack config runs
 * url-loader on fonts and images (`rules.fonts`, `rules.images`): a file
 * under 10 KB becomes a data URI, a larger one is written to
 * `/static/<name>-<hash>.<ext>` and the import is its URL. Either way the
 * import is a string `fetch` reads, which is all compile.ts needs.
 */
declare module '*.ttf' {
  const url: string
  export default url
}

declare module '*.svg' {
  const url: string
  export default url
}
