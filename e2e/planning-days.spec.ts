import { expect, test, type Page } from "@playwright/test";
import { ipcCalls, item, mockLibrary } from "./fixtures/library";

test("paint days in one movement without writing before Save", async ({ page }) => {
  await mockLibrary(page, [
    item(740001, "tv", "Day gesture fixture", { episodes: 9, episode_minutes: 40 }, null),
  ]);
  await page.goto("/library");
  await page.getByRole("button", { name: "Plan Day gesture fixture", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Plan Day gesture fixture", exact: true });
  const group = dialog.getByRole("group", { name: "Days", exact: true });
  const monday = group.getByRole("button", { name: "Monday", exact: true });
  const friday = group.getByRole("button", { name: "Friday", exact: true });
  await group.scrollIntoViewIfNeeded();
  const a = (await monday.boundingBox())!,
    b = (await friday.boundingBox())!;
  const x = a.x + a.width / 2;
  await page.mouse.move(x, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, b.y + b.height / 2, { steps: 1 });
  await page.mouse.up();
  expect((await ipcCalls(page)).filter((c) => c.cmd === "library_update")).toEqual([]);
  for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    await expect(group.getByRole("button", { name: day, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  await expect(group.getByRole("button", { name: "Saturday", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect((await ipcCalls(page)).filter((c) => c.cmd === "library_update")).toEqual([]);
  await dialog.getByRole("button", { name: "Save plan", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page
    .getByRole("button", { name: "Edit plan for Day gesture fixture", exact: true })
    .click();
  for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    await expect(
      page
        .getByRole("dialog")
        .getByRole("group", { name: "Days" })
        .getByRole("button", { name: day, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
});

const names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
async function openDays(page: Page, editing = true) {
  await mockLibrary(page, [
    item(
      740002,
      "tv",
      "Existing days",
      { episodes: 9, episode_minutes: 40 },
      editing ? { days: [0, 2, 4], max_session_minutes: 40, since: "2026-10-01" } : null,
    ),
  ]);
  await page.goto("/library");
  await page
    .getByRole("button", {
      name: editing ? "Edit plan for Existing days" : "Plan Existing days",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog", { name: "Plan Existing days" });
  const group = dialog.getByRole("group", { name: "Days", exact: true });
  await group.scrollIntoViewIfNeeded();
  return { dialog, group };
}
async function point(page: Page, index: number) {
  const b = (await page
    .getByRole("group", { name: "Days", exact: true })
    .getByRole("button", { name: names[index], exact: true })
    .boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function selectedDays(page: Page, days: number[]) {
  for (let i = 0; i < 7; i++)
    await expect(
      page
        .getByRole("group", { name: "Days", exact: true })
        .getByRole("button", { name: names[i], exact: true }),
    ).toHaveAttribute("aria-pressed", String(days.includes(i)));
}
test("existing-day paint clears once, outside release stops, Cancel discards", async ({ page }) => {
  const { dialog, group } = await openDays(page);
  const a = await point(page, 0),
    b = await point(page, 4);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y);
  await page.mouse.move(a.x, a.y);
  await selectedDays(page, []);
  await page.mouse.move(1, 1);
  await page.mouse.up();
  await page.mouse.move(b.x, b.y);
  await selectedDays(page, []);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toBeHidden();
  expect((await ipcCalls(page)).filter((c) => c.cmd === "library_update")).toEqual([]);
  await page.getByRole("button", { name: "Edit plan for Existing days" }).click();
  await selectedDays(page, [0, 2, 4]);
  await group.getByRole("button", { name: "Tuesday", exact: true }).click();
  await selectedDays(page, [0, 1, 2, 4]);
});
test("right button is ignored and keyboard selection saves sorted numeric days", async ({
  page,
}) => {
  const { dialog, group } = await openDays(page, false);
  await group.getByRole("button", { name: "Monday", exact: true }).click({ button: "right" });
  await selectedDays(page, []);
  await group.getByRole("button", { name: "Monday", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await selectedDays(page, [0, 1]);
  await page.keyboard.press("Space");
  await selectedDays(page, [0]);
  await expect(group.getByRole("button", { name: "Monday", exact: true })).toHaveCSS(
    "background-color",
    "rgb(229, 9, 20)",
  );
  await dialog.getByRole("button", { name: "Save plan", exact: true }).click();
  const calls = (await ipcCalls(page)).filter((c) => c.cmd === "library_update");
  expect(calls).toHaveLength(1);
  expect(calls[0].args).toMatchObject({ patch: { plan: { days: [0] } } });
});
for (const cancellation of ["touchCancel", "lostcapture"] as const) {
  test(`real touch ${cancellation} restores draft and next gesture works`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "CDP capture test");
    const { group } = await openDays(page);
    const cdp = await page.context().newCDPSession(page),
      a = await point(page, 0),
      b = await point(page, 4);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...a, id: 1 }],
    });
    await selectedDays(page, [2, 4]);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...b, id: 1 }],
    });
    await selectedDays(page, []);
    if (cancellation === "touchCancel")
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    else {
      await group.evaluate((el) => {
        for (let i = 0; i < 20; i++) if (el.hasPointerCapture(i)) el.releasePointerCapture(i);
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ ...a, id: 1 }],
      });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    await selectedDays(page, [0, 2, 4]);
    const t = await point(page, 1);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...t, id: 2 }],
    });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await selectedDays(page, [0, 1, 2, 4]);
    expect((await ipcCalls(page)).filter((c) => c.cmd === "library_update")).toEqual([]);
    await cdp.detach();
  });
}
test("real touch paints across skipped rows without a synthetic click toggle", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "CDP touch test");
  await openDays(page, false);
  const cdp = await page.context().newCDPSession(page),
    a = await point(page, 0),
    b = await point(page, 4);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...a, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...b, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await selectedDays(page, [0, 1, 2, 3, 4]);
  await cdp.detach();
});

test("touch outside the day picker still scrolls a short sheet", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "CDP native scroll");
  await page.setViewportSize({ width: 360, height: 560 });
  const { dialog } = await openDays(page, false);
  const body = dialog;
  await body.evaluate((el) => (el.scrollTop = 0));
  const before = await body.evaluate((el) => el.scrollTop),
    r = (await body.boundingBox())!;
  const cdp = await page.context().newCDPSession(page),
    x = r.x + 4,
    y = Math.min(r.y + r.height - 50, 480);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1 }],
  });
  for (let dy = 20; dy <= 180; dy += 20)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y - dy, id: 1 }],
    });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);
  await cdp.detach();
});

test("a second touch cannot compete with the primary day paint", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "CDP multi-touch");
  await openDays(page, false);
  const cdp = await page.context().newCDPSession(page),
    a = await point(page, 0),
    b = await point(page, 4);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...a, id: 1 }],
  });
  await selectedDays(page, [0]);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { ...a, id: 1 },
      { ...b, id: 2 },
    ],
  });
  await selectedDays(page, [0]);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await selectedDays(page, []);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...a, id: 3 }],
  });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...b, id: 3 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await selectedDays(page, [0, 1, 2, 3, 4]);
  await cdp.detach();
});
