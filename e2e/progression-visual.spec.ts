import { expect, test } from "./fixtures/tauri-ipc";
import { eventsAtLevel, item, mockLibrary } from "./fixtures/library";

for (const path of ["/library"]) {
  for (const theme of ["dark", "light", "system"] as const) {
    for (const accent of ["default", "ember"] as const) {
      test(`${path}: sephirot ${theme}/${accent} enlarged-text geometry and contrast`, async ({
        page,
      }, info) => {
        const entries = Array.from({ length: 12 }, (_, i) => {
          const entry = item(i + 1, "tv", `Series ${i + 1}`, {}, null);
          entry.user.status = "completed";
          return entry;
        });
        entries.push(
          item(90, "movie", "Queued movie", {}, null),
          item(91, "book", "Queued book", {}, null),
        );
        await mockLibrary(page, entries, {
          events: eventsAtLevel(8),
          seenLevel: 50,
          motion: false,
          prefs: { theme, accent },
        });
        await page.goto(path);
        await page.addStyleTag({
          content: "html { font-size: 18.4px !important; --safe-top: 32px !important; }",
        });
        if (path === "/library")
          await page.getByRole("button", { name: "Tree", exact: true }).click();
        const tree = page.locator(".progression-tree");
        await expect(tree.getByRole("button", { name: "TV", exact: true })).toContainText(
          "12 completed",
        );
        await tree.screenshot({ path: info.outputPath("main.png"), animations: "disabled" });
        await tree.getByRole("button", { name: "TV", exact: true }).click();
        await page.goBack();
        await tree.getByRole("button", { name: "Games", exact: true }).click();
        await page.goBack();
        await tree.getByRole("button", { name: "TV", exact: true }).click();
        await expect
          .poll(() =>
            tree.getByRole("button", { name: "All media" }).evaluate((el) => {
              const r = el.getBoundingClientRect();
              const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
              return !!hit && (hit === el || el.contains(hit));
            }),
          )
          .toBe(true);
        const map = tree.getByRole("group", { name: "Journey milestones" });
        await expect(
          map.locator('[data-kind="art"]').getByText("Available", { exact: true }),
        ).toHaveCount(3);
        await expect(
          map.locator('[data-kind="art"]').getByText("Locked", { exact: true }),
        ).toHaveCount(2);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
        ).toBe(0);
        const geometry = await map.getByRole("button").evaluateAll((nodes) =>
          nodes.map((node) => {
            const r = node.getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              right: r.right,
              bottom: r.bottom,
              width: r.width,
              height: r.height,
            };
          }),
        );
        for (const [i, a] of geometry.entries()) {
          expect(a.width).toBeGreaterThanOrEqual(44);
          expect(a.height).toBeGreaterThanOrEqual(44);
          expect(a.x).toBeGreaterThanOrEqual(0);
          expect(a.right).toBeLessThanOrEqual(page.viewportSize()!.width);
          for (const b of geometry.slice(i + 1))
            expect(
              a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y,
              JSON.stringify({ a, b }),
            ).toBe(false);
        }
        const contrast = await map.locator(".node-copy").evaluateAll((nodes) => {
          const lum = (color: string) => {
            const c = color
              .match(/[\d.]+/g)!
              .slice(0, 3)
              .map(Number)
              .map((v) => v / 255)
              .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
            return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
          };
          return nodes.flatMap((node) =>
            [...node.querySelectorAll("strong, span")].map((text) => {
              const a = lum(getComputedStyle(text).color),
                b = lum(getComputedStyle(node).backgroundColor);
              return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            }),
          );
        });
        expect(Math.min(...contrast)).toBeGreaterThanOrEqual(4.5);
        await tree.screenshot({ path: info.outputPath("tv.png"), animations: "disabled" });
      });
    }
  }
}

