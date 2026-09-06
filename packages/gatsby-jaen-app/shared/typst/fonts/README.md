# Fonts

The fonts the templates are compiled with, and the only ones: the notebook
compiles with `--font-path fonts --ignore-system-fonts` and the browser
compiler bundles these files, so a page renders the same in both.

| file                                                | family           | source                                  | licence |
| --------------------------------------------------- | ---------------- | --------------------------------------- | ------- |
| OpenSans-Regular.ttf, OpenSans-Bold.ttf             | Open Sans        | fonts.google.com, the static instances  | OFL 1.1 |
| NotoSansArabic-Regular.ttf, NotoSansArabic-Bold.ttf | Noto Sans Arabic | fonts.gstatic.com, v33 static instances | OFL 1.1 |
| NotoSansMath-Regular.ttf                            | Noto Sans Math   | fonts.gstatic.com, v15                  | OFL 1.1 |

Open Sans is the house face of the invoices (invoice.sty loads the
`opensans` package). Noto Sans Arabic carries the Arabic letters the offer
needs in that language, Noto Sans Math the arrow between the two
addresses of a route (U+2192, in its Arrows block), which Open Sans lacks
and Noto Sans Symbols 2 does not carry either. It is 780 KB and used for
one glyph, a subset would do once the browser bundle minds the size. Typst falls back through the
list in `templates/letter.typ` in that order.
