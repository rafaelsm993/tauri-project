import { test, expect } from "./fixtures/tauri-ipc";
import { ipcCalls, item, manualItem, mockLibrary } from "./fixtures/library";

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
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
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

test.describe("a hand-made item's page", () => {
  const UUID = "0b6f1c1e-5d3a-4c2b-9b7e-2f1d3c4b5a69";

  test.beforeEach(async ({ page }) => {
    await mockLibrary(page, [
      manualItem("game", "Hades", {
        year: "2020",
        creator: "Supergiant Games",
        overview: "Escape the underworld.",
        genres: ["Roguelike", "Action"],
        platforms: ["PC", "Switch"],
      }),
    ]);
  });

  test("shows what you typed, with no provider call and no offline note", async ({ page }) => {
    await page.goto(`/media/game/${UUID}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hades");
    const main = page.locator(".detail-info");
    await expect(main.getByText("Supergiant Games")).toBeVisible();
    await expect(main.getByText("2020", { exact: true })).toBeVisible();
    await expect(main.getByText("Roguelike", { exact: true })).toBeVisible();
    await expect(main.getByText("Switch", { exact: true })).toBeVisible();
    await expect(main.getByText("Escape the underworld.")).toBeVisible();
    await expect(page.getByRole("note")).toHaveCount(0);
    const asked = (await ipcCalls(page)).filter((c) => c.cmd.startsWith("catalog_"));
    expect(asked).toHaveLength(0);
  });

  test("fits the screen and its Edit button is touch-sized", async ({ page, isMobile }) => {
    await page.goto(`/media/game/${UUID}`);
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    if (isMobile) {
      const box = (await page.getByRole("button", { name: "Edit" }).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("Edit opens the sheet filled in, saves in place, and Back still leaves the page", async ({
    page,
  }) => {
    await page.goto("/library");
    await page.getByRole("link", { name: /Hades/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hades");
    await page.getByRole("button", { name: "Edit" }).click();
    const sheet = page.getByRole("dialog", { name: "Edit Hades" });
    await expect(sheet.getByLabel("Title")).toHaveValue("Hades");
    await expect(sheet.getByLabel(/hours/i)).toHaveValue("");
    await sheet.getByLabel("Title").fill("Hades II");
    await sheet.getByLabel(/hours/i).fill("40");
    await sheet.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hades II");
    await expect(page).toHaveURL(new RegExp(`/media/game/${UUID}$`));
    const calls = await ipcCalls(page);
    const edits = calls.filter((c) => c.cmd === "library_edit_manual");
    expect(edits).toHaveLength(1);
    const updates = calls.filter((c) => c.cmd === "library_update");
    expect(updates).toHaveLength(1);
    expect(updates[0].args).toMatchObject({
      key: `manual:game:${UUID}`,
      patch: { length: { hours: 40 } },
    });
    expect(calls.indexOf(edits[0])).toBeLessThan(calls.indexOf(updates[0]));

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Edit Hades II" }).getByLabel(/hours/i),
    ).toHaveValue("40");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.goBack();
    await expect(page).toHaveURL(/\/library$/);
  });

  test("changing the type warns first, then moves the item to its new page", async ({ page }) => {
    await page.goto("/library");
    await page.getByRole("link", { name: /Hades/ }).click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Edit Hades" });
    await expect(sheet.getByRole("note")).toHaveCount(0);
    await sheet.getByRole("group", { name: "Type" }).getByRole("button", { name: "Book" }).click();
    await expect(sheet.getByRole("note")).toContainText("starts its progress over at 0");
    await sheet.getByLabel("Pages").fill("300");
    await sheet.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/media/book/${UUID}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hades");
    const calls = await ipcCalls(page);
    expect(calls.filter((c) => c.cmd === "library_edit_manual")).toHaveLength(0);
    const moves = calls.filter((c) => c.cmd === "library_retype_manual");
    expect(moves).toHaveLength(1);
    expect(moves[0].args).toMatchObject({
      key: `manual:game:${UUID}`,
      draft: { media_type: "book", title: "Hades" },
      length: { pages: 300 },
      event: { kind: "library_retype", payload: { into: `manual:book:${UUID}` } },
    });

    // The old page was replaced, so Back leaves for where the user came from.
    await page.goBack();
    await expect(page).toHaveURL(/\/library$/);
  });
});

test("offline: add a book with genres, open it, find its card, then plan it", async ({ page }) => {
  await mockLibrary(page, []);
  await page.addInitScript(() => Object.assign(window, { __offline: true }));
  await page.goto("/library");
  await page.getByRole("button", { name: "Add one yourself" }).click();
  await page.getByRole("button", { name: "Book" }).click();
  await page.getByLabel("Title").fill("Piranesi");
  await page.getByLabel("Author").fill("Susanna Clarke");
  await page.getByLabel(/Genres/).fill("Fantasy, Mystery");
  await page.getByLabel("Pages").fill("272");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Piranesi");
  await expect(page.getByText("Susanna Clarke")).toBeVisible();
  await expect(page.getByText("Mystery", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.getByRole("button", { name: "Plan", exact: true }).click();
  const plan = page.getByRole("dialog");
  await plan.getByRole("group", { name: "Days" }).getByRole("button", { name: "Thu" }).click();
  await plan.getByRole("button", { name: "45 min" }).click();
  await plan.getByRole("button", { name: "Save plan" }).click();
  await expect(page.getByRole("button", { name: "Edit plan" })).toBeVisible();

  await page.goBack();
  await expect(
    page.getByRole("link", { name: "Book Piranesi Planning Not started" }),
  ).toBeVisible();
  // Planned for today: the card notes the time and offers to log it.
  await expect(page.getByText(/^\d+ min today$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Log a session of Piranesi" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Planner" })
    .click();
  await expect(page.getByRole("listitem", { name: "Thu, Oct 1" })).toContainText("Piranesi");
  const asked = (await ipcCalls(page)).filter((c) => c.cmd.startsWith("catalog_"));
  expect(asked).toHaveLength(0);
});

test.describe("removing an item", () => {
  const ev = (id: string, kind: string, payload: unknown) => ({
    id,
    kind,
    media_key: "tmdb:tv:7",
    at_utc: "2026-09-30T12:00:00.000Z",
    local_date: "2026-09-30",
    payload,
  });

  test.beforeEach(async ({ page }) => {
    const arcane = item(7, "tv", "Arcane", { episodes: 9 }, null);
    await mockLibrary(page, [arcane], {
      seenLevel: 1,
      events: [
        ev("a", "library_add", null),
        ev("r", "library_update", { rating: 9 }),
        ev("c", "library_update", { status: "completed" }),
      ],
    });
  });

  const xpLine = (page: import("@playwright/test").Page) =>
    page.getByRole("img", { name: /Level \d+, \d+ of \d+ XP/ });

  test("asks first; Keep keeps it", async ({ page, isMobile }) => {
    await page.goto("/media/tv/7");
    await page.getByRole("button", { name: "Remove" }).click();
    const sheet = page.getByRole("dialog", { name: "Remove Arcane?" });
    await expect(sheet).toContainText(/You lose the \d+ XP it earned\./);
    if (isMobile) {
      for (const b of await sheet.getByRole("button").all()) {
        expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
    }
    await sheet.getByRole("button", { name: "Keep" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();
    const removes = (await ipcCalls(page)).filter((c) => c.cmd === "library_remove");
    expect(removes).toHaveLength(0);
  });

  test("Remove takes the item and its XP away, and Profile shows less", async ({ page }) => {
    await page.goto("/profile");
    const before = await xpLine(page).getAttribute("aria-label");

    await page.goto("/media/tv/7");
    await page.getByRole("button", { name: "Remove" }).click();
    const sheet = page.getByRole("dialog", { name: "Remove Arcane?" });
    const lost = Number((await sheet.textContent())!.match(/lose the (\d+) XP/)![1]);
    await sheet.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("button", { name: "+ Add to library" })).toBeVisible();

    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: /Profile/ })
      .click();
    const xpOf = (label: string | null) => Number(label!.match(/(\d+) of/)![1]);
    await expect(xpLine(page)).not.toHaveAttribute("aria-label", before!);
    expect(xpOf(before) - xpOf(await xpLine(page).getAttribute("aria-label"))).toBe(lost);
  });
});

test("a hand-made show's typical episode lengths sit on one row under both fields", async ({
  page,
}) => {
  await mockLibrary(page, []);
  await page.goto("/library");
  // Android's default text scale renders the root font at 18.4 px, as on the test phone.
  await page.addStyleTag({ content: "html { font-size: 18.4px !important; }" });
  await page.getByRole("button", { name: "Add manually" }).first().click();
  await dialog(page)
    .getByRole("group", { name: "Type" })
    .getByRole("button", { name: "TV" })
    .click();
  const lengths = dialog(page).getByRole("group", { name: "Common episode lengths" });
  await lengths.getByRole("button", { name: "30 min" }).click();
  await expect(dialog(page).getByLabel("Minutes per episode")).toHaveValue("30");
  const tops = await lengths
    .getByRole("button")
    .evaluateAll(
      (pills) => new Set(pills.map((p) => Math.round(p.getBoundingClientRect().top))).size,
    );
  expect(tops).toBe(1);
  const left = async (name: string) => (await dialog(page).getByLabel(name).boundingBox())!.x;
  expect(Math.round((await lengths.boundingBox())!.x)).toBe(Math.round(await left("Episodes")));
  // The pills share the row, so the last one ends where the row does.
  const row = (await lengths.boundingBox())!;
  const last = (await lengths.getByRole("button", { name: "60 min" }).boundingBox())!;
  expect(Math.round(last.x + last.width)).toBe(Math.round(row.x + row.width));
});
