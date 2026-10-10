import { test, expect } from "@playwright/test";
import { ZipWriter, Uint8ArrayWriter, Uint8ArrayReader } from "@zip.js/zip.js";
const translation = {
  schemaVersion: 2,
  draft: true,
  bookId: "test-book",
  languages: { original: "en", translations: ["pl", "de"] },
  pages: [
    {
      number: 1,
      image: "001.png",
      items: [
        {
          id: "one",
          kind: "speech",
          order: 1,
          rect: { x: 0.1, y: 0.1, width: 0.6, height: 0.4 },
          original: "Hello!",
          translations: { pl: "Cześć!", de: "Hallo!" },
          font: "sans-serif",
          fontSize: 24,
        },
      ],
    },
  ],
};
async function archive(data: unknown = translation, raw?: string) {
  const writer = new ZipWriter(new Uint8ArrayWriter());
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4WQAAAAASUVORK5CYII=",
    "base64",
  );
  await writer.add("001.png", new Uint8ArrayReader(png));
  await writer.add("002.png", new Uint8ArrayReader(png));
  if (data !== null)
    await writer.add(
      "translations.json",
      new Uint8ArrayReader(Buffer.from(raw ?? JSON.stringify(data))),
    );
  return Buffer.from(await writer.close());
}
async function choose(
  page: import("@playwright/test").Page,
  data: unknown = translation,
  raw?: string,
) {
  await page.getByLabel("Comic archive").setInputFiles({
    name: "book.cbz",
    mimeType: "application/zip",
    buffer: await archive(data, raw),
  });
  await page.getByRole("button", { name: "Start reading" }).click();
}
test("import, translate, zoom, turn pages and restore progress", async ({
  page,
}) => {
  await page.goto("/");
  await choose(page);
  await expect(page.getByAltText("Comic page 1")).toBeVisible();
  await page.getByRole("button", { name: "Translate: Hello!" }).click();
  await expect(page.locator(".translation-card")).toContainText("Cześć!");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByRole("button", { name: "Reset zoom" })).toHaveText(
    "125%",
  );
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(
    page.getByText("This page hasn’t been translated yet."),
  ).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          new Promise((resolve) => {
            const r = indexedDB.open("CBreader", 1);
            r.onsuccess = () => {
              const db = r.result;
              const q = db
                .transaction("progress")
                .objectStore("progress")
                .get("test-book");
              q.onsuccess = () => {
                resolve(q.result?.page);
                db.close();
              };
            };
          }),
      ),
    )
    .toBe(1);
  await page.reload();
  await choose(page);
  await expect(page.getByAltText("Comic page 2")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
});
test("settings persist across reloads and books, and reset to defaults", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Settings", { exact: true }).click();
  await expect(page.getByLabel("Show text regions by default")).toBeChecked();
  await page.getByLabel("Show text regions by default").uncheck();
  await page.getByLabel("Default zoom").selectOption("150");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start reading" }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Back", exact: false }).click();
  await choose(page);
  await expect(page.locator(".hotspot.outlined")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset zoom" })).toHaveText(
    "150%",
  );
  await page.getByLabel("Translation language").selectOption("de");
  await page.reload();
  await choose(page);
  await expect(page.getByLabel("Translation language")).toHaveValue("de");
  await expect(page.getByRole("button", { name: "Reset zoom" })).toHaveText(
    "150%",
  );
  await expect(
    page.getByLabel("Show text regions", { exact: true }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Change comic" }).click();
  const polishOnly = structuredClone(translation);
  polishOnly.languages.translations = ["pl"];
  for (const page of polishOnly.pages) {
    for (const item of page.items) {
      Reflect.deleteProperty(item.translations, "de");
    }
  }
  await choose(page, polishOnly);
  await expect(page.getByLabel("Translation language")).toHaveValue("pl");
  await page.getByRole("button", { name: "Change comic" }).click();
  await choose(page);
  await expect(page.getByLabel("Translation language")).toHaveValue("de");
  await page.getByText("Settings", { exact: true }).click();
  await page.getByRole("button", { name: "Reset settings" }).click();
  await page.getByRole("button", { name: "Back to comic" }).click();
  await expect(page.getByLabel("Translation language")).toHaveValue("pl");
  await expect(page.getByRole("button", { name: "Reset zoom" })).toHaveText(
    "100%",
  );
  await expect(page.locator(".hotspot.outlined")).toHaveCount(1);
  await page.reload();
  await choose(page);
  await expect(
    page.getByLabel("Show text regions", { exact: true }),
  ).toBeChecked();
});

