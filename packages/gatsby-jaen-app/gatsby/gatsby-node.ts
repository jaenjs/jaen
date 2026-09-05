import {GatsbyNode, PluginOptions} from 'gatsby'
import {execFileSync} from 'node:child_process'
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'

export interface JaenAppPluginOptions extends PluginOptions {
  pylonUrl?: string
  driverRoleKey?: string
  /**
   * The project role that marks a customer, the counterpart of
   * `driverRoleKey`. A role key names a company: limosen grants
   * `limosen:customer`, KRC grants `krc:customer`, and neither account may
   * ever be given the other's. Optional, and the platform's own key is the
   * default, so a site that says nothing behaves as before.
   */
  customerRoleKey?: string
  /**
   * The name the app's top bar shows, `Limosen` or `KRC Limo`. Optional: a
   * site that sets none gets its own hostname, which is always the right
   * brand and never the other one.
   */
  brandName?: string
  /**
   * `limosen` or `booklimo`, the brand this build is. Optional: it is derived
   * from the pylonUrl's hostname when absent, and that is right for both
   * sites. It ends up in /app/version.json so a reader of that file sees at
   * once which brand it came from.
   */
  brand?: 'limosen' | 'booklimo'
}

export const pluginOptionsSchema: GatsbyNode['pluginOptionsSchema'] = ({
  Joi
}) => {
  return Joi.object({
    pylonUrl: Joi.string(),
    driverRoleKey: Joi.string(),
    customerRoleKey: Joi.string(),
    brandName: Joi.string(),
    brand: Joi.string().valid('limosen', 'booklimo')
  })
}

// --------------------------------------------------------------------------
// Which build is this. okf/operations/versions.md.
//
// Three values, computed once per build process so the defines the bundle
// carries and the /app/version.json the site serves say the same thing:
//   version  app/package.json, bumped by hand before every deploy
//   commit   the short git sha of the taxi-app checkout the package came from
//   builtAt  the instant this process started
// --------------------------------------------------------------------------

