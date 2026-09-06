// The brands by name. Typst imports are static, so both brand files are
// read and the caller picks one: `brand("limosen")` answers the sender
// block and the logo, `brand(none)` answers none, which lets the letter
// take the sender from the JSON and set the company name as its logo.

#import "limosen.typ" as limosen
#import "booklimo.typ" as booklimo

#let brands = (
  limosen: (name: limosen.name, sender: limosen.sender, logo: limosen.logo),
  booklimo: (name: booklimo.name, sender: booklimo.sender, logo: booklimo.logo),
)

#let brand(name) = {
  if name == none { return none }
  let key = lower(str(name)).trim()
  if key in brands { brands.at(key) } else { panic("unknown brand: " + key + ", one of " + brands.keys().join(", ")) }
}
