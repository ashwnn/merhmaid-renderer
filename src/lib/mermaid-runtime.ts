/**
 * Loads and configures Mermaid.
 *
 * Mermaid is bundled with the app (no CDN, no network round-trip) and is only
 * fetched when the first render happens, so the initial page load stays small.
 */

import type { MermaidConfig } from "mermaid";

type MermaidApi = typeof import("mermaid").default;

export type MermaidThemeName = "default" | "neutral" | "dark" | "forest" | "base";
export type DiagramLook = "classic" | "handDrawn";
export type FlowDirection = "LR" | "RL" | "TB" | "BT";
export type CurveStyle =
  | "basis"
  | "linear"
  | "cardinal"
  | "monotoneX"
  | "stepBefore"
  | "stepAfter";

const THEME_TONES: Record<MermaidThemeName, "light" | "dark"> = {
  default: "light",
  neutral: "light",
  forest: "light",
  dark: "dark",
  base: "light",
};

export function themeTone(theme: MermaidThemeName): "light" | "dark" {
  return THEME_TONES[theme];
}

let mermaidPromise: Promise<MermaidApi> | null = null;

export function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid")
      .then((module) => {
        const api = module.default;
        // `startOnLoad` must be off: we render explicitly, one diagram at a time.
        api.initialize({ startOnLoad: false, suppressErrorRendering: true });
        return api;
      })
      .catch((error: unknown) => {
        mermaidPromise = null;
        throw error;
      });
  }
  return mermaidPromise;
}

export interface MermaidOptions {
  theme: MermaidThemeName;
  look: DiagramLook;
  fontFamily: string;
  curve: CurveStyle;
  flowchartPadding: number;
  /**
   * Maximum label width Mermaid wraps HTML labels at. Must be at least as wide
   * as the widest Markdown label, otherwise Mermaid's own label wrapper
   * (`max-width: wrappingWidth`) would clip it.
   */
  wrappingWidth: number;
  maxTextSize: number;
}

export function buildMermaidConfig(options: MermaidOptions): MermaidConfig {
  return {
    startOnLoad: false,
    suppressErrorRendering: true,
    securityLevel: "antiscript",
    logLevel: "fatal",
    theme: options.theme,
    look: options.look,
    fontFamily: options.fontFamily,
    // Top-level `htmlLabels` is the non-deprecated spelling in Mermaid 11.12+.
    htmlLabels: true,
    themeVariables: { fontFamily: options.fontFamily },
    flowchart: {
      useMaxWidth: true,
      curve: options.curve,
      padding: options.flowchartPadding,
      nodeSpacing: 45,
      rankSpacing: 55,
      diagramPadding: 12,
      wrappingWidth: options.wrappingWidth,
    },
    sequence: { useMaxWidth: true, wrap: true },
    gantt: { useMaxWidth: true },
    class: { useMaxWidth: true },
    state: { useMaxWidth: true },
    er: { useMaxWidth: true },
    maxTextSize: options.maxTextSize,
    maxEdges: 1000,
  };
}

/* ------------------------------------------------------------------ *
 * Direction override
 * ------------------------------------------------------------------ */

const DIRECTION_RE =
  /^(\s*(?:graph|flowchart)\s+)(TB|TD|BT|LR|RL)(\s*)$/i;

/**
 * Rewrites the direction of the *first* `graph`/`flowchart` declaration.
 * Returns the source untouched for any other diagram type.
 */
export function applyDirectionOverride(
  source: string,
  direction: FlowDirection,
): string {
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*%%/.test(line)) continue;
    const match = DIRECTION_RE.exec(line);
    if (!match) continue;
    lines[i] = `${match[1]}${direction}${match[3]}`;
    break;
  }
  return lines.join("\n");
}

export function detectDiagramType(source: string): string | null {
  const match = /^\s*([A-Za-z][\w-]*)/.exec(stripLeadingComments(source));
  return match ? match[1].toLowerCase() : null;
}

function stripLeadingComments(source: string): string {
  return source
    .split("\n")
    .filter((line) => !/^\s*%%/.test(line))
    .join("\n");
}

/* ------------------------------------------------------------------ *
 * Error normalisation
 * ------------------------------------------------------------------ */

export interface NormalizedError {
  message: string;
  line?: number;
  hint?: string;
}

const ANSI_RE = /\u001B\[[0-9;]*m/g;

export function normalizeMermaidError(error: unknown): NormalizedError {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : ((error as { str?: string })?.str ?? "Unknown rendering error");

  let message = raw.replace(ANSI_RE, "").trim();

  // Mermaid prefixes its own errors with a banner we do not need to repeat.
  message = message.replace(/^Error:\s*/i, "");

  let line: number | undefined;
  const lineMatch = /(?:Parse error on line|on line|line)\s*[:\s]\s*(\d+)/i.exec(
    message,
  );
  if (lineMatch) line = Number.parseInt(lineMatch[1], 10);

  const hint = /this is usually a bug|mermaid version|got 'EOF'/i.test(message)
    ? "Check for a missing bracket, quote or comma near the reported line."
    : undefined;

  return { message, line, hint };
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

let renderCounter = 0;

export interface RawRenderResult {
  svg: string;
  id: string;
}

/** Renders Mermaid source to an SVG string, cleaning up Mermaid's temp nodes. */
export async function renderMermaidSvg(
  source: string,
  options: MermaidOptions,
): Promise<RawRenderResult> {
  const mermaid = await loadMermaid();
  mermaid.initialize(buildMermaidConfig(options));

  renderCounter += 1;
  const id = `mm-${renderCounter}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { svg } = await mermaid.render(id, source);
    return { svg, id };
  } finally {
    // Mermaid leaves `#d<id>` behind when a render throws.
    document.getElementById(`d${id}`)?.remove();
    document.getElementById(id)?.remove();
  }
}
