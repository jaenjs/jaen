// The smallest document the browser compiler has to get right: Open Sans
// regular and bold from the bundled fonts, the data as the app hands it
// over (a data.json beside the template and the same JSON under
// sys.inputs.data), and a page counter, which is what the letter's footer
// needs. It is the smoke test of compile.ts, not a letter.
#set page(paper: "a4", margin: 20mm)
#set text(font: "Open Sans", size: 10pt)

#let data = json("data.json")
#let from-input = sys.inputs.at("data", default: none)

= Hello #data.at("name", default: "Typst")

#text(weight: "bold")[Bold Open Sans] and regular Open Sans.

Number: #data.at("number", default: "none")

Input matches file: #if from-input != none and json(bytes(from-input)) == data [yes] else [no]

Seite #context counter(page).display() von #context counter(page).final().first()
