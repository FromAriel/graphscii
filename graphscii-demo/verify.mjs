import {
  STRAIGHT_CODEPOINT_BY_PAIR,
  STRAIGHT_PAIR_COUNT,
  STRAIGHT_VISUAL_OWNER_COUNT,
} from "./straight-lookup.mjs";

function fail(message) {
  console.error(`verify: ${message}`);
  process.exit(1);
}

const entries = Object.entries(STRAIGHT_CODEPOINT_BY_PAIR);
if (entries.length !== 1664 || STRAIGHT_PAIR_COUNT !== 1664) {
  fail(`expected 1664 directed pair entries, got ${entries.length}`);
}

const owners = new Set(entries.map(([, codepoint]) => codepoint));
if (owners.size !== 746 || STRAIGHT_VISUAL_OWNER_COUNT !== 746) {
  fail(`expected 746 visual owners, got ${owners.size}`);
}

for (const [pair, codepoint] of entries) {
  const [a, b] = pair.split(">");
  const reverse = `${b}>${a}`;
  if (STRAIGHT_CODEPOINT_BY_PAIR[reverse] !== codepoint) {
    fail(`reverse lookup mismatch for ${pair}`);
  }
  if (codepoint < 0xE000 || codepoint > 0xE2E9) {
    fail(`straight codepoint outside v1 straight block for ${pair}`);
  }
  if (a[0] === b[0]) {
    fail(`illegal same-edge pair present: ${pair}`);
  }
}

for (const required of ["L13>R4", "T2>B6", "L8>T3", "R4>L13"]) {
  if (!(required in STRAIGHT_CODEPOINT_BY_PAIR)) {
    fail(`missing expected semantic ${required}`);
  }
}

console.log("GraphSCII Draw Slice 1 verification passed.");
console.log(`directed pair lookups: ${entries.length}`);
console.log(`visual straight owners: ${owners.size}`);
