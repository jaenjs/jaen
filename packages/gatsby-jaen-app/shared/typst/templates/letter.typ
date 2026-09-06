// letter.typ, the house layout.
//
// The invoice of the Limousinen Orient Service (RE-260002.pdf) and the
// netsnek invoice (netsnek/invoice, main.tex) are set by one LuaLaTeX
// package, invoice.sty. This file is that package in Typst, block for
// block: A4, margins top 19 mm, bottom 35 mm, left 21 mm, right 18 mm,
// the logo top right with its right edge at 187.2 mm, the sender line in
// 6 pt at 44 mm, the addressee at 54 mm, the meta block at 124.6 mm, the
// bold title at 92 mm below the top margin, the positions table of
// 168 mm with the grey rows, the terms, the closing, the four column
// footer in grey 7 pt at 268 mm, the page number at 264 mm, and the
// three fold marks on the left edge. Open Sans throughout, Noto Sans
// Arabic behind it for the Arabic letters and Noto Sans Math for the
// arrow of a route, which Open Sans does not have.
//
// Every measure below is the one in invoice.sty. Where LaTeX says pt it
// means TeX points (1/72.27 in) and Typst means PostScript points
// (1/72 in), so every font size and baseline distance is multiplied by
// 72/72.27. Typst measures a line of text from its cap height to its
// baseline, so a TeX baseline distance b at size s is a Typst leading of
// b - 0.7139 s (the cap height of Open Sans). Where the LaTeX row
// struts and minipage depths add up to a distance, the distance was
// read off the reference PDF with pdftotext -bbox-layout and is written
// here as that number, with the derivation beside it.
//
// The data contract is the invoice JSON of the two pipelines, one JSON
// per document, see invoice.typ and offer.typ. `letter` takes the parsed
// dictionary, the label set of the language, the sender and the logo,
// and returns the pages.

#import "vendor/zebra/lib.typ": qrcode

// ---------------------------------------------------------------------
// Units and colours
// ---------------------------------------------------------------------

/// A TeX point in Typst points.
#let tex = 72 / 72.27

/// Open Sans, OS/2 capHeight 1462 / 2048. Typst's default top edge.
#let cap-height = 0.7139

/// A TeX font size as a Typst length.
#let sz(pt) = pt * tex * 1pt

/// The Typst leading for a TeX size and baseline distance.
#let leading(size, baseline) = sz(baseline) - sz(size) * cap-height

/// The gap between two paragraphs so that their baselines are `baseline`
/// TeX points apart plus `extra`, for text of TeX size `size`.
#let par-gap(size, baseline, extra: 0mm) = leading(size, baseline) + extra

/// \definecolor{rowgray}{gray}{0.93}
#let rowgray = luma(237)

/// \definecolor{footertext}{gray}{0.4}
#let footergray = rgb(102, 102, 102)

/// The fold marks, line width 1.4 TeX pt.
#let fold-stroke = 1.4 * tex * 1pt + black

// The five columns, tabcolsep 1 mm on each side, @{} at both ends:
// 8 + 82 + 18 + 26 + 26 = 160 mm of text plus 8 mm of padding.
#let col-pos = 10mm
#let col-desc = 84mm
#let col-qty = 20mm
#let col-unit = 28mm
#let col-total = 28mm
#let table-width = col-pos + col-desc + col-qty + col-unit + col-total

/// \BodyOffset, the title, the intro and the terms start here.
#let body-offset = 1.1mm

// A row with \barstrut under arraystretch 1.1 at 9/13.5: 16.05 TeX pt
// tall, the baseline 4.46 TeX pt above its bottom.
#let strut-row = sz(16.05)
#let strut-depth = sz(4.46)

// A row without the strut, 1.1 times the 13.5 pt baseline.
#let plain-row = sz(14.85)

// ---------------------------------------------------------------------
// Strings and numbers
// ---------------------------------------------------------------------