test("settings view preserves the open page and zoom, and restores focus", async ({
  page,
}) => {
  await page.goto("/");
  await choose(page);
  await page.getByRole("button", { name: "Next page" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeFocused();
  await expect(page.getByAltText("Comic page 2")).toBeHidden();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Escape");
  await expect(page.getByAltText("Comic page 2")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset zoom" })).toHaveText(
    "125%",
  );
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toBeFocused();
});

test("settings view opens from fullscreen", async ({ page }) => {
  await page.goto("/");
  await choose(page);
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to comic" }).click();
  await expect(page.getByAltText("Comic page 1")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enter fullscreen" }),
  ).toBeVisible();
});

test("settings remain usable when saving is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Storage blocked");
    };
  });
  await page.goto("/");
  await page.getByText("Settings", { exact: true }).click();
  await page.getByLabel("Show text regions by default").uncheck();
  await expect(page.getByRole("status")).toContainText("could not be saved");
  await page.getByRole("button", { name: "Back", exact: false }).click();
  await choose(page);
  await expect(page.locator(".hotspot.outlined")).toHaveCount(0);
});

test("rejects a translation for different images", async ({ page }) => {
  await page.goto("/");
  const wrong = structuredClone(translation);
  wrong.pages[0].image = "missing.png";
  await choose(page, wrong);
  await expect(page.getByRole("alert")).toContainText("does not match");
});
test("mobile reading controls remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await choose(page);
  await expect(page.getByAltText("Comic page 1")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByAltText("Comic page 2")).toBeVisible();
});

test("real comic archive and starter draft", async ({ page }) => {
  test.skip(
    !process.env.CBREADER_TEST_CBZ,
    "Set CBREADER_TEST_CBZ to test a local comic.",
  );
  await page.goto("/");
  await page.screenshot({ path: "/tmp/cbreader-welcome.png", fullPage: true });
  await page
    .getByLabel("Comic archive")
    .setInputFiles(process.env.CBREADER_TEST_CBZ!);
  await page.getByRole("button", { name: "Start reading" }).click();
  await expect(page.getByAltText("Comic page 1")).toBeVisible();
  await expect(
    page.getByText(
      "Draft translations · 3 of 242 pages included. Text and tap areas may need review.",
    ),
  ).toBeVisible();
  await page.getByLabel("Page", { exact: true }).selectOption({ value: "2" });
  await expect(page.getByAltText("Comic page 3")).toBeVisible();
  await page
    .getByRole("button", { name: "Translate: Nice to meet you." })
    .click();
  await expect(page.locator(".translation-card")).toContainText(
    "Miło cię poznać.",
  );
  await page.screenshot({ path: "/tmp/cbreader-reader.png", fullPage: true });
  const before = await page
    .getByRole("button", { name: "Translate: Nice to meet you." })
    .boundingBox();
  await page.getByRole("button", { name: "Zoom in" }).click();
  const after = await page
    .getByRole("button", { name: "Translate: Nice to meet you." })
    .boundingBox();
  expect(after!.width / before!.width).toBeCloseTo(1.25, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/cbreader-mobile.png", fullPage: true });
});

test("reports missing or invalid embedded translations", async ({ page }) => {
  await page.goto("/");
  await choose(page, null);
  await expect(page.getByRole("alert")).toContainText(
    "missing translations.json",
  );
  await choose(page, translation, "{bad json");
  await expect(page.getByRole("alert")).toContainText("valid UTF-8 JSON");
});

test("rejects an oversized embedded translation", async ({ page }) => {
  await page.goto("/");
  await choose(page, translation, " ".repeat(10 * 1024 * 1024 + 1));
  await expect(page.getByRole("alert")).toContainText("exceeds 10 MB");
});

test("fullscreen enters, exits and follows browser exit", async ({ page }) => {
  await page.goto("/");
  await choose(page);
  await expect(page.getByAltText("Comic page 1")).toBeVisible();
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(
    page.getByRole("button", { name: "Exit fullscreen" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      document.fullscreenElement?.getAttribute("aria-label"),
    ),
  ).toBe("Comic reader");
  const pageBox = await page.getByAltText("Comic page 1").boundingBox();
  const viewportBox = await page.locator(".viewport").boundingBox();
  expect(pageBox!.width).toBeLessThanOrEqual(viewportBox!.width);
  expect(pageBox!.height).toBeLessThanOrEqual(viewportBox!.height);
  await page.screenshot({ path: "/tmp/cbreader-fullscreen.png" });
  await page.getByRole("button", { name: "Translate: Hello!" }).click();
  await expect(page.locator(".fullscreen-caption")).toContainText("Cześć!");
  await page.evaluate(() => document.exitFullscreen());
  await expect(
    page.getByRole("button", { name: "Enter fullscreen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await page.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect(
    page.getByRole("button", { name: "Enter fullscreen" }),
  ).toBeVisible();
});

test("fullscreen falls back to viewport mode and Escape restores scrolling", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(document, "fullscreenEnabled", { get: () => false }),
  );
  await page.goto("/");
  await choose(page);
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(page.locator(".reading-fullscreen")).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    "hidden",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".reading-fullscreen")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
});

test.describe("touch gestures", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("swipes turn pages, taps reveal text, and zoomed drags pan", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await choose(page);
    await expect(page.getByAltText("Comic page 1")).toBeVisible();
    const client = await context.newCDPSession(page);
    async function swipe(dx: number, dy = 0) {
      const box = (await page.locator(".viewport").boundingBox())!;
      const x = dx < 0 ? box.x + box.width - 35 : box.x + 35,
        y = box.y + 160;
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y, id: 1 }],
      });
      for (let i = 1; i <= 5; i++)
        await client.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x + (dx * i) / 5, y: y + (dy * i) / 5, id: 1 }],
        });
      await client.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    }
    await page.getByRole("button", { name: "Translate: Hello!" }).tap();
    await expect(page.locator(".translation-card")).toContainText("Cześć!");
    await swipe(-180);
    await expect(page.getByAltText("Comic page 2")).toBeVisible();
    await expect(page.locator(".translation-card")).toHaveCount(0);
    await swipe(-180);
    await expect(page.getByAltText("Comic page 2")).toBeVisible();
    await swipe(180);
    await expect(page.getByAltText("Comic page 1")).toBeVisible();
    await expect(page.locator(".translation-card")).toHaveCount(0);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await swipe(-180);
    await expect(page.getByAltText("Comic page 1")).toBeVisible();
    await expect
      .poll(() => page.locator(".viewport").evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
    await expect(page.locator(".translation-card")).toHaveCount(0);
    await page.getByRole("button", { name: "Reset zoom" }).click();
    await swipe(-10, -100);
    await expect(page.getByAltText("Comic page 1")).toBeVisible();
  });
});

