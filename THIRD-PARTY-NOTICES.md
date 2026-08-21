# GraphSCII Third-Party and Public-Domain Notices

GraphSCII — **Graphical Standard for Computer Information Interchange** — is created and designed by **Ariel Williams**.

This file identifies material included in the GraphSCII font build that is not claimed as original GraphSCII copyrighted material.

## Printable ASCII: U+0020..U+007E

The printable ASCII characters used by the reference GraphSCII font are derived from the public-domain `font8x8_basic` bitmap set maintained by Daniel Hepper:

- Project: `dhepper/font8x8`
- Source file: `font8x8_basic.h`
- Upstream: https://github.com/dhepper/font8x8
- Upstream source: https://github.com/dhepper/font8x8/blob/master/font8x8_basic.h
- Upstream status: **Public Domain**

The upstream source identifies Daniel Hepper as the maintainer/author of the collection and states that it is based on public-domain VGA font material attributed to Marcel Sondaar and IBM.

GraphSCII uses only printable ASCII `U+0020..U+007E` from that source. Each upstream 8×8 bitmap row is doubled vertically to fit GraphSCII's fixed 8×16 cell:

```text
source row 0 → GraphSCII rows 0,1
source row 1 → GraphSCII rows 2,3
...
source row 7 → GraphSCII rows 14,15
```

No new copyright restriction is asserted over the underlying public-domain bitmap material itself.

## Relationship to the GraphSCII license

The GraphSCII-specific graphical vocabulary, semantic system, documentation, font compiler, generated GraphSCII PUA glyphs, and other original GraphSCII material are covered by the licensing framework described in [`FONT-LICENSE.txt`](FONT-LICENSE.txt).

The public-domain printable ASCII source remains public domain even when it is packaged in the same generated font file as original GraphSCII material.

Where a generated font contains both public-domain ASCII glyphs and copyrighted GraphSCII glyphs, the GraphSCII license applies only to copyrightable GraphSCII material and does not attempt to withdraw the public-domain status of the ASCII source.
