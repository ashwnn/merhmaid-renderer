/**
 * Renders, sanitises and measures Markdown labels.
 *
 * How a label survives the Mermaid pipeline (verified against Mermaid 11.12):
 *
 *   markdown HTML -> sanitizeText (DOMPurify) -> markdownToHTML (marked lexer,
 *   HTML passes through) -> sanitizeText again -> span.innerHTML
 *
 * Mermaid's own HTML label wrapper is `display: table-cell; white-space: nowrap`
 * with `max-width: flowchart.wrappingWidth`, so the placeholder we inject is an
 * `inline-block` element with an explicit pixel size. That keeps the measured
 * size and the rendered size identical.
 *
 * Layout-critical styles live inline on the placeholder; typography lives in
 * {@link LABEL_CSS}, which is shared by the live preview and embedded into
 * exported SVG files so an export looks exactly like the preview.
 */

import DOMPurify from "dompurify";
import { marked } from "marked";

export const LABEL_CLASS = "mehrmaid-label";

export interface LabelAppearance {
  /** Hard cap for the label width, in CSS pixels. */
  maxWidth: number;
  fontSize: number;
  fontFamily: string;
  /** `light` = dark text on a light node, `dark` = light text on a dark node. */
  tone: "light" | "dark";
}

export const DEFAULT_APPEARANCE: LabelAppearance = {
  maxWidth: 420,
  fontSize: 14,
  fontFamily:
    "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif",
  tone: "light",
};

const TONES = {
  light: {
    fg: "#0f172a",
    muted: "rgba(15, 23, 42, 0.06)",
    mutedStrong: "rgba(15, 23, 42, 0.12)",
    border: "rgba(15, 23, 42, 0.22)",
    link: "#1d4ed8",
  },
  dark: {
    fg: "#e8ecf5",
    muted: "rgba(232, 236, 245, 0.10)",
    mutedStrong: "rgba(232, 236, 245, 0.18)",
    border: "rgba(232, 236, 245, 0.28)",
    link: "#96b8ff",
  },
} as const;

export function toneVariables(tone: LabelAppearance["tone"]): string {
  const t = TONES[tone];
  return [
    `--mm-fg:${t.fg}`,
    `--mm-muted:${t.muted}`,
    `--mm-muted-strong:${t.mutedStrong}`,
    `--mm-border:${t.border}`,
    `--mm-link:${t.link}`,
  ].join(";");
}

/**
 * Styles that decide how large a label is. `size` optionally pins the exact
 * measured size (used for the placeholder Mermaid measures and renders).
 */