test("switches translations in the sidebar, page, and fullscreen", async ({
  page,
}) => {
  await page.goto("/");
  await choose(page);
  await page.getByRole("button", { name: "Translate: Hello!" }).click();
  await page.getByLabel("Translation language").selectOption("de");
  await expect(page.locator(".translation-card")).toContainText("Hallo!");
  await expect(page.locator(".hotspot.selected")).toHaveText("Hallo!");
  await expect(page.locator('.translation-card [lang="en"]')).toHaveText(
    "Hello!",
  );
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(page.locator(".fullscreen-caption")).toContainText("Hallo!");
  await page.getByLabel("Translation language").selectOption("pl");
  await expect(page.locator(".fullscreen-caption")).toContainText("Cześć!");
});
test("shows missing draft translations explicitly", async ({ page }) => {
  const partial = structuredClone(translation);
  partial.languages.translations.push("fr");
  await page.goto("/");
  await choose(page, partial);
  await page.getByRole("button", { name: "Translate: Hello!" }).click();
  await page.getByLabel("Translation language").selectOption("fr");
  await expect(page.locator(".translation-card")).toContainText(
    "Translation not available in this language yet.",
  );
  await expect(page.locator(".translation-card")).not.toContainText("Cześć!");
});

test.describe("smooth page swiping", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("follows the finger, snaps back, accepts slow drags, and cancels cleanly", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await choose(page);
    await expect(page.getByAltText("Comic page 1")).toBeVisible();
    await expect(page.locator(".swipe-neighbor")).toHaveCount(1);
    const client = await context.newCDPSession(page);
    const box = (await page.locator(".viewport").boundingBox())!;
    const x = box.x + box.width - 40,
      y = box.y + 160;
    const offset = () =>
      page
        .locator(".page-stage")
        .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
    async function start() {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y, id: 1 }],
      });
    }
    async function move(dx: number) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + dx, y, id: 1 }],
      });
    }
    async function end() {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    }
    await start();
    await move(-22);
    await expect.poll(offset).toBeLessThan(-10);
    await end();
    await expect.poll(offset).toBe(0);
    await expect(page.getByLabel("Page", { exact: true })).toHaveValue("0");

    await start();
    await move(-145);
    await expect.poll(offset).toBeLessThan(-100);
    // Holding the drag must not make an otherwise valid page turn expire.
    await page.waitForTimeout(850);
    await end();
    await expect(page.getByAltText("Comic page 2")).toBeVisible();
    await expect.poll(offset).toBe(0);
    await expect(page.getByRole("status")).toHaveCount(0);

    await start();
    await move(-140); // Last-page resistance, never turn beyond the book.
    await expect.poll(offset).toBeGreaterThan(-40);
    await end();
    await expect.poll(offset).toBe(0);
    await expect(page.getByLabel("Page", { exact: true })).toHaveValue("1");

    await start();
    await move(-90);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await expect.poll(offset).toBe(0);
    await expect(page.getByLabel("Page", { exact: true })).toHaveValue("1");
  });

  test("respects reduced motion and does not turn during a two-finger gesture", async ({
    page,
    context,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await choose(page);
    await expect(page.getByAltText("Comic page 1")).toBeVisible();
    const client = await context.newCDPSession(page);
    const box = (await page.locator(".viewport").boundingBox())!;
    const x = box.x + box.width - 50,
      y = box.y + 160;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x - 90, y, id: 1 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: x - 90, y, id: 1 },
        { x: x - 160, y: y + 20, id: 2 },
      ],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(page.getByLabel("Page", { exact: true })).toHaveValue("0");
    await expect
      .poll(() =>
        page
          .locator(".page-stage")
          .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41),
      )
      .toBe(0);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 3 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x - 170, y, id: 3 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(page.getByAltText("Comic page 2")).toBeVisible();
    await expect(page.locator(".page-stage")).toHaveCSS(
      "transition-duration",
      "0s",
    );
  });
});

