// Browser compatibility entrypoint.
// Some Windows/Python local servers advertise .mjs as text/plain, which strict
// ES-module loading rejects. Load the implementation as text, replace its one
// relative import with the ordinary .js lookup module, then execute it from a
// correctly typed in-memory module.
(async () => {
  const response = await fetch("./app.mjs", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load GraphSCII Draw implementation (${response.status}).`);
  }

  let source = await response.text();
  const lookupUrl = new URL("./straight-lookup.js", window.location.href).href;
  const importLine = 'import { STRAIGHT_CODEPOINT_BY_PAIR } from "./straight-lookup.mjs";';
  const replacement = `const { STRAIGHT_CODEPOINT_BY_PAIR } = await import(${JSON.stringify(lookupUrl)});`;

  if (!source.includes(importLine)) {
    throw new Error("GraphSCII Draw browser entrypoint could not locate its lookup import.");
  }

  source = source.replace(importLine, replacement);
  const blobUrl = URL.createObjectURL(
    new Blob([source], { type: "text/javascript" }),
  );

  try {
    await import(blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
})().catch((error) => {
  console.error(error);
  const status = document.querySelector("#status");
  if (status) status.textContent = `GraphSCII Draw failed to start: ${error.message}`;
});
