# Sample offers

One JSON per brand with what the app stores on a `TransferDocument` row:
the contract of `templates/offer.typ` without `sender`, `intro` and
`payment`, which the template takes from the brand file and the language
file when they are absent. The app writes them into the stored JSON the
same way, so a document rendered from its row and one rendered from
these files are the same page.

The names and addresses are invented, the links are not signed tokens,
and the item lines are German: the item text is the app's to write in
the booking's language from its catalogues, the template only sets it.

    ../render.sh offer offer-limosen.json out.pdf limosen "" en
