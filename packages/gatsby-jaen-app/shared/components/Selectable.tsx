/**
 * The one mark that says a piece of text is data, design-consistency.md
 * rule 11.
 *
 * Inside `/app` the shell sets `user-select: none` on everything once
 * (src/components/AppShell.tsx), so the interface cannot be selected by
 * accident: a tap that drags a little no longer paints a button's word blue,
 * and a long press on a phone offers no selection handle over a heading. What
 * a person does want to select is data, and data says so with this one mark.
 * The shell's selector is `[data-selectable]`, so every element that carries
 * the attribute, however it was rendered, is selectable again, and a button or
 * a badge inside such an element is not.
 *
 * Two ways to carry it, both the same attribute:
 *
 * - `<Selectable>{transfer.pickup}</Selectable>` where the text is drawn as a
 *   `Text` of its own. It is a `Text` with the mark and with the wrapping
 *   rule 9 asks for, so a 60 character address, a mail address or a URL
 *   breaks inside its column instead of pushing the page wider.
 * - `{...selectable}` spread onto an element that already exists, a table
 *   cell or a card's value column, where wrapping is the column's own
 *   decision (a `DataTable` cell clips with an ellipsis, rule 8).
 */
import {Text, type TextProps} from '@chakra-ui/react'

/** The mark, to spread onto an element a screen already draws. */
export const selectable = {'data-selectable': true} as const

export interface SelectableProps extends TextProps {}

/**
 * A piece of data: selectable, and breaking anywhere so a long token stays
 * inside its column (rule 9). Everything else is a `Text`, so a caller sets
 * its own text style, colour, `truncate` or line clamp as before.
 */
export function Selectable(props: SelectableProps) {
  return <Text data-selectable overflowWrap="anywhere" {...props} />
}
