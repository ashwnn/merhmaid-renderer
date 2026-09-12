import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * End-to-end checks against the production build.
 *
 * These tests are the safety net for the WYSIWYG promise of the app: a
 * Markdown label must be rendered inside the Mermaid node *and* survive the
 * SVG/PNG export pipeline without being clipped or losing its styling.
 */

const SOURCE_INPUT = '[data-testid="source-input"]';
const PREVIEW_HOST = '[data-testid="preview-host"]';
const STATUS = '[data-testid="render-status"]';

async function setSource(page: Page, source: string) {
  const editor = page.locator(SOURCE_INPUT);
  await editor.click();
  await editor.fill(source);
}

async function waitForRender(page: Page) {
  await expect(page.locator(`${PREVIEW_HOST} svg`)).toBeVisible();
  await expect(page.locator(STATUS)).toContainText(/Rendered|Markdown label/, {
    timeout: 30_000,
  });
  // Let the debounce + mermaid settle.
  await page.waitForTimeout(700);
}

test.describe("Merhmaid Renderer", () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    (page as Page & { __errors: string[] }).__errors = errors;
  });

  test("renders the default diagram with markdown node labels", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForRender(page);

    const host = page.locator(PREVIEW_HOST);
    await expect(host.locator("svg")).toHaveCount(1);

    // Markdown really was converted, not dumped as plain text.
    await expect(host.locator(".mehrmaid-label strong").first()).toHaveText(
      "Markdown",
    );
    await expect(host.locator(".mehrmaid-label")).toHaveCount(4);
    await expect(host.locator(".mehrmaid-label table")).toHaveCount(1);
    await expect(host.locator(".mehrmaid-label pre code")).toHaveCount(1);

    // The raw markdown markers must not leak into the diagram text.
    await expect(host.locator("svg")).not.toContainText("**Markdown**");
  });

  test("markdown labels are never clipped by their foreignObject", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForRender(page);

    const measurements = await page.evaluate(() => {
      const labels = Array.from(
        document.querySelectorAll(`${'[data-testid="preview-host"]'} .mehrmaid-label`),
      );
      return labels.map((label) => {
        const box = label.getBoundingClientRect();
        const foreignObject = label.closest("foreignObject");
        const fo = foreignObject?.getBoundingClientRect();
        return {
          width: box.width,
          height: box.height,
          foWidth: fo?.width ?? 0,
          foHeight: fo?.height ?? 0,
        };
      });
    });

    expect(measurements.length).toBeGreaterThan(0);
    for (const item of measurements) {
      expect(item.width).toBeGreaterThan(20);
      expect(item.height).toBeGreaterThan(10);
      // Allow one pixel of rounding.
      expect(item.width).toBeLessThanOrEqual(item.foWidth + 1);
      expect(item.height).toBeLessThanOrEqual(item.foHeight + 1);
    }
  });

  test("non-flowchart diagrams render without being rewritten", async ({
    page,
  }) => {
    await page.goto("/");
    await setSource(
      page,
      ["sequenceDiagram", "  Alice->>Bob: Hello", "  Bob-->>Alice: Hi"].join(
        "\n",
      ),
    );
    await waitForRender(page);

    const host = page.locator(PREVIEW_HOST);
    await expect(host.locator("svg")).toHaveCount(1);
    await expect(host.locator(".mehrmaid-label")).toHaveCount(0);
    await expect(host.locator("svg")).toContainText("Alice");
    await expect(host.locator("svg")).toContainText("Hello");
  });

  test("subgraph titles support markdown", async ({ page }) => {
    await page.goto("/");
    await setSource(
      page,
      [
        "flowchart TB",
        '  subgraph "**Bold** group"',
        '    A("`code` node") --> B("plain")',
        "  end",
      ].join("\n"),
    );
    await waitForRender(page);

    const host = page.locator(PREVIEW_HOST);
    const cluster = host.locator(".cluster-label");
    await expect(cluster.locator("strong")).toHaveText("Bold");
    await expect(cluster).not.toContainText("**Bold**");
  });

  test("reports syntax errors without losing the previous render", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForRender(page);

    await setSource(page, "flowchart LR\n  A[ --> B");
    await expect(page.locator('[data-testid="error-banner"]')).toBeVisible();
    await expect(page.locator(STATUS)).toContainText(/error/i);

    // Fixing the source recovers automatically (live preview).
    await setSource(page, 'flowchart LR\n  A["back **again**"] --> B["ok"]');
    await expect(page.locator('[data-testid="error-banner"]')).toBeHidden();
    await expect(page.locator(`${PREVIEW_HOST} .mehrmaid-label strong`)).toHaveText(
      "again",
    );
  });

  test("error line numbers account for multi-line labels", async ({ page }) => {
    await page.goto("/");
    await waitForRender(page);

    // The label spans three lines and collapses to one placeholder, so a naive
    // line number would point two lines too early.
    await setSource(
      page,
      [
        "flowchart LR",
        '  A("first',
        "  second",
        '  third") --> B',
        "  B[ --> C(",
      ].join("\n"),
    );

    const banner = page.locator('[data-testid="error-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("line 5");

    await banner.getByRole("button", { name: /Go to line/ }).click();
    await expect(page.locator("footer")).toContainText("Ln 5");

    const selection = await page
      .locator(SOURCE_INPUT)
      .evaluate((node) => {
        const textarea = node as HTMLTextAreaElement;
        return textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
      });
    expect(selection).toContain("B[ --> C(");
  });

  test("exported SVG is self-contained and rasterises with styling", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForRender(page);

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /^Export/ }).click();
    await page.getByRole("menuitem", { name: /SVG image/ }).click();
    const file = await download;
    const path = await file.path();
    const markup = readFileSync(path, "utf8");

    // Labels and their stylesheet made it into the file.
    expect(markup).toContain("mehrmaid-label");
    expect(markup).toContain("<style");
    expect(markup).toContain("http://www.w3.org/1999/xhtml");
    expect(markup).toContain("viewBox=");
    expect(markup).not.toContain("**Markdown**");

    // Free of the app's Tailwind classes, which would not resolve in isolation.
    expect(markup).not.toContain("text-muted-foreground");

    // Rasterise the *exported* file and confirm it is not blank and that the
    // embedded stylesheet survived (table borders produce several colours).
    const stats = await page.evaluate(async (svgMarkup) => {
      // Data URLs (not blob URLs) keep the canvas origin-clean in Chromium.
      const bytes = new TextEncoder().encode(svgMarkup);
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const url = `data:image/svg+xml;base64,${btoa(binary)}`;
      {
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("rasterise failed"));
          image.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(image.width, 2000);
        canvas.height = Math.min(image.height, 2000);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("no 2d context");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        const colours = new Set<string>();
        let opaque = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 0) opaque += 1;
          colours.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
        }
        return { colours: colours.size, opaque, total: data.length / 4 };
      }
    }, markup);

    expect(stats.opaque).toBeGreaterThan(stats.total * 0.05);
    expect(stats.colours).toBeGreaterThan(3);
  });

  test("exported PNG has the requested resolution and file signature", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForRender(page);

    const reported = await page
      .locator(`${PREVIEW_HOST} svg`)
      .evaluate((node) => {
        const box = (node as SVGSVGElement).viewBox.baseVal;
        return { width: Math.round(box.width), height: Math.round(box.height) };
      });

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /^Export/ }).click();
    await page.getByRole("menuitem", { name: /PNG image/ }).click();
    const file = await download;
    const buffer = readFileSync(await file.path());

    // PNG signature.
    expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    // IHDR carries the pixel size; the default scale is 2x plus 16px padding.
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    expect(width).toBe((reported.width + 32) * 2);
    expect(height).toBe((reported.height + 32) * 2);
    // A blank canvas compresses to a few hundred bytes.
    expect(buffer.byteLength).toBeGreaterThan(5_000);
  });

  test("source and settings survive a reload", async ({ page }) => {
    await page.goto("/");
    await waitForRender(page);

    await setSource(page, 'flowchart LR\n  A["persisted **value**"] --> B');
    await waitForRender(page);

    await page.reload();
    await expect(page.locator(SOURCE_INPUT)).toHaveValue(/persisted \*\*value\*\*/);
    await expect(
      page.locator(`${PREVIEW_HOST} .mehrmaid-label strong`),
    ).toHaveText("value");
  });

  test("share links restore the diagram", async ({ page, context }) => {
    await page.goto("/");
    await waitForRender(page);

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await setSource(page, 'flowchart LR\n  A["shared **link**"] --> B');
    await waitForRender(page);

    await page.getByRole("button", { name: /Copy share link/ }).click();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain("#d=");

    const fresh = await context.newPage();
    await fresh.goto(clipboard);
    await expect(
      fresh.locator(`${PREVIEW_HOST} .mehrmaid-label strong`),
    ).toHaveText("link");
  });

  test("no unexpected console errors during a normal session", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForRender(page);
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByText("Markdown labels").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Examples/ }).click();
    await expect(page.getByText("Markdown playground")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    const errors = (page as Page & { __errors: string[] }).__errors ?? [];
    const relevant = errors.filter(
      (message) =>
        !message.includes("favicon") &&
        !message.includes("Failed to load resource"),
    );
    expect(relevant).toEqual([]);
  });
});