test("every media map keeps its channels, rune and existing artwork tied to live accent tokens", async ({
  page,
}) => {
  const entries = (["movie", "tv", "anime", "manga", "book", "game"] as const).map((type, i) => {
    const saved = item(i + 1, type, `Accent ${type}`, {}, null);
    saved.user.status = "completed";
    return saved;
  });
  await mockLibrary(page, entries, { events: eventsAtLevel(8), seenLevel: 50, motion: false });
  await page.goto("/library");
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  const tree = page.locator(".progression-tree");
  await expect(tree.locator(".map-node")).toHaveCount(6);
  const paint = () =>
    tree.evaluate((el) =>
      [".channel-engraving", ".rune", ".profile-artwork .accent"].map((selector) => {
        const style = getComputedStyle(el.querySelector(selector)!);
        return selector === ".channel-engraving" ? style.stroke : style.fill;
      }),
    );
  const before = await paint();
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--clr-accent-rgb", "30 180 240");
    document.documentElement.style.setProperty("--clr-primary-rgb", "30 180 240");
  });
  await expect
    .poll(async () => (await paint()).map((color, i) => color !== before[i]))
    .toEqual([true, true, true]);
  const after = await paint();
  for (let i = 0; i < after.length; i++) expect(after[i]).not.toBe(before[i]);
  for (const name of ["Movies", "TV", "Anime", "Manga", "Books", "Games"]) {
    await tree.getByRole("button", { name, exact: true }).click();
    await expect(
      tree.getByRole("group", { name: "Journey milestones" }).locator('[data-kind="art"]'),
    ).toHaveCount(5);
    await expect.poll(async () => (await paint()).slice(1)).toEqual(after.slice(1));
    const earned = tree.locator(".journey-edge.earned .channel-engraving");
    await expect(earned.first()).toBeAttached();
    await expect
      .poll(() => earned.evaluateAll((paths) => paths.map((path) => getComputedStyle(path).stroke)))
      .toEqual(Array(await earned.count()).fill(after[2]));
    await page.goBack();
    await expect(tree.getByRole("button", { name, exact: true })).toBeFocused();
  }
});