test.describe("tablet reading", () => {
  test.use({ hasTouch: true, viewport: { width: 820, height: 1180 } });

  test("shows only the page, with controls and translations on demand", async ({
    page,
  }) => {
    await page.goto("/");
    await choose(page);
    const image = page.getByAltText("Comic page 1");
    await expect(image).toBeVisible();
    await expect(page.locator(".brand")).toBeHidden();
    await expect(page.locator(".reader-heading")).toBeHidden();
    await expect(page.locator(".translation-panel")).toBeHidden();
    await expect(page.locator(".toolbar")).toHaveCount(0);
    await expect(page.locator(".canvas-footer")).toHaveCount(0);
    await expect(page.locator(".hotspot.outlined")).toHaveCount(1);
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
    const before = (await image.boundingBox())!;
    expect(before.x).toBeGreaterThanOrEqual(0);
    expect(before.y).toBeGreaterThanOrEqual(0);
    expect(before.x + before.width).toBeLessThanOrEqual(821);
    expect(before.y + before.height).toBeLessThanOrEqual(1181);

    await page.locator(".viewport").tap({ position: { x: 780, y: 1100 } });
    await expect(
      page.getByRole("button", { name: "Hide reading controls" }),
    ).toBeVisible();
    await expect(page.getByLabel("Translation language")).toBeVisible();
    await page.getByText("Settings", { exact: true }).click();
    await page.getByLabel("Show text regions by default").uncheck();
    await expect(image).toBeHidden();
    await page.getByRole("button", { name: "Back to comic" }).click();
    await expect(page.locator(".hotspot.outlined")).toHaveCount(0);
    expect(await image.boundingBox()).toEqual(before); // Overlay never shrinks the page.
    await page.getByRole("button", { name: "Hide reading controls" }).click();
    await expect(page.locator(".toolbar")).toHaveCount(0);

    await page.getByRole("button", { name: "Translate: Hello!" }).tap();
    await expect(page.locator(".fullscreen-caption")).toContainText("Cześć!");
    await expect(page.locator(".toolbar")).toHaveCount(0);
    await page.getByRole("button", { name: "Dismiss translation" }).tap();
    await expect(page.locator(".fullscreen-caption")).toHaveCount(0);

    await page.setViewportSize({ width: 1180, height: 820 });
    await expect
      .poll(async () => (await image.boundingBox())!.height)
      .toBeLessThanOrEqual(821);
    await expect(page.locator(".toolbar")).toHaveCount(0);
    await page.keyboard.press("m");
    await expect(
      page.getByRole("button", { name: "Change comic" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Change comic" }).click();
    await expect(
      page.getByRole("heading", { name: "Open your comic" }),
    ).toBeVisible();
    await expect(page.locator(".brand")).toBeVisible();
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });

  test("swipes with controls hidden and keeps them hidden after turning", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await choose(page);
    await expect(page.getByAltText("Comic page 1")).toBeVisible();
    const client = await context.newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 750, y: 600, id: 1 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 400, y: 600, id: 1 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(page.getByAltText("Comic page 2")).toBeVisible();
    await expect(page.locator(".toolbar")).toHaveCount(0);
    await page.keyboard.press("m");
    await page.getByRole("button", { name: "Previous page" }).click();
    await expect(page.getByAltText("Comic page 1")).toBeVisible();
    await expect(page.locator(".toolbar")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Show reading controls" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator(".toolbar")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".toolbar")).toHaveCount(0);
  });
});
