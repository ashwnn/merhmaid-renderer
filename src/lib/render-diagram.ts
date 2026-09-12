/**
 * The end-to-end render pipeline: source text in, live SVG element out.
 */

import {
  applyDirectionOverride,
  normalizeMermaidError,
  renderMermaidSvg,
  themeTone,
  type CurveStyle,
  type DiagramLook,
  type FlowDirection,
  type MermaidThemeName,
  type NormalizedError,
} from "@/lib/mermaid-runtime";
import {
  buildPlaceholderSource,
  extractLabels,
  mapProcessedLineToSource,
  type LabelToken,
} from "@/lib/mehrmaid";
import {
  LABEL_CLASS,
  prepareLabel,
  type LabelAppearance,
  type PreparedLabel,
} from "@/lib/label";

export interface RenderSettings {
  mermaidTheme: MermaidThemeName;
  look: DiagramLook;
  direction: FlowDirection | "auto";
  curve: CurveStyle;
  markdownLabels: boolean;
  subgraphTitles: boolean;
  labelMaxWidth: number;
  labelFontSize: number;
  fontFamily: string;
}

export interface RenderResult {
  svg: SVGSVGElement;
  /** Final XML source of the rendered diagram (labels included). */
  processedSource: string;
  labelCount: number;
  width: number;
  height: number;
  durationMs: number;
}

export class DiagramError extends Error {
  readonly detail: NormalizedError;

  constructor(detail: NormalizedError) {
    super(detail.message);
    this.name = "DiagramError";
    this.detail = detail;
  }
}

function labelAppearance(settings: RenderSettings): LabelAppearance {
  return {
    maxWidth: settings.labelMaxWidth,
    fontSize: settings.labelFontSize,
    fontFamily: settings.fontFamily,
    tone: themeTone(settings.mermaidTheme),
  };
}

/**
 * Parses Mermaid's SVG markup into a live `<svg>` element.
 *
 * The markup is parsed as *HTML*, not XML, for two reasons:
 *  1. Elements inside `<foreignObject>` are HTML integration points, so the
 *     parser yields a real SVG element while labels stay ordinary HTML.
 *  2. Markdown output is HTML, not XML (`<br>`, `<hr>`, `<img>`), and setting
 *     `innerHTML` on a node inside an XML document rejects it outright.
 */
function svgFromString(markup: string): SVGSVGElement {
  const parsed = new DOMParser().parseFromString(markup, "text/html");
  const svg = parsed.body.querySelector("svg");
  if (!svg) throw new Error("Rendered diagram is not valid SVG.");
  return svg;
}

/** Measures every Markdown label and returns sized placeholder markup. */
async function prepareLabels(
  source: string,
  settings: RenderSettings,
  tokens: LabelToken[],
): Promise<{ source: string; labels: PreparedLabel[] }> {
  const appearance = labelAppearance(settings);

  const labels = await Promise.all(
    tokens.map((token, index) =>
      prepareLabel(
        token.markdown,
        `${LABEL_CLASS} mehrmaid-label-${index}`,
        appearance,
      ),
    ),
  );

  return {
    source: buildPlaceholderSource(source, tokens, labels),
    labels,
  };
}

export async function renderDiagram(
  rawSource: string,
  settings: RenderSettings,
): Promise<RenderResult> {
  const startedAt = performance.now();

  const source =
    settings.direction === "auto"
      ? rawSource
      : applyDirectionOverride(rawSource, settings.direction);

  const tokens =
    settings.markdownLabels || settings.subgraphTitles
      ? extractLabels(source, {
          subgraphTitles: settings.markdownLabels && settings.subgraphTitles,
        })
      : [];

  const { source: mermaidSource, labels } = await prepareLabels(
    source,
    settings,
    tokens,
  );

  let markup: string;
  try {
    const result = await renderMermaidSvg(mermaidSource, {
      theme: settings.mermaidTheme,
      look: settings.look,
      fontFamily: settings.fontFamily,
      curve: settings.curve,
      flowchartPadding: 6,
      // Keep Mermaid's label wrapper wider than the widest Markdown label.
      wrappingWidth: Math.max(settings.labelMaxWidth, 200) + 32,
      maxTextSize: 500_000,
    });
    markup = result.svg;
  } catch (error) {
    const detail = normalizeMermaidError(error);
    // Multi-line labels collapse to one line, so translate the reported line
    // back to the text the user actually sees in the editor.
    if (detail.line !== undefined && tokens.length > 0) {
      detail.line = mapProcessedLineToSource(source, tokens, detail.line);
    }
    throw new DiagramError(detail);
  }

  const svg = svgFromString(markup);

  // Drop the sanitised Markdown into the placeholders Mermaid just rendered.
  let labelCount = 0;
  labels.forEach((label, index) => {
    const host = svg.querySelector(`.mehrmaid-label-${index}`);
    if (!host) return;
    host.innerHTML = label.html;
    labelCount += 1;
  });

  // If none of the placeholders survived, something fundamental changed in the
  // Mermaid HTML-label pipeline; report it instead of showing empty nodes.
  if (labels.length > 0 && labelCount === 0) {
    throw new DiagramError({
      message:
        "Mermaid rendered the diagram but dropped the Markdown labels. Turn off “Markdown labels” to render the source verbatim.",
      hint: "This usually means the diagram type does not support HTML labels.",
    });
  }

  // Links inside a diagram should never navigate away from the editor.
  for (const anchor of svg.querySelectorAll("a")) {
    if (anchor.getAttribute("href")) {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
    }
  }

  const viewBox = svg.getAttribute("viewBox");
  const parts = viewBox?.split(/[\s,]+/).map(Number) ?? [];
  const width = parts.length === 4 && parts[2] > 0 ? parts[2] : 800;
  const height = parts.length === 4 && parts[3] > 0 ? parts[3] : 600;

  svg.removeAttribute("style");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  return {
    svg,
    processedSource: mermaidSource,
    labelCount,
    width,
    height,
    durationMs: performance.now() - startedAt,
  };
}
