import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

function graphSciiCount(text) {
  let count = 0;
  for (const character of text) {
    const codepoint = character.codePointAt(0);
    if (codepoint >= 0xe000 && codepoint <= 0xf8fc) count += 1;
  }
  return count;
}

async function downloadText(page) {
  const downloadPromise = page.waitForEvent("download", { timeout: 5_000 }).catch(() => null);
  await page.getByRole("button", { name: "Export text" }).click();
  const download = await downloadPromise;
  if (!download) {
    const message = await page.getByRole("status").textContent();
    throw new Error(`Text export produced no download. Application status: ${message ?? "(empty)"}`);
  }
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  return readFile(filePath, "utf8");
}

async function saveDrawing(page) {
  const savePromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save" }).click();
  const saved = await savePromise;
  const savedPath = await saved.path();
  expect(savedPath).toBeTruthy();
  const savedDocument = JSON.parse(await readFile(savedPath, "utf8"));
  await expect(page.getByRole("status")).toHaveText("Saved editable GraphSCII drawing.");
  return { savedPath, savedDocument };
}

async function drawSelfCrossingFreehand(page) {
  await page.locator('[data-tool="freehand"]').click();
  await expect(page.getByRole("status")).toContainText("Freehand:");

  const overlay = page.locator("#overlay-canvas");
  await expect(overlay).toBeVisible();
  const box = await overlay.boundingBox();
  expect(box).toBeTruthy();

  const points = [
    [box.x + 90, box.y + 90],
    [box.x + 260, box.y + 260],
    [box.x + 90, box.y + 260],
    [box.x + 260, box.y + 90],
    [box.x + 330, box.y + 180],
  ];

  await page.mouse.move(points[0][0], points[0][1]);
  await page.mouse.down();
  for (const [x, y] of points.slice(1)) {
    await page.mouse.move(x, y, { steps: 18 });
  }
  await page.mouse.up();

  await expect(page.getByRole("status")).toHaveText("Added freehand.");
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
}

test("GraphSCII Draw boots, draws, exports, undoes, redoes, saves, reopens, and exports PNG", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("GraphSCII Draw");
  await expect(page.locator("#app")).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("status")).toContainText("Ready · 6,397 frozen GraphSCII graphics loaded");

  await drawSelfCrossingFreehand(page);

  const { savedPath, savedDocument } = await saveDrawing(page);
  expect(savedDocument.format).toBe("GraphSCII-Drawing");
  expect(savedDocument.objects).toHaveLength(1);
  expect(savedDocument.objects[0].type).toBe("freehand");
  expect(savedDocument.objects[0].points.length).toBeGreaterThan(20);

  const initialText = await downloadText(page);
  const initialOccupied = graphSciiCount(initialText);
  expect(initialOccupied).toBeGreaterThan(8);
  await expect(page.getByRole("status")).toContainText("Exported GraphSCII Unicode text");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("status")).toHaveText("Undo.");
  const undoneText = await downloadText(page);
  expect(graphSciiCount(undoneText)).toBe(0);

  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByRole("status")).toHaveText("Redo.");
  const redoneText = await downloadText(page);
  expect(graphSciiCount(redoneText)).toBe(initialOccupied);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "New", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("New GraphSCII drawing.");
  const blankText = await downloadText(page);
  expect(graphSciiCount(blankText)).toBe(0);

  await page.locator("#load-file").setInputFiles(savedPath);
  await expect(page.getByRole("status")).toHaveText("Opened drawing.graphscii.");
  const reopenedText = await downloadText(page);
  expect(graphSciiCount(reopenedText)).toBe(initialOccupied);

  const pngPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const png = await pngPromise;
  const pngPath = await png.path();
  expect(pngPath).toBeTruthy();
  const bytes = await readFile(pngPath);
  expect(bytes.length).toBeGreaterThan(100);
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  await expect(page.getByRole("status")).toHaveText("Exported exact 8×16 GraphSCII raster PNG.");
});
