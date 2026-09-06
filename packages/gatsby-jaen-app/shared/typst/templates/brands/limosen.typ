// The limosen brand: the sender block and the logo.
//
// The sender is limosen.json beside this file, so the app and the
// notebook read the same block the template does: companyName,
// contactEmail and contactPhone from limosen.at/src/vars, and nothing
// that is not there. What the invoice layout needs and the site does
// not hold is listed under `missing` in the JSON and prints as empty
// footer columns until somebody fills it in. Invent nothing.
//
// The logo is the SVG of limosen.at/src/gatsby-plugin-jaen/components/
// Logo-limosen.tsx with currentColor resolved to the brand gold #d4af37.
// The crest is nearly as tall as wide, so it is set by height: 26 mm
// keeps it above the sender line at 44 mm.

#let name = "limosen"
#let sender = json("limosen.json")
#let logo = image("limosen-logo.svg", height: 26mm)
