// The booklimo brand: the sender block and the logo.
//
// The sender is booklimo.json beside this file, so the app and the
// notebook read the same block the template does: companyName,
// contactEmail and contactPhone from booklimo.at/src/vars/brand.ts, the
// postal address from the footer of the brand's own mail templates, and
// nothing else. What the invoice layout needs and the site does not
// hold is listed under `missing` in the JSON and prints as empty footer
// columns until somebody fills it in. Invent nothing.
//
// The logo is the SVG of booklimo.at/src/gatsby-plugin-jaen/components/
// Logo-booklimo.tsx with currentColor resolved to the brand gold
// #d4af37, 62.3 mm wide as the house layout sets its logo.

#let name = "booklimo"
#let sender = json("booklimo.json")
#let logo = image("booklimo-logo.svg", width: 62.3mm)
