# zebra 0.1.0, vendored

`@preview/zebra:0.1.0` by Julian (@rojul), MIT, https://github.com/rojul/typst-zebra.
The three files of `src/` and the licence are copied unchanged from the
package tarball at packages.typst.org, so that an offer compiles without a
package download: the browser compiler has no network at compile time and
the notebook's local binary must give the same page.

Chosen over `tiaoma` (880 KB zint WASM) and `cades` (needs the `jogs`
QuickJS plugin): 112 KB, and the QR code is drawn as one vector path, so
the PDF stays small and the code stays sharp at any print size.

Imported as `#import "vendor/zebra/lib.typ": qrcode`.