export function containerStyle(
  appearance: LabelAppearance,
  size?: { width: number; height: number },
): string {
  // Font stacks are embedded in a single-quoted HTML attribute inside a
  // double-quoted Mermaid label, so quotes are never allowed here.
  const fontFamily = appearance.fontFamily.replace(/["']/g, "").trim();
  const styles = [
    "display:inline-block",
    size ? `width:${Math.max(Math.ceil(size.width), 1)}px` : "width:max-content",
    `max-width:${Math.round(appearance.maxWidth)}px`,
    size ? `height:${Math.max(Math.ceil(size.height), 1)}px` : "",
    "padding:2px",
    "box-sizing:border-box",
    `font-family:${fontFamily}`,
    `font-size:${appearance.fontSize}px`,
    "line-height:1.45",
    "font-weight:400",
    "font-style:normal",
    "letter-spacing:normal",
    "text-align:left",
    "text-transform:none",
    "white-space:normal",
    "word-break:normal",
    "overflow-wrap:anywhere",
    "color:var(--mm-fg)",
    "vertical-align:top",
    toneVariables(appearance.tone),
  ];
  return styles.filter(Boolean).join(";");
}

/**
 * Typography for rendered Markdown, scoped to the label container. Browser and
 * Tailwind defaults are re-declared explicitly for every element it touches so
 * measurements taken inside the app match the standalone SVG one-to-one.
 */
export const LABEL_CSS = `
.${LABEL_CLASS}, .${LABEL_CLASS} * { box-sizing: border-box; }
.${LABEL_CLASS} { margin: 0; }
.${LABEL_CLASS} p { margin: 0 0 0.5em; }
.${LABEL_CLASS} p:last-child { margin-bottom: 0; }
.${LABEL_CLASS} h1, .${LABEL_CLASS} h2, .${LABEL_CLASS} h3,
.${LABEL_CLASS} h4, .${LABEL_CLASS} h5, .${LABEL_CLASS} h6 {
  margin: 0.35em 0 0.3em; font-weight: 600; line-height: 1.3;
}
.${LABEL_CLASS} > :first-child { margin-top: 0; }
.${LABEL_CLASS} h1 { font-size: 1.55em; }
.${LABEL_CLASS} h2 { font-size: 1.3em; }
.${LABEL_CLASS} h3 { font-size: 1.15em; }
.${LABEL_CLASS} h4, .${LABEL_CLASS} h5, .${LABEL_CLASS} h6 { font-size: 1em; }
.${LABEL_CLASS} strong, .${LABEL_CLASS} b { font-weight: 600; }
.${LABEL_CLASS} em, .${LABEL_CLASS} i { font-style: italic; }
.${LABEL_CLASS} del { text-decoration: line-through; }
.${LABEL_CLASS} a { color: var(--mm-link); text-decoration: underline; }
.${LABEL_CLASS} ul, .${LABEL_CLASS} ol { margin: 0.25em 0; padding-left: 1.4em; }
.${LABEL_CLASS} ul { list-style: disc outside; }
.${LABEL_CLASS} ol { list-style: decimal outside; }
.${LABEL_CLASS} ul ul { list-style-type: circle; }
.${LABEL_CLASS} ul ul ul { list-style-type: square; }
.${LABEL_CLASS} li { margin: 0.12em 0; }
.${LABEL_CLASS} li > p { margin: 0; }
.${LABEL_CLASS} code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.88em; padding: 0.12em 0.34em; border-radius: 0.3em;
  background: var(--mm-muted); border: 1px solid var(--mm-muted);
}
.${LABEL_CLASS} pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85em; margin: 0.35em 0; padding: 0.5em 0.6em;
  border-radius: 0.4em; background: var(--mm-muted);
  border: 1px solid var(--mm-border); overflow-x: auto;
  white-space: pre; text-align: left;
}
.${LABEL_CLASS} pre code { background: none; border: 0; padding: 0; font-size: 1em; }
.${LABEL_CLASS} blockquote {
  margin: 0.4em 0; padding: 0 0 0 0.6em;
  border-left: 3px solid var(--mm-border); opacity: 0.9;
}
.${LABEL_CLASS} hr { border: 0; border-top: 1px solid var(--mm-border); margin: 0.5em 0; }
.${LABEL_CLASS} table { border-collapse: collapse; margin: 0.35em 0; font-size: 0.95em; }
.${LABEL_CLASS} th, .${LABEL_CLASS} td {
  border: 1px solid var(--mm-border); padding: 0.2em 0.45em;
  text-align: left; vertical-align: top;
}
.${LABEL_CLASS} thead th { background: var(--mm-muted-strong); font-weight: 600; }
.${LABEL_CLASS} tbody tr:nth-child(even) td { background: var(--mm-muted); }
.${LABEL_CLASS} img { display: block; max-width: 100%; height: auto; margin: 0.25em 0; }
.${LABEL_CLASS} input[type="checkbox"] { margin: 0 0.35em 0 0; vertical-align: middle; }
.${LABEL_CLASS} kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85em; padding: 0.1em 0.35em; border-radius: 0.3em;
  border: 1px solid var(--mm-border); background: var(--mm-muted);
}
.${LABEL_CLASS} sub, .${LABEL_CLASS} sup { font-size: 0.75em; }
`.trim();

export function renderMarkdownToHtml(markdown: string): string {
  const raw = marked.parse(markdown, { async: false, gfm: true, breaks: true });
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel"],
    FORBID_TAGS: ["style", "script", "iframe", "form", "object", "embed"],
  });
}

export interface PreparedLabel {
  /** Unique class used to find the placeholder after Mermaid renders. */
  className: string;
  /** Sanitised Markdown HTML. */
  html: string;
  width: number;
  height: number;
  /** Style attribute applied to the placeholder element. */
  style: string;
}

/* ------------------------------------------------------------------ *
 * Measurement
 * ------------------------------------------------------------------ */

let measureHost: HTMLElement | null = null;

/** Off-screen host used to measure labels without flashing them on screen. */
function getMeasureHost(): HTMLElement {
  if (measureHost?.isConnected) return measureHost;

  const host = document.createElement("div");
  host.id = "mehrmaid-measure";
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, {
    position: "fixed",
    top: "0px",
    left: "-100000px",
    width: "max-content",
    maxWidth: "none",
    visibility: "hidden",
    pointerEvents: "none",
    zIndex: "-1",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(host);
  measureHost = host;
  return host;
}

/**
 * Waits briefly for images so they are measured at their real size instead of
 * collapsing to zero height. Images that never load are not fatal.
 */
async function waitForImages(
  element: HTMLElement,
  timeoutMs = 2500,
): Promise<void> {
  const pending = Array.from(element.querySelectorAll("img")).filter(
    (img) => !img.complete,
  );
  if (pending.length === 0) return;

  await new Promise<void>((resolve) => {
    let remaining = pending.length;
    const timer = window.setTimeout(resolve, timeoutMs);
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearTimeout(timer);
        resolve();
      }
    };
    for (const img of pending) {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    }
  });
}

/**
 * Renders, sanitises and measures a Markdown label in one pass.
 */
export async function prepareLabel(
  markdown: string,
  className: string,
  appearance: LabelAppearance = DEFAULT_APPEARANCE,
): Promise<PreparedLabel> {
  const html = renderMarkdownToHtml(markdown);

  const probe = document.createElement("div");
  probe.className = LABEL_CLASS;
  probe.setAttribute("style", containerStyle(appearance));
  probe.innerHTML = html;

  const host = getMeasureHost();
  host.appendChild(probe);
  try {
    await waitForImages(probe);
    const rect = probe.getBoundingClientRect();
    const width = Math.max(Math.ceil(rect.width), 4);
    const height = Math.max(Math.ceil(rect.height), 4);
    return {
      className,
      html,
      width,
      height,
      style: containerStyle(appearance, { width, height }),
    };
  } finally {
    probe.remove();
  }
}