/// "{id}" and friends in a string, the way apply_templates does it.
#let fill-in(s, vars) = {
  let out = str(s)
  for (key, value) in vars.pairs() {
    out = out.replace("{" + key + "}", str(value))
  }
  out
}

/// True for none, an empty string or whitespace.
#let blank(v) = v == none or str(v).trim() == ""

/// The direction of a run of text: right to left when it carries Arabic
/// letters, left to right otherwise. The page stays left to right in
/// every language, the blocks, the columns and the alignment are the
/// house layout's, and only the words inside a paragraph follow their
/// script, so that Arabic punctuation sits where Arabic puts it and a
/// German address or a date keeps its order.
#let dir-of(s) = if str(s).match(regex("\\p{Arabic}")) != none { rtl } else { ltr }

/// A run of text in its own direction.
#let prose(s, ..args) = text(dir: dir-of(s), ..args, str(s))

/// A value from a nested dictionary, "" when the path leads nowhere.
#let get(data, ..keys, default: "") = {
  let v = data
  for key in keys.pos() {
    if type(v) == dictionary and key in v { v = v.at(key) } else { return default }
  }
  if v == none { default } else { v }
}

/// A number as fmt_num prints it: the decimal comma, no trailing zeros.
#let fmt-num(x) = {
  let n = float(x)
  if calc.trunc(n) == n { str(int(n)) } else { str(n).replace(".", ",") }
}

/// An amount as fmt_euro prints it: "1.400,00 EUR", rounded half up.
#let fmt-euro(amount) = {
  let cents = int(calc.floor(calc.abs(float(amount)) * 100 + 0.5))
  let whole = str(calc.quo(cents, 100))
  let frac = calc.rem(cents, 100)
  let digits = whole.clusters()
  let grouped = ""
  for (i, d) in digits.enumerate() {
    if i > 0 and calc.rem(digits.len() - i, 3) == 0 { grouped += "." }
    grouped += d
  }
  let sign = if float(amount) < 0 and cents > 0 { "-" } else { "" }
  sign + grouped + "," + (if frac < 10 { "0" } else { "" }) + str(frac) + " EUR"
}

/// The quantity of an item: the number it counts with and the text it
/// shows. A number shows as is, "57,7833 Std" counts 57.7833 and shows
/// as written, "pauschal" counts one, and a separate `unit` overrides
/// the unit in the text. The comma is a decimal comma, which is the one
/// place this differs from the Lua, whose pattern split "4,00 Stk" into
/// 4 and ",00 Stk".
#let parse-qty(item) = {
  let raw = item.at("qty", default: 1)
  let count = 1.0
  let shown = ""
  if type(raw) == int or type(raw) == float {
    count = float(raw)
    shown = fmt-num(raw)
  } else {
    let s = str(raw).trim()
    let m = s.match(regex("^([0-9]+(?:[.,][0-9]+)?)\\s*(.*)$"))
    if m != none {
      count = float(m.captures.at(0).replace(",", "."))
      let unit = m.captures.at(1).trim()
      shown = m.captures.at(0) + (if unit != "" { " " + unit } else { "" })
    } else {
      shown = s
    }
  }
  let unit = str(item.at("unit", default: ""))
  if unit.trim() != "" { shown = fmt-num(count) + " " + unit.trim() }
  (count: count, shown: shown)
}

