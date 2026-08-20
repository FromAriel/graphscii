# GraphSCII Milestone 4B — Phase-Locked Dither Sweep

Status: **RESEARCH COMPLETE — NO DITHER CODEPOINTS ALLOCATED**

## Global result

```text
styled semantic candidates        8,320
unique styled rasters             6,500
published straight visuals        746
novel solid visuals               1,259
novel dither visuals              5,077
combined visual vocabulary        7,082
```

## Per-style exact dedup

| Style | Mask | Semantic | Unique | Straight reuse | Solid reuse | Same-style dup | Prior-dither reuse | New visuals |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| solid | 64/64 | 1664 | 1347 | 100 | 0 | 305 | 0 | 1259 |
| dense | 56/64 | 1664 | 1393 | 102 | 81 | 254 | 0 | 1227 |
| medium | 48/64 | 1664 | 1409 | 102 | 54 | 238 | 24 | 1246 |
| light | 16/64 | 1664 | 1466 | 154 | 2 | 180 | 13 | 1315 |
| sparse | 8/64 | 1664 | 1478 | 181 | 2 | 168 | 24 | 1289 |

## Hamming comparisons for identical geometry/side semantics

| Style A | Style B | Exact | ≤1 px | ≤2 px | Min | Max | Mean |
|---|---|---:|---:|---:|---:|---:|---:|
| solid | dense | 181 | 299 | 423 | 0 | 16 | 7.318510 |
| solid | medium | 154 | 207 | 274 | 0 | 32 | 14.650841 |
| solid | light | 102 | 120 | 148 | 0 | 94 | 43.942909 |
| solid | sparse | 102 | 112 | 129 | 0 | 110 | 51.269231 |
| dense | medium | 180 | 298 | 418 | 0 | 16 | 7.332332 |
| dense | light | 106 | 129 | 154 | 0 | 79 | 36.624399 |
| dense | sparse | 104 | 116 | 138 | 0 | 94 | 43.950721 |
| medium | light | 117 | 141 | 175 | 0 | 64 | 29.292067 |
| medium | sparse | 106 | 129 | 154 | 0 | 79 | 36.618389 |
| light | sparse | 180 | 298 | 418 | 0 | 16 | 7.326322 |

## Address-space consequence

Keeping all five styles would require **7,082** distinct visual owners including the published straight vocabulary. This exceeds the preferred 4,096-slot U+E000..U+EFFF window, so Milestone 4C must prune the palette, move some styles to renderer-only transformations, or deliberately expand the address space before any fill/dither codepoint allocation.

