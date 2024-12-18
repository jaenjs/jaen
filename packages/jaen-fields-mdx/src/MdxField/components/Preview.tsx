import {BaseEditorProps, MdastRoot} from './types.js'
// @ts-nocheck
import React, {useEffect, useMemo} from 'react'
import {Statistics, statistics} from 'vfile-statistics'

import {useMdx} from '../use-mdx.js'
import {PreviewComponent} from './PreviewComponent'

export interface BuildEditorProps {
  components: BaseEditorProps['components']

  onMdast: BaseEditorProps['onMdast']

  mdast?: MdastRoot
  value?: string
}

export const Preview = React.memo<BuildEditorProps>(
  ({components, mdast, value, onMdast}) => {
    const defaults = useMemo(
      () => ({
        gfm: true,
        frontmatter: true,
        math: true,
        directive: true,
        mdast,
        value
      }),
      [mdast, value]
    )

    const [state, _] = useMdx(defaults, true, components) as any

    const stats = useMemo(() => {
      return state.file ? statistics(state.file) : ({} as Statistics)
    }, [state.file])

    useEffect(() => {
      onMdast?.(state.file.data?.mdast)
    }, [state.mdast, onMdast])

    // useEffect(() => {
    //   console.log('useEffect', defaultValue)
    //   setConfig({value: defaultValue})
    // }, [defaultValue, setConfig])

    return (
      <PreviewComponent state={state} stats={stats} components={components} />
    )
  }
)
