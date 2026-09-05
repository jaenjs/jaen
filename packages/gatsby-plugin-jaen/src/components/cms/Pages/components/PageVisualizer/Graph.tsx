import {useToken} from '@chakra-ui/react'
import {useColorMode} from 'jaen'
import {useEffect, useMemo, useRef} from 'react'

import {GraphCanvas, GraphCanvasRef, useSelection} from 'reagraph'
import {TreeNode, convertTreeToGraph} from './convert-tree-to-graph'

/**
 * A frame colour token as a literal the canvas can paint.
 *
 * Reads `--jaen-colors-<name>` off the root element and lets a 2D context
 * normalise whatever spelling the site used (hex, rgb, the space-separated
 * hsl of a v3 token) to the `#rrggbb` reagraph and three.js parse. The
 * fallback is jaen's own dark value, for a name the site's system does not
 * emit or a render before the document exists.
 */
const frameColor = (name: string, fallback: string): string => {
  if (typeof document === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(`--jaen-colors-${name}`)
    .trim()
  if (!raw) return fallback
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return fallback
  ctx.fillStyle = fallback
  ctx.fillStyle = raw
  return typeof ctx.fillStyle === 'string' ? ctx.fillStyle : fallback
}

export const Graph: React.FC<{
  tree: TreeNode[]
  selection?: string
  onSelect: (id: string) => void
}> = ({tree, selection, onSelect}) => {
  const data = convertTreeToGraph(tree)

  const graphRef = useRef<GraphCanvasRef>(null)
  const {
    selections,
    actives,
    onNodeClick,
    onCanvasClick,
    onNodePointerOver,
    onNodePointerOut,
    setSelections
  } = useSelection({
    ref: graphRef,
    nodes: data.nodes,
    edges: data.edges,
    pathHoverType: 'out',
    pathSelectionType: 'out',
    focusOnSelect: true,
    onSelection: selections => {
      const selection = selections[0]

      if (selection) {
        onSelect(selection)
      } else {
        onSelect('')
      }
    }
  })

  useEffect(() => {
    // check if selection is in the graph
    const selectionExists = data.nodes.find(node => node.id === selection)

    if (selectionExists) {
      setSelections(selection ? [selection] : [])

      graphRef.current?.centerGraph(selection ? [selection] : [])
    }
  }, [selection])

  // v3 dropped useToken's fallback argument and types the result as string[]
  // rather than a tuple, so under noUncheckedIndexedAccess the element reads as
  // possibly undefined while reagraph's Theme wants a colour everywhere. The
  // token is declared in the theme, so the assertion is the whole fallback.
  const brand500 = useToken('colors', ['brand.500'])[0]!
  const {colorMode} = useColorMode()

  /**
   * The graph is a WebGL canvas, and three.js wants a literal colour, not a
   * `var(--jaen-colors-…)` reference and not the `hsl(0 0% 10%)` a site may
   * spell its tokens in. In dark the canvas and its lines take the frame's
   * own surface, border and text tokens, read off the document at the time
   * of the render and normalised through a 2D context, so the page tree sits
   * on whatever dark the site decided, jaen's grey or the site's. Measured on
   * limosen.at in dark before this: a white canvas under charcoal chrome.
   * Light keeps the literals it always had.
   */
  const theme = useMemo(() => {
    if (colorMode === 'dark') {
      const canvas = frameColor('bg-surface', '#171923')
      const line = frameColor('border-emphasized', '#2D3748')
      const text = frameColor('fg-default', '#ffffff')
      const node = frameColor('fg-subtle', '#A0AEC0')
      const sub = frameColor('fg-muted', '#CBD5E0')
      return {
        canvas: {background: canvas},
        node: {
          fill: node,
          activeFill: brand500,
          opacity: 1,
          selectedOpacity: 1,
          inactiveOpacity: 1,
          label: {color: text, stroke: canvas, activeColor: brand500},
          subLabel: {color: sub, stroke: 'transparent', activeColor: brand500}
        },
        lasso: {
          border: '1px solid #55aaff',
          background: 'rgba(75, 160, 255, 0.1)'
        },
        ring: {fill: line, activeFill: brand500},
        edge: {
          fill: line,
          activeFill: brand500,
          opacity: 1,
          selectedOpacity: 1,
          inactiveOpacity: 1,
          label: {stroke: canvas, color: sub, activeColor: brand500, fontSize: 6}
        },
        arrow: {fill: line, activeFill: brand500},
        cluster: {
          stroke: line,
          opacity: 1,
          selectedOpacity: 1,
          inactiveOpacity: 1,
          label: {stroke: canvas, color: sub}
        }
      }
    }
    return {
      canvas: {background: '#fff'},
      node: {
        fill: '#7CA0AB',
        activeFill: brand500,
        opacity: 1,
        selectedOpacity: 1,
        inactiveOpacity: 1,
        label: {
          color: '#2A6475',
          stroke: '#fff',
          activeColor: brand500
        },
        subLabel: {
          color: '#ddd',
          stroke: 'transparent',
          activeColor: brand500
        }
      },
      lasso: {
        border: '1px solid #55aaff',
        background: 'rgba(75, 160, 255, 0.1)'
      },
      ring: {
        fill: '#D8E6EA',
        activeFill: brand500
      },
      edge: {
        fill: '#D8E6EA',
        activeFill: brand500,
        opacity: 1,
        selectedOpacity: 1,
        inactiveOpacity: 1,
        label: {
          stroke: '#fff',
          color: '#2A6475',
          activeColor: brand500,
          fontSize: 6
        }
      },
      arrow: {
        fill: '#D8E6EA',
        activeFill: brand500
      },
      cluster: {
        stroke: '#D8E6EA',
        opacity: 1,
        selectedOpacity: 1,
        inactiveOpacity: 1,
        label: {
          stroke: '#fff',
          color: '#2A6475'
        }
      }
    }
  }, [brand500, colorMode])

  return (
    <GraphCanvas
      selections={selections}
      actives={actives}
      onCanvasClick={onCanvasClick}
      onNodeClick={onNodeClick}
      onNodePointerOver={onNodePointerOver}
      onNodePointerOut={onNodePointerOut}
      ref={graphRef}
      layoutType="hierarchicalTd"
      theme={theme}
      nodes={data.nodes}
      edges={data.edges}
      sizingType="centrality"
    />
  )
}
