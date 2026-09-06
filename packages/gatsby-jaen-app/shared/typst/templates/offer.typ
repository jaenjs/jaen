// offer.typ, the offer on the house layout.
//
// The same JSON as invoice.typ, extended by what an offer needs:
//
//   meta.validUntil   printed as "Gültig bis" in the meta block and in
//                     the status line
//   meta.code         the transfer code, BQ7Q4W-1; the reference line
//                     when meta.reference is the same, its own row else
//   links.confirm     the brand's /angebot/<token>, as text and QR code
//   links.decline     the brand's /angebot/<token>/ablehnen, the same way
//   language          de | en | tr | ar decides every label
//
// The recipient resolved from a customer takes the shipping address, as
// load_data does for an AN. The intro, the terms and the status come
// from the language file when the JSON has none, so the app may store
// the JSON with or without them and the page is the same.
//
//   typst compile --root . --font-path fonts --ignore-system-fonts \
//     --input data="$(cat offer.json)" --input brand=limosen templates/offer.typ out.pdf

#import "letter.typ": letter, load-data, load-labels, offer-links, fill-in, blank
#import "brands/index.typ": brand

#let data = load-data()
#let (code, labels) = load-labels(data)
#let data = { let d = data; d.insert("language", code); d }

#let b = brand(sys.inputs.at("brand", default: none))
#let sender = if "sender" in data and data.sender.len() > 0 { data.sender } else if b != none { b.sender } else { (:) }
// `logo` names an SVG from the compile root, for a sender without a brand
// file, the netsnek logo of the side by side for instance.
#let logo = if "logo" in sys.inputs { image(sys.inputs.logo, width: 62.3mm) } else if b != none { b.logo } else { none }

#let defaults = labels.defaults.offer
#let valid-until = str(data.at("meta", default: (:)).at("validUntil", default: ""))
#let data = {
  let d = data
  if "intro" not in d { d.insert("intro", (greeting: defaults.greeting, text: defaults.text)) }
  if "payment" not in d {
    d.insert("payment", (
      terms: defaults.terms,
      status: if blank(valid-until) { "" } else { fill-in(defaults.status, (validUntil: valid-until)) },
    ))
  }
  d
}

#let links = data.at("links", default: (:))
#let after = if links.len() > 0 { offer-links(links, labels) } else { none }

#letter(data, labels, kind: "offer", sender: sender, logo: logo, after-status: after)
