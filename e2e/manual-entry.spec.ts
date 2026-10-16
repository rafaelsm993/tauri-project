import { test, expect } from "./fixtures/tauri-ipc";
import { ipcCalls, item, mockLibrary } from "./fixtures/library";

const dialog = (page: import("@playwright/test").Page) => page.getByRole("dialog");

test.describe("add manually", () => {
  test.beforeEach(async ({ page }) => {
    await mockLibrary(page, [item(7, "tv", "Arcane", { episodes: 9 }, null)]);
  });

  test("save opens the new item, and one Back returns to where you started", async ({ page }) => {
    await page.goto("/library");
    await page.getByRole("button", { name: "Add manually" }).click();
    await expect(dialog(page)).toBeVisible();
    await page.getByRole("button", { name: "Book" }).click();
    await page.getByLabel("Title").fill("Mystery zine");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(/\/media\/book\/00000000-0000-4000-8000-000000000001$/);
    await expect(dialog(page)).toHaveCount(0);

    await page.goBack();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByRole("link", { name: /Mystery zine/ })).toBeVisible();
    const adds = (await ipcCalls(page)).filter((c) => c.cmd === "library_add_manual");
    expect(adds).toHaveLength(1);
  });

  test("a hand-made item opens and is removed without asking a provider", async ({ page }) => {
    await page.goto("/library");
    await page.getByRole("button", { name: "Add manually" }).click();
    await page.getByRole("button", { name: "Book" }).click();
    await page.getByLabel("Title").fill("Mystery zine");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mystery zine");

    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("alert")).toHaveText(/isn't in your library anymore/);
    await expect(page.getByRole("alert")).not.toContainText("Invalid ID");
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/library$/);
    const asked = (await ipcCalls(page)).filter((c) => c.cmd.startsWith("catalog_detail"));
    expect(asked).toHaveLength(0);
  });

  test("Back with the sheet open closes only the sheet", async ({ page }) => {
    await page.goto("/");
    await page.goto("/library");
    await page.getByRole("button", { name: "Add manually" }).click();
    await expect(dialog(page)).toBeVisible();
    await page.goBack();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/library$/);
  });

  test("from the Planner it stays put and offers the new item", async ({ page }) => {
    await page.goto("/planner");
    await page.getByRole("button", { name: "Add manually" }).click();
    await page.getByLabel("Title").fill("Hades");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/planner$/);
    const notice = page.getByRole("status", { name: "Added" });
    await expect(notice).toContainText("Added Hades");
    await notice.getByRole("button", { name: "Open" }).click();
    await expect(page).toHaveURL(/\/media\/movie\/00000000-/);
    await page.goBack();
    await expect(page).toHaveURL(/\/planner$/);
  });

  test("a look-alike title asks first and can open the saved one", async ({ page }) => {
    await page.goto("/library");
    await page.getByRole("button", { name: "Add manually" }).click();
    await page.getByRole("button", { name: "TV Show" }).click();
    await page.getByLabel("Title").fill("arcane");
    await page.getByLabel(/Genres/).fill("Fantasy, Action");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("alert")).toContainText("Arcane is already in your library.");
    const actions = page.getByRole("alert").getByRole("button");
    const saveTop = (await page.getByRole("button", { name: "Save", exact: true }).boundingBox())!
      .y;
    await expect
      .poll(async () => {
        const boxes = await Promise.all((await actions.all()).map((b) => b.boundingBox()));
        return boxes.every((b) => b !== null && b.y >= 0 && b.y + b.height <= saveTop);
      })
      .toBe(true);
    await page.getByRole("button", { name: "Open it" }).click();
    await expect(page).toHaveURL(/\/media\/tv\/7$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/library$/);
    const adds = (await ipcCalls(page)).filter((c) => c.cmd === "library_add_manual");
    expect(adds).toHaveLength(0);
  });
});
