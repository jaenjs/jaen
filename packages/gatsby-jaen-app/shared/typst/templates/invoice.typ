// invoice.typ, the invoice on the house layout.
//
// The data contract is the invoice JSON of netsnek/invoice and of the
// Limousinen Orient Service, one JSON per document:
//
//   sender     company, line, fn, address[], contact[], legal[], bank[]
//   meta       id, title ("Rechnung Nr. {id}"), date, deliveryDate,
//              reference, servicePeriod, customerId, contactPerson, vatId
//   recipient  the addressee's lines, or
//   customer   name, vatId, shippingAddress[], invoiceAddress[], the
//              Kunden/<customerId>.json of the netsnek repository, from
//              which the recipient is resolved (the invoice address here)
//   intro      greeting, text
//   items[]    title, description (multi-line, "- " lists), qty (a number,
//              "57,7833 Std" or "pauschal"), unit, unitPrice, discountPercent
//   totals     taxRate and taxInclusive, or taxNote
//   payment    terms, status
//   language   de | en | tr | ar, German when absent
//
// Inputs: `data` the JSON text (else data.json beside this file),
// `customer` the customer JSON text, `brand` limosen | booklimo for the
// logo and the sender block when the JSON brings none, `language`.
//
//   typst compile --root . --font-path fonts --ignore-system-fonts \
//     --input data="$(cat RE-260002.json)" templates/invoice.typ out.pdf

#import "letter.typ": letter, load-data, load-labels, blank
#import "brands/index.typ": brand

#let data = load-data()
#let (code, labels) = load-labels(data)
#let data = { let d = data; d.insert("language", code); d }

#let b = brand(sys.inputs.at("brand", default: none))
#let sender = if "sender" in data and data.sender.len() > 0 { data.sender } else if b != none { b.sender } else { (:) }
// `logo` names an SVG from the compile root, for a sender without a brand
// file, the netsnek logo of the side by side for instance.
#let logo = if "logo" in sys.inputs { image(sys.inputs.logo, width: 62.3mm) } else if b != none { b.logo } else { none }

// The intro and the terms of the language when the JSON has none.
#let defaults = labels.defaults.invoice
#let data = {
  let d = data
  if "intro" not in d { d.insert("intro", (greeting: defaults.greeting, text: defaults.text)) }
  if "payment" not in d { d.insert("payment", (terms: defaults.terms, status: defaults.status)) }
  d
}

#letter(data, labels, kind: "invoice", sender: sender, logo: logo)