for (const theme of ["dark", "light", "system"] as const) {
  for (const accent of ["default", "ember"] as const) {
    for (const fontSize of [16, 18.4]) {
      for (const [state, count, level] of [
        ["empty", 0, 1],
        ["partial", 12, 8],
        ["unlocked", 50, 50],
        ["max", 50, 200],
        ["deleted", 0, 200],
      ] as const) {
        test(`Journey geometry ${theme}/${accent}/${fontSize}: ${state}`, async ({
          page,
        }, info) => {
          const types = ["movie", "tv", "anime", "manga", "book", "game"] as const;

          const entries = types.flatMap((type, t) =>
            Array.from({ length: count }, (_, i) => {
              const saved = item(t * 1000 + i + 1, type, `${type} ${i}`, {}, null);
              saved.user.status = "completed";
              return saved;
            }),
          );
          await mockLibrary(page, entries, {
            events: eventsAtLevel(level),
            seenLevel: 250,
            motion: false,
            prefs: { theme, accent },
          });
          await page.goto("/library");
          await page.addStyleTag({
            content: `html { font-size:${fontSize}px !important; --safe-top:32px !important; }`,
          });
          await page.getByRole("button", { name: "Tree", exact: true }).click();
          const tree = page.locator(".progression-tree");
          await expect(tree.locator(".map-node")).toHaveCount(6);
          for (const media of ["main", "Movies", "TV", "Games"]) {
            if (media !== "main")
              await tree.getByRole("button", { name: media, exact: true }).click();
            const map = tree.locator(".runic-map");
            const measured = await map.evaluate((el) => {
              const rect = (node: Element) => {
                const r = node.getBoundingClientRect();
                return {
                  x: r.x,
                  y: r.y,
                  right: r.right,
                  bottom: r.bottom,
                  width: r.width,
                  height: r.height,
                };
              };
              const buttons = [...el.querySelectorAll<HTMLButtonElement>(".map-node")];
              const points = new Map(
                buttons.map((node) => {
                  const r = node.querySelector(".node-seal")!.getBoundingClientRect();
                  return [node.dataset.node!, { x: r.x + r.width / 2, y: r.y + r.height / 2 }];
                }),
              );
              const root = el.querySelector(".map-root");
              if (root) {
                const r = root.getBoundingClientRect();
                points.set("root", { x: r.x + r.width / 2, y: r.y + r.height / 2 });
              }
              const edges = [...el.querySelectorAll<SVGGElement>(".journey-edge")].map((edge) => {
                const path = edge.querySelector<SVGPathElement>("path")!;
                const first = path.getPointAtLength(0).matrixTransform(path.getScreenCTM()!);
                const last = path
                  .getPointAtLength(path.getTotalLength())
                  .matrixTransform(path.getScreenCTM()!);
                const from = points.get(edge.dataset.from!)!;
                const to = points.get(edge.dataset.to!)!;
                return {
                  earned: edge.classList.contains("earned"),
                  delta: Math.max(
                    Math.abs(first.x - from.x),
                    Math.abs(first.y - from.y),
                    Math.abs(last.x - to.x),
                    Math.abs(last.y - to.y),
                  ),
                };
              });
              return {
                brokenWords: buttons.flatMap((node) => {
                  const text = node.querySelector("strong")!.firstChild!;
                  return [...(text.textContent ?? "").matchAll(/\S+/g)]
                    .filter((word) => {
                      const range = document.createRange();
                      range.setStart(text, word.index!);
                      range.setEnd(text, word.index! + word[0].length);
                      return range.getClientRects().length > 1;
                    })
                    .map((word) => ({
                      word: word[0],
                      width: node.querySelector("strong")!.getBoundingClientRect().width,
                      font: getComputedStyle(node.querySelector("strong")!).font,
                      copy: getComputedStyle(node.querySelector(".node-copy")!).width,
                    }));
                }),
                bounds: rect(el),
                buttons: buttons.map((node) => ({ id: node.dataset.node, ...rect(node) })),
                edges,
                art: buttons.flatMap((node) =>
                  [...node.querySelectorAll(".node-seal .profile-artwork")].map((art) => ({
                    seal: rect(node.querySelector(".node-seal")!),
                    art: rect(art),
                  })),
                ),
                overflow:
                  document.documentElement.scrollWidth - document.documentElement.clientWidth,
              };
            });
            expect(measured.overflow).toBe(0);
            expect(measured.brokenWords).toEqual([]);
            expect(measured.buttons).toHaveLength(media === "main" ? 6 : media === "Games" ? 8 : 9);
            for (const [i, a] of measured.buttons.entries()) {
              expect(a.width).toBeGreaterThanOrEqual(44);
              expect(a.height).toBeGreaterThanOrEqual(44);
              expect(a.x).toBeGreaterThanOrEqual(measured.bounds.x - 1);
              expect(a.right).toBeLessThanOrEqual(measured.bounds.right + 1);
              expect(a.y).toBeGreaterThanOrEqual(measured.bounds.y);
              expect(a.bottom).toBeLessThanOrEqual(measured.bounds.bottom);
              for (const b of measured.buttons.slice(i + 1))
                expect(
                  a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y,
                  `${state}/${media}: ${a.id} overlaps ${b.id}`,
                ).toBe(false);
            }
            for (const { seal, art } of measured.art) {
              expect(art.width + 8).toBeLessThanOrEqual(seal.width);
              expect(art.height + 8).toBeLessThanOrEqual(seal.height);
            }
            for (const edge of measured.edges) expect(edge.delta).toBeLessThanOrEqual(1);
            if (media !== "main") {
              expect(measured.edges.length).toBeGreaterThan(0);
              if (state === "unlocked" || state === "max")
                expect(measured.edges.every((edge) => edge.earned)).toBe(true);
              if (state === "partial") {
                expect(measured.edges.some((edge) => edge.earned)).toBe(true);
                expect(measured.edges.some((edge) => !edge.earned)).toBe(true);
              }
            }
            if (
              state === "unlocked" &&
              theme === "dark" &&
              accent === "default" &&
              fontSize === 18.4
            )
              await tree.screenshot({
                path: info.outputPath(`${media}-unlocked.png`),
                animations: "disabled",
                style: ".app-header { visibility:hidden !important; }",
              });
            if (media !== "main") await page.goBack();
          }
        });
      }
    }
  }
}
