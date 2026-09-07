/**
 * Stub for `ts-morph` in the Workers bundle.
 *
 * Pylon uses ts-morph to read a project's TypeScript and derive the GraphQL
 * schema from it. That happens at BUILD time -- by the point a request is
 * being served the schema is already baked in -- but the import survives into
 * the bundled output, and esbuild cannot resolve a package that only ever
 * existed on the build machine.
 *
 * Aliasing it here keeps the module graph resolvable. If any of these are ever
 * actually called at runtime, that is a genuine bug rather than something to
 * paper over, so they throw with a message that says exactly that instead of
 * quietly returning undefined.
 */
const unreachable = (name: string): never => {
  throw new Error(
    `ts-morph.${name} was called at runtime. It is a build-time dependency of ` +
      `Pylon's schema generation and is stubbed out in the Workers bundle, so ` +
      `reaching it means something is deriving a schema in production.`
  )
}

export const Node = new Proxy(
  {},
  {get: (_, prop) => unreachable(`Node.${String(prop)}`)}
)

export const SyntaxKind = new Proxy(
  {},
  {get: (_, prop) => unreachable(`SyntaxKind.${String(prop)}`)}
)

export const Project = class {
  constructor() {
    unreachable('Project')
  }
}

/**
 * ts-morph re-exports the TypeScript compiler namespace as `ts`. Pylon's
 * build code imports it alongside the rest, so the stub has to offer it or
 * esbuild fails on the missing export.
 */
export const ts = new Proxy(
  {},
  {get: (_, prop) => unreachable(`ts.${String(prop)}`)}
)

export default {Node, SyntaxKind, Project, ts}