/// The positions and the totals, calculate_all in invoice.sty. With
/// `taxInclusive` the unit prices are gross and the tax is taken out of
/// the sum, otherwise it is added on top. Without a `taxRate` the sum is
/// the total and `taxNote` says why.
#let compute(data, labels) = {
  let rows = ()
  let sum = 0.0
  for (i, item) in data.at("items", default: ()).enumerate() {
    let price = float(item.at("unitPrice", default: 0))
    let discount = float(item.at("discountPercent", default: 0))
    let qty = parse-qty(item)
    let line = qty.count * price
    let off = line * discount / 100
    let final = line - off
    sum += final
    rows.push((
      pos: str(i + 1) + ".",
      title: str(item.at("title", default: "")),
      description: str(item.at("description", default: "")),
      qty: qty.shown,
      price: fmt-euro(price),
      total: fmt-euro(final),
      discount: if discount > 0 {
        (text: fill-in(labels.table.discount, (percent: fmt-num(discount))), amount: fmt-euro(off))
      } else { none },
    ))
  }
  let totals = data.at("totals", default: (:))
  let rate = float(totals.at("taxRate", default: 0))
  let inclusive = totals.at("taxInclusive", default: false) == true
  let (net, vat, gross) = if inclusive and rate > 0 {
    let n = sum / (1 + rate / 100)
    (n, sum - n, sum)
  } else {
    let v = sum * rate / 100
    (sum, v, sum + v)
  }
  (rows: rows, net: net, vat: vat, gross: gross, rate: rate, note: str(totals.at("taxNote", default: "")))
}

// ---------------------------------------------------------------------
// Multi-line text, the way safe_tex reads it
// ---------------------------------------------------------------------

