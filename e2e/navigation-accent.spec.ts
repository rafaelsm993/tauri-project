import { expect, test } from "@playwright/test";
import { eventsAtLevel, item, mockLibrary } from "./fixtures/library";

function contrast(a: string, b: string) {
  const luminance = (s: string) => {
    const c = s
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number)
      .map((v) => {
        const n = v / 255;
        return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      });
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

for (const theme of ["light", "dark"] as const) {
  for (const accent of ["default", "ember", "dusk", "ocean"]) {
    test(`bottom selection uses ${theme}/${accent} surface and foreground`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await mockLibrary(page, [], {
        events: eventsAtLevel(25),
        seenLevel: 25,
        prefs: { theme, accent },
      });
      await page.goto("/library");
      const selected = page
        .getByRole("navigation", { name: "Main" })
        .getByRole("link", { name: "Library", exact: true });
      await expect(selected).toHaveAttribute("aria-current", "page");
      await expect
        .poll(async () => {
          const [bg, primary] = await selected.evaluate((el) => [
            getComputedStyle(el).backgroundColor,
            getComputedStyle(document.documentElement)
              .getPropertyValue("--clr-primary-rgb")
              .trim()
              .split(/\s+/)
              .join(", "),
          ]);
          return bg === `rgb(${primary})`;
        })
        .toBe(true);
      // Colour transitions too, so wait for the settled text and icon paint, not just the background.
      const sample = () =>
        selected.evaluate((el) => {
          const probe = document.createElement("span");
          document.body.append(probe);
          probe.style.backgroundColor = "var(--clr-primary)";
          const expectedBg = getComputedStyle(probe).backgroundColor;
          probe.style.color = "var(--clr-on-primary)";
          const expectedFg = getComputedStyle(probe).color;
          probe.remove();
          return {
            bg: getComputedStyle(el).backgroundColor,
            fg: getComputedStyle(el.querySelector(".label")!).color,
            icon: getComputedStyle(el.querySelector(".icon svg")!).stroke,
            expectedBg,
            expectedFg,
            width: el.getBoundingClientRect().width,
            height: el.getBoundingClientRect().height,
          };
        });
      await expect
        .poll(async () => {
          const p = await sample();
          return p.fg === p.expectedFg && p.icon === p.expectedFg;
        })
        .toBe(true);
      const paint = await sample();
      expect(paint.bg).toBe(paint.expectedBg);
      expect(paint.fg).toBe(paint.expectedFg);
      expect(paint.icon).toBe(paint.expectedFg);
      expect(contrast(paint.fg, paint.bg)).toBeGreaterThanOrEqual(4.5);
      expect(paint.width).toBeGreaterThanOrEqual(44);
      expect(paint.height).toBeGreaterThanOrEqual(44);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      ).toBe(0);
      await selected.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/planner$/);
    });
  }
}

for (const theme of ["dark", "light"] as const) {
  test(`filled route selection and equipped art remain visible in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const movie = item(
      730001,
      "movie",
      "Navigation artwork fixture",
      { runtime_minutes: 90 },
      null,
    );
    movie.user.status = "completed";
    movie.user.progress = 1;
    await mockLibrary(page, [movie], {
      events: eventsAtLevel(25),
      seenLevel: 25,
      prefs: { theme, accent: "ember", profile_art: "movie:1" },
    });
    await page.goto("/library");
    await page.evaluate(() => (document.documentElement.style.fontSize = "18.4px"));
    const nav = page.getByRole("navigation", { name: "Main" });
    const initial = await nav.boundingBox();
    for (const name of ["Home", "Library", "Planner", "Profile"]) {
      const link = nav.getByRole("link", {
        name: name === "Profile" ? /^Profile/ : name,
        exact: true,
      });
      await link.focus();
      await page.keyboard.press("Enter");
      await expect(link).toHaveAttribute("aria-current", "page");
      await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
      await expect(link).toHaveCSS("background-color", "rgb(199, 102, 18)");
      expect(await nav.boundingBox()).toEqual(initial);
    }
    const selected = nav.getByRole("link", { name: /^Profile/ });
    const art = selected.locator(".profile-artwork");
    const ring = selected.locator(".level-ring");
    await expect(art).toHaveCount(1);
    await expect(ring).toHaveCount(1);
    for (const node of [art, ring]) {
      await expect(node).toBeVisible();
      const a = (await node.boundingBox())!,
        b = (await selected.boundingBox())!;
      expect(a.x).toBeGreaterThanOrEqual(b.x);
      expect(a.y).toBeGreaterThanOrEqual(b.y);
      expect(a.x + a.width).toBeLessThanOrEqual(b.x + b.width);
      expect(a.y + a.height).toBeLessThanOrEqual(b.y + b.height);
    }
    expect(await art.locator(".accent").evaluate((e) => getComputedStyle(e).fill)).toBe(
      "rgb(28, 18, 8)",
    );
    expect(
      await ring
        .locator("circle")
        .last()
        .evaluate((e) => getComputedStyle(e).stroke),
    ).not.toBe("rgb(199, 102, 18)");
    await page
      .getByRole("link", { name: "Settings", exact: true })
      .filter({ visible: true })
      .click();
    await expect(selected).toHaveClass(/within/);
    await expect(selected).not.toHaveAttribute("aria-current", "page");
    await expect(nav.locator(".tab-item.settings a")).toHaveAttribute("aria-current", "page");
    expect(await selected.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
      "rgb(199, 102, 18)",
    );
  });
}
test("desktop rail keeps its existing icon wash", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockLibrary(page, []);
  await page.goto("/library");
  const selected = page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Library", exact: true });
  expect(await selected.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
    "rgba(0, 0, 0, 0)",
  );
  expect(
    await selected.locator(".icon").evaluate((e) => getComputedStyle(e).backgroundColor),
  ).toMatch(/0\.22\)/);
});
