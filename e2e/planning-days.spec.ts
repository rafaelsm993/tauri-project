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
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 1 });
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
test("the day row stays under the finger while a swipe reflows the plan summary", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const { group } = await openDays(page);
  const top = async () => (await group.boundingBox())!.y;
  const before = await top();
  const a = await point(page, 0),
    b = await point(page, 4);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y);
  await selectedDays(page, []);
  expect(Math.abs((await top()) - before)).toBeLessThan(0.5);
  await page.mouse.move(a.x, a.y);
  expect(Math.abs((await top()) - before)).toBeLessThan(0.5);
  await page.mouse.up();
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
test("real touch paints across skipped days without a synthetic click toggle", async ({
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

test("touch outside the day picker still scrolls a long book sheet", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "CDP native scroll");
  await page.setViewportSize({ width: 360, height: 560 });
  await mockLibrary(page, [item(740003, "book", "Scroll book", { pages: 300 }, null)]);
  await page.goto("/library");
  await page.getByRole("button", { name: "Plan Scroll book", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Plan Scroll book", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.evaluate((el) => {
    el.scrollTop = 0;
  });
  expect(await dialog.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0);
  const before = await dialog.evaluate((el) => el.scrollTop),
    r = (await dialog.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = r.x + 4,
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
  await expect.poll(() => dialog.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);
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

for (const editing of [false, true]) {
  test(`compact weekday row fits create/edit=${editing} with enlarged text`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 560 });
    const { dialog, group } = await openDays(page, editing);
    await page.addStyleTag({ content: "html { font-size: 18.4px !important; }" });
    const touch = await page.evaluate(() => matchMedia("(hover: none), (pointer: coarse)").matches);
    if (touch) {
      expect(await dialog.evaluate((el) => el.offsetWidth - el.clientWidth)).toBe(0);
    }
    const rects = await group.getByRole("button").evaluateAll((buttons) =>
      buttons.map((b) => {
        const r = b.getBoundingClientRect();
        return { top: r.top, left: r.left, right: r.right, width: r.width, height: r.height };
      }),
    );
    expect(rects).toHaveLength(7);
    expect(
      Math.max(...rects.map((r) => r.top)) - Math.min(...rects.map((r) => r.top)),
    ).toBeLessThan(1);
    const bounds = (await group.boundingBox())!;
    expect(rects[0].left).toBeGreaterThanOrEqual(bounds.x);
    expect(rects[6].right).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
    expect(await group.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);
    if (touch) {
      for (const rect of rects) {
        expect(rect.width).toBeGreaterThanOrEqual(44);
        expect(rect.height).toBeGreaterThanOrEqual(44);
      }
    }
    await expect(group.getByRole("button", { name: "Monday", exact: true })).toHaveText("Mon");
  });
}