/// Lines separated by newlines, "- item" lines as a list with a hanging
/// indent, a blank line as a paragraph break. `gap` is what a blank line
/// adds between the baselines (\parskip), `lead` the leading of the text.
#let md-text(raw, size: 9, baseline: 12, gap: 0mm) = {
  let lines = str(raw).replace("\r\n", "\n").replace("\r", "\n").split("\n")
  let blocks = ()
  let current = none
  for line in lines {
    let item = line.match(regex("^\\s*-\\s+(.*)$"))
    if item != none {
      if current == none or current.kind != "list" {
        if current != none { blocks.push(current) }
        current = (kind: "list", items: ())
      }
      current.items.push(item.captures.at(0))
    } else if line.trim() == "" {
      if current != none { blocks.push(current) }
      current = none
    } else {
      if current == none or current.kind != "text" {
        if current != none { blocks.push(current) }
        current = (kind: "text", lines: ())
      }
      current.lines.push(line)
    }
  }
  if current != none { blocks.push(current) }

  let lead = leading(size, baseline)
  let spacing = par-gap(size, baseline, extra: gap)
  set text(dir: dir-of(raw))
  set par(leading: lead, spacing: spacing)
  // MdItemize: leftmargin 5.5 mm, labelsep 1.4 mm, the en dash right
  // aligned before it, itemsep 0.3 mm.
  set list(marker: [–], indent: 2.5mm, body-indent: 1.4mm, tight: false, spacing: par-gap(size, baseline, extra: 0.3mm))
  for part in blocks {
    if part.kind == "text" {
      par(part.lines.map(l => [#l]).join(linebreak()))
    } else {
      // \par before and after the list: the paragraph gap, not the block's.
      block(above: spacing, below: spacing, list(..part.items.map(i => [#i])))
    }
  }
}

// ---------------------------------------------------------------------
// The page furniture
// ---------------------------------------------------------------------

/// One footer column: 7/9.5 TeX pt, grey, the lines of the array.
#let footer-column(width, lines, align-to: left, spacing: 100% + 0.53pt) = box(width: width, align(align-to,
  text(size: sz(7), fill: footergray, spacing: spacing, dir: ltr,
    par(leading: leading(7, 9.5), lines.map(l => [#l]).join(linebreak())))
))

/// The logo when the brand brings none: the company name as the rental
/// invoices set it. Their logo.svg is that name as an SVG text, and the
/// svg package exports the drawing area, so what lands on the page is
/// the ink of the name scaled to the 62.3 mm of the logo box, its top at
/// 17 mm. Measured on RE-260002.pdf: 62.28 mm wide, the cap height at
/// 16.98 mm, the letters 12.9 pt. The name is measured at 10 pt and
/// scaled so that its ink is 62.3 mm wide.
#let text-logo(name) = context {
  let probe = text(size: 10pt, name)
  let advance = measure(probe).width
  // The advance width carries a side bearing at both ends, which the ink
  // does not: 0.123 em together, measured on the rental name at 600 dpi
  // so that the ink comes out 62.28 mm wide like the reference.
  let ink = advance - 10pt * 0.123
  text(size: 10pt * (62.3mm / ink), name)
}

/// A meta row: the label left, the value right, the baseline at the
/// bottom of a box of the given height.
#let meta-row(height, label, value, size: 7) = block(
  width: 63.5mm, height: height, breakable: false,
  align(bottom, grid(columns: (1fr, auto), align: (left + bottom, right + bottom), column-gutter: 2mm,
    prose(label, size: sz(size)), text(size: sz(size), dir: ltr, value)))
)

// ---------------------------------------------------------------------
// The letter
// ---------------------------------------------------------------------

/// - data: the document as a dictionary, see invoice.typ for the shape
/// - labels: the language's label set, lang/<code>.json parsed
/// - kind: "invoice" or "offer", the label set to read the number and
///   date labels from, and the addressee to pick from a customer
/// - sender: the sender block, data.sender by default
/// - logo: content for the top right, the company name in text when none
/// - after-status: content set between the status line and the closing
#let letter(data, labels, kind: "invoice", sender: none, logo: none, after-status: none) = {
  let meta = data.at("meta", default: (:))
  let id = str(meta.at("id", default: ""))
  let vars = (id: id)
  let t(s) = fill-in(s, vars)
  let sender = if sender != none { sender } else { data.at("sender", default: (:)) }
  let language = str(data.at("language", default: "de"))

  // The addressee: the recipient lines, or the customer resolved the way
  // load_data does it, the shipping address on an offer and the invoice
  // address on an invoice, and the customer's vatId onto the meta block.
  let customer = data.at("customer", default: none)
  let recipient = data.at("recipient", default: none)
  if recipient == none and type(customer) == dictionary {
    recipient = if kind == "offer" {
      customer.at("shippingAddress", default: customer.at("invoiceAddress", default: ()))
    } else {
      customer.at("invoiceAddress", default: customer.at("shippingAddress", default: ()))
    }
    if blank(meta.at("vatId", default: "")) and not blank(customer.at("vatId", default: "")) {
      meta.insert("vatId", customer.vatId)
    }
  }
  if recipient == none { recipient = () }
  if type(recipient) == str { recipient = recipient.split("\n") }

  // The sender line, with the FN in brackets when there is one.
  let sender-line = str(sender.at("line", default: ""))
  if not blank(sender.at("fn", default: "")) { sender-line += " (" + str(sender.fn) + ")" }

  let company = str(sender.at("company", default: sender.at("address", default: ("",)).first()))
  let kind-labels = labels.at(kind)
  let totals = compute(data, labels)

  let page-label = labels.at("page", default: "Seite {page} von {total}")

  set page(
    paper: "a4",
    margin: (top: 19mm, bottom: 35mm, left: 21mm, right: 18mm),
    foreground: {
      // The fold marks: 105 / 148.5 / 210 mm shifted by -2.4 mm,
      // 3.9 / 7 / 3.9 mm long, on the left edge.
      place(top + left, dy: 107.4mm, line(length: 3.9mm, stroke: fold-stroke))
      place(top + left, dy: 150.9mm, line(length: 7mm, stroke: fold-stroke))
      place(top + left, dy: 212.4mm, line(length: 3.9mm, stroke: fold-stroke))
      // The page number, 50 mm right aligned at (143, 264).
      place(top + left, dx: 143mm, dy: 264.13mm, footer-column(50mm, (context {
        fill-in(page-label, (page: str(counter(page).get().first()), total: str(counter(page).final().first())))
      },), align-to: right, spacing: 100%))
      // The four columns at (20.8, 268), (63.9, 268), (107.0, 268), (150.2, 268).
      place(top + left, dx: 20.885mm, dy: 268.215mm, footer-column(45mm, sender.at("address", default: ())))
      place(top + left, dx: 63.985mm, dy: 268.215mm, footer-column(55mm, sender.at("contact", default: ())))
      place(top + left, dx: 107.085mm, dy: 268.215mm, footer-column(55mm, sender.at("legal", default: ())))
      place(top + left, dx: 150.285mm, dy: 268.215mm, footer-column(60mm, sender.at("bank", default: ())))
    },
  )
  // Left to right in every language, see dir-of: the runs that carry
  // Arabic are set right to left one by one.
  set text(font: ("Open Sans", "Noto Sans Arabic", "Noto Sans Math"), size: sz(9), lang: language, dir: ltr)
  set par(leading: leading(9, 12), spacing: 0pt, justify: false)
  set block(spacing: 0pt)

  // --- The header of the first page, placed off the top margin ---------

  // The logo: a 166.2 mm block at (21, 17), right aligned, 62.3 mm wide.
  // The text logo is set by its ink, so it moves by the right bearing of
  // its last letter and sits 0.1 mm higher, measured at 600 dpi.
  if logo != none {
    place(top + right, dx: -4.8mm, dy: -2mm, box(width: 62.3mm, align(right, logo)))
  } else {
    place(top + right, dx: -5.31mm, dy: -1.9mm, text-logo(company))
  }

  // The sender line, 6/8 at (21, 44), 120 mm.
  place(top + left, dy: 44.11mm - 19mm, block(width: 120mm,
    text(size: sz(6), dir: ltr, par(leading: leading(6, 8), sender-line))))

  // The addressee, 9/12 at (21, 54), 90 mm.
  place(top + left, dy: 54.17mm - 19mm, block(width: 90mm,
    text(dir: ltr, par(leading: leading(9, 12), recipient.map(l => [#str(l)]).join(linebreak())))))

  // The meta block, 63.5 mm at (124.6, 50): the number at 11/14, then
  // 7/10 rows of 11 TeX pt, a gap of 1.5 mm before the customer rows.
  let rows = ()
  rows.push(meta-row(2.97mm, kind-labels.number, id, size: 11))
  rows.push(meta-row(5.32mm, kind-labels.date, t(meta.at("date", default: ""))))
  let optional = (
    ("deliveryDate", labels.meta.deliveryDate),
    ("validUntil", kind-labels.at("validUntil", default: labels.meta.at("validUntil", default: "Gültig bis"))),
    ("reference", labels.meta.reference),
    ("code", labels.meta.code),
    ("servicePeriod", labels.meta.servicePeriod),
  )
  for (key, label) in optional {
    let value = meta.at(key, default: "")
    if blank(value) { continue }
    // The code is the reference line already when they are the same.
    if key == "code" and str(value) == t(meta.at("reference", default: "")) { continue }
    rows.push(meta-row(sz(11), label, t(value)))
  }
  rows.push(meta-row(sz(11) + 1.5mm, labels.meta.customerId, t(meta.at("customerId", default: ""))))
  if not blank(meta.at("vatId", default: "")) {
    rows.push(meta-row(sz(11), labels.meta.vatId, t(meta.vatId)))
  }
  rows.push(meta-row(sz(11), labels.meta.contactPerson, t(meta.at("contactPerson", default: ""))))
  place(top + left, dx: 124.6mm - 21mm, dy: 50mm - 19mm, stack(dir: ttb, ..rows))

  // --- The body -----------------------------------------------------------

  // \vspace*{73mm}: the title's cap height at 95.73 mm.
  v(95.73mm - 19mm)

  let title = t(meta.at("title", default: kind-labels.title))
  pad(left: body-offset, prose(title, size: sz(12), weight: "bold"))

  // \vspace{5mm} and the minipage: the greeting's baseline 8.79 mm under the title's.
  v(6.53mm)
  let intro = data.at("intro", default: (:))
  pad(left: body-offset, block(width: 160mm, {
    set par(spacing: par-gap(9, 12, extra: 3.7mm), justify: true)
    par(prose(t(intro.at("greeting", default: ""))))
    md-text(t(intro.at("text", default: "")), gap: 3.7mm)
  }))

  // \vspace{6mm} and the table: the header's baseline 10.8 mm under the intro's last.
  v(6.7mm)

  let head(body) = table.cell(fill: rowgray, block(height: strut-row, width: 100%, inset: (x: 1mm),
    align(bottom, pad(bottom: strut-depth, prose(body, weight: "bold")))))
  let gap-row(h) = table.cell(colspan: 5, block(height: h, width: 100%))
  let total-cell(body, fill: none, bold: false, height: strut-row) = table.cell(fill: fill,
    block(height: height, width: 100%, inset: (x: 1mm),
      align(bottom, pad(bottom: strut-depth, text(weight: if bold { "bold" } else { "regular" },
        if type(body) == str { prose(body) } else { body })))))
  // An item cell: the first baseline 3.65 mm under the row's top (the
  // strut of 0.7 x 13.5 x 1.1), and under the last baseline the line's
  // depth (0.24 em, 0.76 mm) plus the minipage's \vspace{3mm}. Measured
  // 3.73 mm on RE-6017, and 1 mm more on RE-260002, where the \\[1mm]
  // after the title has no description under it.
  // A row never splits across pages, longtable does not either.
  let item-cell(body, left: 1mm, extra: 0mm, dir: auto) = block(width: 100%, breakable: false,
    inset: (left: left, right: 1mm, top: 1.40mm, bottom: 3.73mm + extra), text(dir: dir, body))

  let cells = ()
  cells.push(table.header(head(labels.table.pos), head(labels.table.description), head(labels.table.qty),
    head(labels.table.unitPrice), head(labels.table.total), gap-row(2mm), repeat: true))
  for row in totals.rows {
    let bare = blank(row.description)
    cells.push(item-cell(row.pos, left: 3mm, dir: ltr))
    cells.push(item-cell({
      set par(leading: leading(9, 13.5), spacing: par-gap(9, 13.5, extra: 1mm))
      par(prose(row.title, weight: "bold"))
      if not bare { md-text(row.description, baseline: 13.5) }
    }, extra: if bare { 1mm } else { 0mm }))
    cells.push(item-cell(row.qty, dir: ltr))
    cells.push(item-cell(row.price, dir: ltr))
    cells.push(item-cell(dir: ltr, {
      set par(leading: leading(9, 13.5))
      par(row.total)
      if row.discount != none {
        // {\fontsize{7}{7.8} (Rabatt 10%\\[-1.3mm] 290,00 EUR)}: measured on
        // the data.json build, 7.8 pt to the first line, 13.5 pt less
        // 1.3 mm to the second.
        block(above: sz(7.8) - sz(7) * cap-height, text(size: sz(7), "(" + row.discount.text))
        block(above: sz(13.5) - 1.3mm - sz(7) * cap-height, text(size: sz(7), row.discount.amount + ")"))
      }
    }))
  }
  cells.push(total-cell([], fill: rowgray))
  cells.push(total-cell(labels.table.net, fill: rowgray))
  cells.push(total-cell([], fill: rowgray))
  cells.push(total-cell([], fill: rowgray))
  cells.push(total-cell(text(dir: ltr, fmt-euro(totals.net)), fill: rowgray))
  if totals.rate > 0 {
    cells.push(gap-row(1.5mm))
    cells.push(total-cell([]))
    cells.push(total-cell(fill-in(labels.table.tax, (rate: fmt-num(totals.rate)))))
    cells.push(total-cell([]))
    cells.push(total-cell([]))
    cells.push(total-cell(text(dir: ltr, fmt-euro(totals.vat))))
    cells.push(gap-row(1.5mm))
  } else if not blank(totals.note) {
    cells.push(gap-row(1.5mm))
    cells.push(table.cell(colspan: 5, block(height: plain-row, width: 100%, inset: (left: 12mm, right: 1mm),
      align(bottom, pad(bottom: strut-depth, prose(totals.note))))))
    cells.push(gap-row(1.5mm))
  } else {
    cells.push(gap-row(1.5mm))
  }
  cells.push(total-cell([], fill: rowgray))
  cells.push(total-cell(labels.table.gross, fill: rowgray, bold: true))
  cells.push(total-cell([], fill: rowgray))
  cells.push(total-cell([], fill: rowgray))
  cells.push(total-cell(text(dir: ltr, fmt-euro(totals.gross)), fill: rowgray, bold: true))

  pad(left: 0.1mm, table(
    columns: (col-pos, col-desc, col-qty, col-unit, col-total),
    inset: 0pt, stroke: none,
    align: (left + top, left + top, right + top, right + top, right + top),
    ..cells,
  ))

  // \vspace{5mm} and the terms: the first baseline 7.83 mm under the table.
  v(5.57mm)
  let payment = data.at("payment", default: (:))
  // A minipage: the terms and the closing move to the next page whole.
  pad(left: body-offset, block(width: 160mm, breakable: false, {
    set par(spacing: par-gap(9, 12, extra: 3.7mm), justify: true)
    if not blank(payment.at("terms", default: "")) { md-text(t(payment.terms), gap: 3.7mm) }
    if not blank(payment.at("status", default: "")) {
      text(weight: "bold", md-text(t(payment.status), gap: 3.7mm))
    }
    if after-status != none { after-status }
    // \\[8mm] before the closing where the paragraph gap is 3.7 mm already,
    // \\[3.7mm] before the name.
    v(8mm - 3.7mm)
    par(prose(labels.closing))
    par(prose(t(meta.at("contactPerson", default: ""))))
  }))
}

// ---------------------------------------------------------------------
// The links of an offer
// ---------------------------------------------------------------------

/// The two links as text and as QR codes side by side, "Angebot
/// bestätigen" and "Angebot ablehnen", between the status line and the
/// closing. A QR code of 16 mm reads on a phone, and the block is 16 mm
/// high so that a two-leg offer still closes on its first page. The URL
/// is set in 6.5 pt and may break after any character, which is what
/// the zero width spaces between the characters are for: Typst breaks
/// at them and nowhere inside a segment otherwise. The block never
/// splits across pages.
#let offer-links(links, labels) = {
  let one(key) = {
    let url = str(links.at(key, default: ""))
    if blank(url) { return [] }
    grid(columns: (16mm, 1fr), column-gutter: 2.5mm, align: top,
      qrcode(url, width: 16mm, quiet-zone: 0),
      {
        set par(leading: leading(9, 12), spacing: par-gap(9, 12, extra: 0.5mm))
        par(prose(labels.links.at(key), weight: "bold"))
        par(text(size: sz(6.5), dir: ltr, link(url, url.clusters().join("\u{200B}"))))
      })
  }
  block(width: 160mm, breakable: false, above: par-gap(9, 12, extra: 3.7mm),
    grid(columns: (1fr, 1fr), column-gutter: 6mm, one("confirm"), one("decline")))
}

// ---------------------------------------------------------------------
// The inputs
// ---------------------------------------------------------------------

/// The document: `sys.inputs.data` as JSON text, else data.json beside
/// the entry file. `sys.inputs.customer` is the Kunden/<id>.json of the
/// netsnek pipeline and goes in as `customer` when the data has none.
#let load-data() = {
  let raw = sys.inputs.at("data", default: none)
  let data = if raw != none { json(bytes(raw)) } else { json("data.json") }
  let customer = sys.inputs.at("customer", default: none)
  if customer != none and "customer" not in data { data.insert("customer", json(bytes(customer))) }
  data
}

/// The label set of the document's language, German when the language
/// has no file. `sys.inputs.language` wins over `data.language`.
#let load-labels(data) = {
  let code = sys.inputs.at("language", default: data.at("language", default: "de"))
  let code = lower(str(code)).slice(0, calc.min(2, str(code).len()))
  if code not in ("de", "en", "tr", "ar") { code = "de" }
  (code: code, labels: json("lang/" + code + ".json"))
}
