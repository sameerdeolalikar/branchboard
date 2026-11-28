import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
async function ready() {
  await page.waitForFunction(
    () =>
      !document.getElementById("save").disabled &&
      document.getElementById("document-title").textContent,
  );
}
async function exported() {
  const wait = page.waitForEvent("download");
  await page.click("#export");
  const d = await wait;
  const doc = JSON.parse(await readFile(await d.path(), "utf8"));
  await ready();
  return doc;
}
async function apply() {
  await page.click("#apply");
  await page.waitForFunction(() => !document.getElementById("editor").open);
  await ready();
}
try {
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:7431");
  await ready();
  const blocked = page
    .locator(".task")
    .filter({
      has: page.getByText("Print the exhibition guide", { exact: true }),
    });
  await blocked.getByRole("button", { name: "Start", exact: true }).click();
  await page.locator("#error:not([hidden])").waitFor();
  assert.equal(await page.textContent("#error"),
    'Task "print" cannot be active or done while dependencies are unfinished: layout, labels.');
  await ready();
  await page
    .getByRole("button", { name: "Edit Define the collection", exact: true })
    .click();
  await page.fill("#field-depends", "print");
  await page.click("#apply");
  await page.locator("#dialog-error:not([hidden])").waitFor();
  assert.equal(await page.textContent("#dialog-error"),
    "Dependency cycle detected: brief -> print -> layout -> brief.");
  await page.click("#cancel");
  await page
    .getByRole("button", { name: "Edit Sketch the room layout", exact: true })
    .click();
  await page.selectOption("#field-status", "done");
  await apply();
  await page
    .getByRole("button", { name: "Edit Write object labels", exact: true })
    .click();
  await page.selectOption("#field-status", "done");
  await apply();
  await page
    .locator(".task")
    .filter({
      has: page.getByText("Print the exhibition guide", { exact: true }),
    })
    .getByRole("button", { name: "Start", exact: true })
    .click();
  await ready();
  assert.equal(
    (await exported()).tasks.find((x) => x.id === "print").status,
    "active",
  );
  await page.click("#undo");
  await ready();
  assert.equal(
    (await exported()).tasks.find((x) => x.id === "print").status,
    "backlog",
  );
  const beforeDrop = await exported();
  await page.getByRole("button", { name: "Edit Print the exhibition guide", exact: true }).click();
  await page.fill("#field-title", "  Print the exhibition guide  ");
  await apply();
  assert.equal(await page.locator("#redo").isEnabled(), true,
    "Applying an equivalent task edit preserves redo");
  assert.deepEqual(await exported(), beforeDrop);
  await page.click("#settings");
  await apply();
  assert.equal(await page.locator("#redo").isEnabled(), true,
    "Applying unchanged settings preserves redo");
  const backlog = page.locator('.lane[data-status="backlog"]');
  await blocked.dragTo(backlog.locator("h2"));
  await ready();
  assert.equal(
    await page.locator("#redo").isEnabled(), true,
    "Dropping into the current column preserves redo",
  );
  const unrelatedDrop = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "not-a-task");
    return data;
  });
  await backlog.dispatchEvent("drop", { dataTransfer: unrelatedDrop });
  await unrelatedDrop.dispose();
  await ready();
  assert.equal(
    await page.locator("#redo").isEnabled(), true,
    "Dropping unrelated text preserves redo",
  );
  assert.deepEqual(await exported(), beforeDrop);
  await page.locator("#redo").focus();
  await page.keyboard.press("Enter");
  await ready();
  assert.equal(
    (await exported()).tasks.find((x) => x.id === "print").status,
    "active",
  );
  await page.fill("#search", "spare");
  assert.equal(await page.locator(".task").count(), 1);
  await page.fill("#search", "");

  const expected = await exported();
  await page.click("#save");
  await page.waitForFunction(
    () =>
      document.getElementById("status").textContent ===
      "Saved revision 1 locally.",
  );
  await ready();
  const key = await page.inputValue("#library");
  assert(key);
  await page.reload();
  await ready();
  await page.selectOption("#library", key);
  await page.click("#open");
  await page.waitForFunction(
    () =>
      document.getElementById("status").textContent ===
      "Saved document opened.",
  );
  assert.deepEqual(await exported(), expected);
  await page.click("#settings");
  await apply();
  assert.equal(await page.locator("#undo").isEnabled(), false,
    "Unchanged settings do not create an undo entry");
  assert.equal(await page.textContent("#revision"), "Saved revision 1");
  await page.click("#settings");
  await page.fill("#field-title", "Updated board title");
  await apply();
  assert.equal((await exported()).title, "Updated board title");
  await page.locator("#undo").focus();
  await page.keyboard.press("Enter");
  await ready();
  assert.deepEqual(await exported(), expected);
  const stale = await page.evaluate(async (key) => {
    const r = await (await fetch("/api/documents/" + key)).json();
    return (
      await fetch("/api/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "Workspace",
        },
        body: JSON.stringify({ ...r, revision: 0 }),
      })
    ).status;
  }, key);
  assert.equal(stale, 409);
  const forbidden = await page.evaluate(
    async () =>
      (
        await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
  );
  assert.equal(forbidden, 403);
  await page.setInputFiles("#import", {
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await page.locator("#error:not([hidden])").waitFor();
  await ready();
  assert.deepEqual(await exported(), expected);
  const invalidNote = structuredClone(expected);
  invalidNote.tasks[0].note = false;
  await page.setInputFiles("#import", {
    name: "invalid-note.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(invalidNote)),
  });
  await page.locator("#error:not([hidden])").waitFor();
  assert.match(await page.textContent("#error"), /Note/);
  await ready();
  assert.deepEqual(await exported(), expected);
  const missingDependency = structuredClone(expected);
  missingDependency.tasks[0].depends = ["missing-task"];
  await page.setInputFiles("#import", {
    name: "missing-dependency.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(missingDependency)),
  });
  await page.locator("#error:not([hidden])").waitFor();
  assert.equal(await page.textContent("#error"),
    `Task "${expected.tasks[0].id}" depends on missing task "missing-task".`);
  await ready();
  assert.deepEqual(await exported(), expected);
  await page.setInputFiles("#import", "examples/sample.json");
  await page.waitForFunction(
    () =>
      document.getElementById("status").textContent ===
      "Document imported. Save to add it to the library.",
  );
  await ready();
  await page.click("#settings");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#editor").evaluate((x) => x.open), false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click("#settings");
  await page.locator("#apply").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.getElementById("editor").open);
  await ready();
  assert.equal(await page.textContent("#status"), "No changes to apply.");
  assert.equal(await page.locator("#undo").isEnabled(), false);
  await page.waitForTimeout(100);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "No page-level overflow at narrow width",
  );
  if (process.env.UI_SCREENSHOTS) {
    await mkdir(process.env.UI_SCREENSHOTS, { recursive: true });
    await page.screenshot({
      path: process.env.UI_SCREENSHOTS + "/mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.screenshot({
      path: process.env.UI_SCREENSHOTS + "/desktop.png",
      fullPage: true,
    });
  }
  assert.deepEqual(errors, []);
  console.log(
    "Browser workflows, preservation checks, persistence, imports and responsive layout passed.",
  );
} finally {
  await browser.close();
}