/** The plugin's own root, found by walking up from wherever tsc put this file. */
function pluginRoot(): string {
  let dir = __dirname
  for (let i = 0; i < 6; i += 1) {
    const candidate = join(dir, 'package.json')
    if (existsSync(candidate)) {
      try {
        const pkg = JSON.parse(readFileSync(candidate, 'utf8'))
        if (pkg?.name === 'gatsby-jaen-app') return dir
      } catch {
        // Not our package.json, keep walking.
      }
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return resolve(__dirname, '..', '..')
}

function appVersion(root: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    return typeof pkg?.version === 'string' && pkg.version ? pkg.version : '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function git(cwd: string, ...args: string[]): string | null {
  try {
    return execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {
    return null
  }
}

/**
 * The taxi-app checkout this package is a copy of.
 *
 * The package lives twice: in taxi-app/app, where it is versioned, and as
 * packages/gatsby-jaen-app in the jaen checkout the sites link against, which
 * is a plain copy inside a different repository (scripts/sync-app.sh). A sha
 * read from the copy's own git would be jaen's and mean nothing here. So:
 * JAEN_APP_COMMIT in the environment wins, then the checkout is found where
 * sync-app.sh expects its mirror image (taxi-app beside limosen-v3), or
 * through TAXI_APP_DIR. When none of that resolves, the commit is null and
 * the version line shows the number alone rather than a sha that lies.
 */
function appCommit(root: string): string | null {
  const fromEnv = (process.env.JAEN_APP_COMMIT ?? '').trim()
  if (fromEnv) return fromEnv

  const candidates = [
    process.env.TAXI_APP_DIR,
    // the versioned copy itself: <taxi-app>/app
    resolve(root, '..'),
    // the jaen copy: <limosen-v3>/jaen/packages/gatsby-jaen-app, taxi-app beside limosen-v3
    resolve(root, '..', '..', '..', '..', 'taxi-app')
  ].filter((dir): dir is string => !!dir)

  for (const dir of candidates) {
    if (!existsSync(join(dir, 'pylon', 'prisma', 'schema.prisma'))) continue
    if (!existsSync(join(dir, 'app', 'package.json'))) continue
    const sha = git(dir, 'rev-parse', '--short', 'HEAD')
    if (!sha) continue
    // Uncommitted changes under app/ ship under a sha that does not carry
    // them. Say so in the stamp rather than pretend it is a clean build.
    const dirty = git(dir, 'status', '--porcelain', '--', 'app')
    return dirty ? `${sha}-dirty` : sha
  }
  return null
}

// Module level and not exported: Gatsby validates every export of a
// gatsby-node against its list of node APIs and logs ERROR #11329 for each
// name it does not know, three times per build for these three.
const ROOT = pluginRoot()
const APP_VERSION = appVersion(ROOT)
const APP_COMMIT = appCommit(ROOT)
const APP_BUILT_AT = new Date().toISOString()

/** `limosen` or `booklimo`, from the option or the pylon's hostname. */
function brandOf(options: JaenAppPluginOptions): string | null {
  if (options.brand) return options.brand
  try {
    const host = new URL(options.pylonUrl ?? '').hostname
    if (host.endsWith('limosen.at')) return 'limosen'
    if (host.endsWith('booklimo.at')) return 'booklimo'
  } catch {
    // No pylonUrl, or not a URL. The brand is then unknown and stays null.
  }
  return null
}

export const onCreateWebpackConfig: GatsbyNode['onCreateWebpackConfig'] =
  async ({actions, plugins}, pluginOptions: JaenAppPluginOptions) => {
    // The Vite preview harness that every loader rule used to exclude here is
    // gone with the Tailwind screens it previewed.
    actions.setWebpackConfig({
      plugins: [
        plugins.define({
          __JAEN_APP_PYLON_URL__: JSON.stringify(pluginOptions.pylonUrl),
          /**
           * The project role that marks somebody as a driver, per brand:
           * `krc:driver` for one, `limosen:driver` for the other. The dispatch
           * screen filters its driver picker by it, because listing every
           * account there put customers, hotel front desks and machine users
           * in a dropdown meant for drivers.
           */
          __JAEN_APP_DRIVER_ROLE__: JSON.stringify(
            pluginOptions.driverRoleKey ?? null
          ),
          __JAEN_APP_CUSTOMER_ROLE__: JSON.stringify(
            pluginOptions.customerRoleKey ?? null
          ),
          __JAEN_APP_BRAND_NAME__: JSON.stringify(
            pluginOptions.brandName ?? null
          ),
          // The build stamp, the same three values /app/version.json carries.
          __JAEN_APP_VERSION__: JSON.stringify(APP_VERSION),
          __JAEN_APP_COMMIT__: JSON.stringify(APP_COMMIT),
          __JAEN_APP_BUILT_AT__: JSON.stringify(APP_BUILT_AT),
          /**
           * The Mapbox token, from the site's .env. Gatsby inlines GATSBY_*
           * variables into plugin code as well, but an explicit define says
           * where the value comes from, and an empty string here is what the
           * map shows its "no token" message for.
           */
          __JAEN_MAPBOX_TOKEN__: JSON.stringify(
            process.env.GATSBY_MAPBOX_TOKEN ?? ''
          )
        })
      ]
    })
  }

/**
 * Writes public/app/version.json, the file that says which app a site runs.
 *
 * A site that serves none is running the app from before the rebuild, which
 * is read as 0.1. tests/15-versions.ipynb fetches this file from both brands
 * and fails when they differ or when either is missing.
 */
export const onPostBuild: GatsbyNode['onPostBuild'] = async (
  {store, reporter},
  pluginOptions: JaenAppPluginOptions
) => {
  const programDir: string = store.getState().program.directory
  const target = join(programDir, 'public', 'app', 'version.json')

  const stamp = {
    app: APP_VERSION,
    commit: APP_COMMIT,
    builtAt: APP_BUILT_AT,
    brand: brandOf(pluginOptions),
    pylonUrl: pluginOptions.pylonUrl ?? null
  }

  mkdirSync(dirname(target), {recursive: true})
  writeFileSync(target, JSON.stringify(stamp, null, 2) + '\n')
  reporter.info(
    `gatsby-jaen-app: wrote /app/version.json (app ${stamp.app}, commit ${stamp.commit ?? 'unknown'}, brand ${stamp.brand ?? 'unknown'})`
  )
}
