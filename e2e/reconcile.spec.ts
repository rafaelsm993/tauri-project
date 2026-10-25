import { test, expect } from "./fixtures/tauri-ipc";
import type { Page } from "@playwright/test";
import { ipcCalls, item, manualItem, mockLibrary } from "./fixtures/library";

const MANUAL = manualItem("book", "Piranesi", { year: null });
const MANUAL_URL = /\/media\/book\/0b6f1c1e-5d3a-4c2b-9b7e-2f1d3c4b5a69$/;

function hit(id: number, title: string) {
  return {
    id,
    provider: "itunes",
    media_key: `itunes:book:${id}`,
    title,
    overview: "",
    poster_path: null,
    backdrop_path: null,
    vote_average: 0,
    vote_count: 0,
    release_date: "2020-09-15",
    media_type: "book",
  };
}

const RESULTS = [hit(42, "Piranesi"), hit(43, "Piranesi (Illustrated)")];
const sheet = (page: Page) => page.getByRole("dialog", { name: "Find a match for Piranesi" });
const matchButton = (page: Page) => page.getByRole("button", { name: "Find a match" });

async function openManualPage(page: Page) {
  await page.goto("/library");
  await page.getByRole("link", { name: /Piranesi/ }).click();
  await expect(page).toHaveURL(MANUAL_URL);
}

async function pickFirst(page: Page) {
  await matchButton(page).click();
  await expect(sheet(page)).toBeVisible();
  await sheet(page)
    .getByRole("button", { name: /^Piranesi 2020/ })
    .click();
}

test.describe("find a match", () => {
  test.beforeEach(async ({ page }) => {
    await mockLibrary(page, [MANUAL], { results: RESULTS });
  });

  test("offline, the manual page has no Find a match and asks nothing", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", { get: () => false });
    });
    await openManualPage(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Piranesi");
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(matchButton(page)).toHaveCount(0);
    const asked = (await ipcCalls(page)).filter((c) => c.cmd === "catalog_page");
    expect(asked).toHaveLength(0);
  });

  test("Use this lands on the catalog page, and one Back leaves it", async ({ page }) => {
    await openManualPage(page);
    await pickFirst(page);
    await expect(sheet(page).getByRole("list", { name: "What changes" })).toContainText("2020");
    await expect(sheet(page).getByText(/^Kept as is:.*Status/)).toBeVisible();
    await sheet(page).getByRole("button", { name: "Use this" }).click();

    await expect(page).toHaveURL(/\/media\/book\/42$/);
    await expect(sheet(page)).toHaveCount(0);
    await expect(page.getByRole("status", { name: "Matched" })).toContainText(
      "Matched to Piranesi",
    );

    await page.goBack();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByRole("link", { name: /Piranesi/ })).toHaveCount(1);
    const merges = (await ipcCalls(page)).filter((c) => c.cmd === "library_merge");
    expect(merges).toHaveLength(1);
  });

  test("Undo from the toast brings the manual item and its page back", async ({ page }) => {
    await openManualPage(page);
    await pickFirst(page);
    await sheet(page).getByRole("button", { name: "Use this" }).click();
    await expect(page).toHaveURL(/\/media\/book\/42$/);

    const toast = page.getByRole("status", { name: "Matched" });
    await toast.getByRole("button", { name: "Undo" }).click();

    await expect(page).toHaveURL(MANUAL_URL);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Piranesi");
    await expect(matchButton(page)).toBeVisible();
    await expect(toast).not.toContainText("Matched to");
    const undos = (await ipcCalls(page)).filter((c) => c.cmd === "library_unmerge");
    expect(undos).toHaveLength(1);

    await page.goBack();
    await expect(page).toHaveURL(/\/library$/);
  });

  test("Back with the sheet open closes only the sheet", async ({ page }) => {
    await openManualPage(page);
    await matchButton(page).click();
    await expect(sheet(page)).toBeVisible();
    await page.goBack();
    await expect(sheet(page)).toHaveCount(0);
    await expect(page).toHaveURL(MANUAL_URL);
  });
});

test.describe("find a match, combining", () => {
  test("warns that a catalog item already saved will be combined", async ({ page }) => {
    const saved = { ...item(42, "book", "Piranesi", {}, null) };
    saved.key = "itunes:book:42";
    saved.snapshot = { ...saved.snapshot, media_key: "itunes:book:42", provider: "itunes" };
    await mockLibrary(page, [MANUAL, saved], { results: RESULTS });
    await page.goto("/media/book/0b6f1c1e-5d3a-4c2b-9b7e-2f1d3c4b5a69");
    await matchButton(page).click();
    await sheet(page)
      .getByRole("button", { name: /^Piranesi, in your library/ })
      .click();
    await expect(sheet(page).getByRole("note")).toContainText("You already have this");
  });
});
