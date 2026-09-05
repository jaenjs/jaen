/**
 * One muted line saying which app this is: `App 1.0.0 · abc1234`.
 *
 * The values are the build stamp gatsby/gatsby-node.ts defines, the same
 * three /app/version.json carries, so what a person reads in the user menu
 * is what tests/15-versions.ipynb reads off the site. Read as bare
 * identifiers behind typeof, see okf/decisions/hard-rules.md. A build that
 * defines none of them, which is only a build of the plugin outside Gatsby,
 * shows 0.0.0 rather than nothing, so the line is never silently absent.
 *
 * Its text is registered into the frame's user menu by the shell
 * (src/components/useFrameMenu.ts), the component itself is for screens. Everything is Chakra semantic
 * tokens, so the site's palette decides how muted it is.
 */
import {Text, type TextProps} from '@chakra-ui/react'

declare const __JAEN_APP_VERSION__: string | undefined
declare const __JAEN_APP_COMMIT__: string | null | undefined
declare const __JAEN_APP_BUILT_AT__: string | undefined

export interface AppVersion {
  app: string
  commit: string | null
  builtAt: string | null
}

/** The stamp the bundle carries. */
export function appVersion(): AppVersion {
  return {
    app: typeof __JAEN_APP_VERSION__ !== 'undefined' && __JAEN_APP_VERSION__ ? __JAEN_APP_VERSION__ : '0.0.0',
    commit: typeof __JAEN_APP_COMMIT__ !== 'undefined' && __JAEN_APP_COMMIT__ ? __JAEN_APP_COMMIT__ : null,
    builtAt: typeof __JAEN_APP_BUILT_AT__ !== 'undefined' && __JAEN_APP_BUILT_AT__ ? __JAEN_APP_BUILT_AT__ : null
  }
}

/** The text of the line, for places that take a string, the frame's user menu among them. */
export function versionLineText(): string {
  const {app, commit} = appVersion()
  return commit ? `App ${app} · ${commit}` : `App ${app}`
}

export interface VersionLineProps extends Omit<TextProps, 'children'> {}

export function VersionLine(props: VersionLineProps) {
  const {builtAt} = appVersion()
  const line = versionLineText()
  return (
    <Text
      as="span"
      fontSize="xs"
      color="fg.muted"
      fontVariantNumeric="tabular-nums"
      whiteSpace="nowrap"
      title={builtAt ?? undefined}
      {...props}>
      {line}
    </Text>
  )
}
