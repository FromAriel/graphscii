# Milestone 5 — Generic Connector Vocabulary

Status: **COMPLETE**

Milestone 5 finishes the GraphSCII bitmap vocabulary extension with a deterministic, rule-generated connector basis and publishes the result as `graphscii-graphics-v1`.

```text
orthogonal connector semantics          640
diagonal connector semantics             60
connector semantic aliases total         700
novel orthogonal owners                   544
novel diagonal owners                      57
novel connector owners total              601

base graphics-v0 owners                 5,796
encoded graphics-v1 owners              6,397
printable ASCII                             95
minimum eventual physical glyphs        6,492

connector allocation           U+F6A4..U+F8FC
protected reserve              U+F8FD..U+F8FF
protected reserve slots                     3
```

The exhaustive junction research is retained as evidence, but the encoded basis intentionally favors simple generic rules over enumeration: all orthogonal crossing/three-leg positions plus the deterministic axis-squash diagonal family and selected symmetric missing-leg variants.

Formal publication: `artifacts/publications/graphscii-graphics-v1.json`.

Milestone 5 does not build a font. The next major implementation direction is the font/compiler layer that consumes the frozen bitmap registry, unless another curated vocabulary extension is deliberately selected first.
