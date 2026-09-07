// confirmation.typ, the booking confirmation on the house layout.
//
// okf/architecture/mail-audiences.md, "The confirmation PDF": a customer
// who is a hotel prints this for the guest's file, so it is the same
// letter as the offer and the invoice with the ride's details, the price
// where one is set, the driver and the car once the driver has said yes,
// and the ride link as a QR code.
//
// The data contract is the invoice JSON of letter.typ with three
// differences, all optional, so a confirmation is still a document the
// same reader reads:
//
//   meta.id        the transfer code, BQ7Q4W-1, not a document number:
//                  a confirmation draws no number from the counter, it
//                  names the booking it confirms
//   links.ride     the brand's /fahrt/<token>, printed as text and as a
//                  QR code under the terms
//   ride           the car and the driver once the driver said yes:
//                  driver (the first name), car, plate, colour. Absent
//                  or empty while nobody has, and then the block reads
//                  the language file's "wird zugeteilt" line instead.
//
// Compiled in the Worker (pylon/src/documents/typst.ts) on every
// confirmation, and in the browser by the same engine for a preview.
//
//   typst compile --root . --font-path fonts --ignore-system-fonts \
//     --input data="$(cat confirmation.json)" --input brand=limosen \
//     templates/confirmation.typ out.pdf

#import "letter.typ": letter, load-data, load-labels, fill-in, blank, prose, sz, leading, par-gap
#import "vendor/zebra/lib.typ": qrcode
#import "brands/index.typ": brand

#let data = load-data()
#let (code, labels) = load-labels(data)
#let data = { let d = data; d.insert("language", code); d }

#let b = brand(sys.inputs.at("brand", default: none))
#let sender = if "sender" in data and data.sender.len() > 0 { data.sender } else if b != none { b.sender } else { (:) }
#let logo = if "logo" in sys.inputs { image(sys.inputs.logo, width: 62.3mm) } else if b != none { b.logo } else { none }

#let defaults = labels.defaults.at("confirmation", default: labels.defaults.offer)
#let data = {
  let d = data
  if "intro" not in d { d.insert("intro", (greeting: defaults.greeting, text: defaults.text)) }
  if "payment" not in d { d.insert("payment", (terms: defaults.terms, status: defaults.status)) }
  d
}

/// The ride link and the car, between the terms and the closing.
///
/// Left the QR code of the ride page with its label and the address in
/// small print, the way offer-links sets the two offer links, the zero
/// width spaces so the URL breaks after any character. Right the driver
/// and the car once `ride` names them, and the language file's one line
/// "Ihr Fahrer wird noch zugeteilt" while it does not, because a
/// confirmation is printed and handed over long before a driver is asked.
/// The block never splits across pages.
#let ride-block(links, ride, labels) = {
  let l = labels.at("ride", default: (:))
  let url = str(links.at("ride", default: ""))
  let has-driver = ride != none and ride.len() > 0 and not blank(ride.at("driver", default: "")) 
  let has-car = ride != none and ride.len() > 0 and not blank(ride.at("car", default: ""))

  let link-cell = if blank(url) { [] } else {
    grid(columns: (16mm, 1fr), column-gutter: 2.5mm, align: top,
      qrcode(url, width: 16mm, quiet-zone: 0),
      {
        set par(leading: leading(9, 12), spacing: par-gap(9, 12, extra: 0.5mm))
        par(prose(l.at("open", default: "Ihre Fahrt öffnen"), weight: "bold"))
        par(text(size: sz(6.5), dir: ltr, link(url, url.clusters().join("\u{200B}"))))
      })
  }

  let car-cell = {
    set par(leading: leading(9, 12), spacing: par-gap(9, 12, extra: 0.5mm))
    if has-driver or has-car {
      par(prose(l.at("title", default: "Ihr Fahrzeug"), weight: "bold"))
      let lines = ()
      if has-driver { lines.push(fill-in(l.at("driver", default: "Fahrer: {driver}"), (driver: str(ride.driver)))) }
      if has-car {
        let name = str(ride.car)
        if not blank(ride.at("colour", default: "")) { name += ", " + str(ride.colour) }
        lines.push(name)
      }
      if not blank(ride.at("plate", default: "")) { lines.push(str(ride.plate)) }
      for line in lines { par(prose(line)) }
    } else {
      par(prose(l.at("pending", default: "Ihr Fahrer wird rechtzeitig zugeteilt."), weight: "bold"))
    }
  }

  block(width: 160mm, breakable: false, above: par-gap(9, 12, extra: 3.7mm),
    grid(columns: (1fr, 1fr), column-gutter: 6mm, link-cell, car-cell))
}

#let links = data.at("links", default: (:))
#let ride = data.at("ride", default: (:))
#let after = ride-block(links, ride, labels)

#letter(data, labels, kind: "confirmation", sender: sender, logo: logo, after-status: after)
