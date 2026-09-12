/**
 * SVG / PNG export helpers.
 *
 * The tricky part of exporting a Mermaid diagram with HTML labels is that the
 * SVG is rasterised in an isolated document: external stylesheets, external
 * images and page fonts are all unavailable. Everything the diagram needs is
 * therefore embedded into the exported file.
 */

import { LABEL_CSS } from "@/lib/label";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

export interface SerializeOptions {
  /** CSS colour for the background, or `null` for transparency. */
  background?: string | null;
  /** Extra padding around the diagram, in diagram units. */
  padding?: number;
  /** Extra CSS appended to the embedded stylesheet. */
  extraCss?: string;
}

export interface SerializedSvg {
  markup: string;
  width: number;
  height: number;
}

function viewBoxSize(svg: SVGSVGElement): { x: number; y: number; w: number; h: number } {
  const raw = svg.getAttribute("viewBox");
  const parts = raw?.split(/[\s,]+/).map(Number) ?? [];
  if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
    return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
  }
  const rect = svg.getBoundingClientRect();
  return { x: 0, y: 0, w: rect.width || 800, h: rect.height || 600 };
}

export function serializeSvg(
  svg: SVGSVGElement,
  options: SerializeOptions = {},
): SerializedSvg {
  const { background = null, padding = 0, extraCss = "" } = options;
  const clone = svg.cloneNode(true) as SVGSVGElement;

  clone.setAttribute("xmlns", SVG_NS);
  clone.setAttribute("xmlns:xlink", XLINK_NS);

  const box = viewBoxSize(svg);
  const width = Math.max(Math.round(box.w + padding * 2), 1);
  const height = Math.max(Math.round(box.h + padding * 2), 1);
  const viewBox = `${box.x - padding} ${box.y - padding} ${width} ${height}`;

  clone.setAttribute("viewBox", viewBox);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.removeAttribute("style");

  // Embedded stylesheet: makes the exported file self-contained.
  const style = document.createElementNS(SVG_NS, "style");
  style.textContent = `\n${LABEL_CSS}\n.mehrmaid-label { text-rendering: geometricPrecision; }\n${extraCss}\n`;
  clone.insertBefore(style, clone.firstChild);

  if (background) {
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", String(box.x - padding));
    rect.setAttribute("y", String(box.y - padding));
    rect.setAttribute("width", String(width));
    rect.setAttribute("height", String(height));
    rect.setAttribute("fill", background);
    style.after(rect);
  }

  return {
    markup: `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`,
    width,
    height,
  };
}

/* ------------------------------------------------------------------ *
 * Image inlining (required for PNG export)
 * ------------------------------------------------------------------ */

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image data."));
    reader.readAsDataURL(blob);
  });
}

async function fetchAsDataUrl(url: string, timeoutMs = 8000): Promise<string | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      mode: "cors",
      credentials: "omit",
    });
    if (!response.ok) return null;
    return await blobToDataUrl(await response.blob());
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Replaces remote images with data URLs so the rasteriser can draw them without
 * hitting CORS restrictions. Returns the images that could not be inlined.
 */
export async function inlineRemoteImages(root: Element): Promise<string[]> {
  const failed: string[] = [];

  const nodes = Array.from(root.querySelectorAll("image, img"));
  await Promise.all(
    nodes.map(async (node) => {
      const isSvgImage = node.tagName.toLowerCase() === "image";
      const attr = isSvgImage ? "href" : "src";
      const href =
        node.getAttribute(attr) ?? node.getAttributeNS(XLINK_NS, "href") ?? "";
      if (!/^https?:/i.test(href)) return;

      const dataUrl = await fetchAsDataUrl(href);
      if (!dataUrl) {
        failed.push(href);
        return;
      }
      if (isSvgImage) {
        node.setAttribute("href", dataUrl);
        node.removeAttributeNS(XLINK_NS, "href");
      } else {
        node.setAttribute("src", dataUrl);
      }
    }),
  );

  return failed;
}

/* ------------------------------------------------------------------ *
 * Rasterisation
 * ------------------------------------------------------------------ */

export interface PngOptions extends SerializeOptions {
  /** Multiplier applied to the diagram size (1–4). */
  scale?: number;
}

export interface PngResult {
  blob: Blob;
  width: number;
  height: number;
  warnings: string[];
}

async function loadImage(imageUrl: string): Promise<HTMLImageElement> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () =>
      reject(
        new Error(
          "The browser could not rasterise the diagram. Try exporting SVG instead.",
        ),
      );
    image.src = imageUrl;
  });
  return image;
}

/**
 * Encodes markup as a `data:` URL.
 *
 * Chromium taints a canvas when an SVG is drawn from a `blob:` URL (which
 * breaks `toBlob`/`getImageData`), while `data:` URLs stay origin-clean. That
 * single detail is what makes PNG export work at all.
 */
function svgToDataUrl(markup: string): string {
  const bytes = new TextEncoder().encode(markup);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

export async function renderPng(
  svg: SVGSVGElement,
  options: PngOptions = {},
): Promise<PngResult> {
  const scale = Math.min(Math.max(options.scale ?? 2, 1), 4);
  const warnings: string[] = [];

  const clone = svg.cloneNode(true) as SVGSVGElement;
  const failed = await inlineRemoteImages(clone);
  if (failed.length > 0) {
    warnings.push(
      `${failed.length} remote image${failed.length === 1 ? "" : "s"} could not be embedded and may be missing from the PNG.`,
    );
  }

  const { markup, width, height } = serializeSvg(clone, options);
  const image = await loadImage(svgToDataUrl(markup));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(Math.round(width * scale), 1);
  canvas.height = Math.max(Math.round(height * scale), 1);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable in this browser.");

  context.setTransform(scale, 0, 0, scale, 0, 0);
  if (options.background) {
    context.fillStyle = options.background;
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image, 0, 0, width, height);

  let blob: Blob | null;
  try {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
  } catch {
    throw new Error(
      "The browser blocked image export for this diagram (tainted canvas). Try exporting SVG instead.",
    );
  }
  if (!blob) throw new Error("PNG encoding failed.");

  return { blob, width: canvas.width, height: canvas.height, warnings };
}

/* ------------------------------------------------------------------ *
 * Delivery helpers
 * ------------------------------------------------------------------ */

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function svgBlob(markup: string): Blob {
  return new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
}

export function openSvgInNewTab(markup: string): void {
  const url = URL.createObjectURL(svgBlob(markup));
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  if (!ok) throw new Error("Clipboard access was blocked by the browser.");
}

export function canCopyImages(): boolean {
  return (
    typeof ClipboardItem !== "undefined" &&
    typeof navigator.clipboard?.write === "function" &&
    window.isSecureContext
  );
}

export async function copyPngToClipboard(blob: Blob): Promise<void> {
  if (!canCopyImages()) {
    throw new Error(
      "This browser cannot copy images. Use the download button instead.",
    );
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

/** `diagram-title-2026-01-31.svg` style file names. */
export function buildFilename(name: string, extension: string, scale?: number): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "diagram";
  const suffix = scale && scale > 1 ? `@${scale}x` : "";
  return `${base}${suffix}.${extension}`;
}
