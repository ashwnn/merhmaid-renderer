/**
 * Extracts Markdown-bearing labels from Mermaid source code.
 *
 * Only *node labels* and (optionally) *subgraph titles* are treated as
 * Markdown. Everything else — configuration blocks, `click` URLs, sequence
 * diagram messages, state descriptions, git commit messages and so on — is
 * left completely untouched, so non-flowchart diagrams keep rendering.
 *
 * This module is intentionally free of DOM access so it can be unit tested in
 * a plain Node environment.
 */

export type LabelKind = "node" | "subgraph";

export interface LabelToken {
  /** Index of the opening double quote in the original source. */
  start: number;
  /** Index just past the closing double quote. */
  end: number;
  /** Raw label text (Mermaid escapes removed). */
  markdown: string;
  /** 1-based line number of the opening quote. */
  line: number;
  kind: LabelKind;
}

export interface ExtractOptions {
  /** Also treat `subgraph "Title"` titles as Markdown. */
  subgraphTitles?: boolean;
}

/** Characters that may directly precede a quoted node label. */
const OPENING_DELIMITERS = new Set(["(", "[", "{", ">", "/", "\\"]);
/** Characters that may directly follow a quoted node label. */
const CLOSING_DELIMITERS = new Set([")", "]", "}", "/", "\\"]);
/** Characters that may appear in a node identifier. */
const ID_CHAR = /[\p{L}\p{N}_\-.]/u;

function isWhitespace(char: string | undefined): boolean {
  return char === undefined || /\s/.test(char);
}

function previousNonWhitespace(source: string, index: number): number {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (!/\s/.test(source[i])) return i;
  }
  return -1;
}

function nextNonWhitespace(source: string, index: number): number {
  for (let i = index; i < source.length; i += 1) {
    if (!/\s/.test(source[i])) return i;
  }
  return -1;
}

/** Finds the closing quote of a label, honouring backslash escapes. */
export function findClosingQuote(source: string, start: number): number {
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"' && !escaped) return i;
    escaped = char === "\\" && !escaped;
  }
  return -1;
}

/**
 * `…["label"]`, `…("label")`, `…{"label"}`, `…>"label"]`, `…[/"label"/]`, …
 * The quote must open a shape wrapper that is attached to an identifier.
 */
function isNodeLabelQuote(source: string, quoteIndex: number): boolean {
  let cursor = previousNonWhitespace(source, quoteIndex);
  if (cursor < 0 || !OPENING_DELIMITERS.has(source[cursor])) return false;

  while (cursor >= 0 && OPENING_DELIMITERS.has(source[cursor])) cursor -= 1;
  cursor = previousNonWhitespace(source, cursor + 1);

  return cursor >= 0 && ID_CHAR.test(source[cursor]);
}

/** `subgraph "Title"` (the id-less form). */
function isSubgraphTitleQuote(source: string, quoteIndex: number): boolean {
  const before = previousNonWhitespace(source, quoteIndex);
  if (before < 0 || !isWhitespace(source[quoteIndex - 1])) return false;

  let wordStart = before;
  while (wordStart >= 0 && /[A-Za-z]/.test(source[wordStart])) wordStart -= 1;
  return source.slice(wordStart + 1, before + 1).toLowerCase() === "subgraph";
}

function lineNumberAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source[i] === "\n") line += 1;
  }
  return line;
}

function unescapeLabel(text: string): string {
  return text.replace(/\\"/g, '"').replace(/\\n/g, "\n");
}

/**
 * Scans Mermaid source and returns every quoted label that should be rendered
 * as Markdown, in document order.
 */
export function extractLabels(
  source: string,
  options: ExtractOptions = {},
): LabelToken[] {
  const { subgraphTitles = false } = options;
  const tokens: LabelToken[] = [];

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    // Skip `%%` comments (this also skips `%%{init: …}%%` directives).
    if (char === "%" && source[index + 1] === "%") {
      const newline = source.indexOf("\n", index);
      if (newline === -1) break;
      index = newline;
      continue;
    }

    if (char !== '"') continue;

    const closing = findClosingQuote(source, index + 1);
    if (closing === -1) {
      // Unterminated quote: keep scanning the rest of the document instead of
      // giving up on the remainder.
      continue;
    }

    let kind: LabelKind | null = null;
    if (isNodeLabelQuote(source, index)) {
      const after = nextNonWhitespace(source, closing + 1);
      if (after >= 0 && CLOSING_DELIMITERS.has(source[after])) {
        kind = "node";
      }
    } else if (subgraphTitles && isSubgraphTitleQuote(source, index)) {
      // The title must be the last thing on its line.
      const lineEnd = source.indexOf("\n", closing + 1);
      const rest = source.slice(
        closing + 1,
        lineEnd === -1 ? undefined : lineEnd,
      );
      if (rest.trim() === "") kind = "subgraph";
    }

    if (!kind) continue;

    tokens.push({
      start: index,
      end: closing + 1,
      markdown: unescapeLabel(source.slice(index + 1, closing)),
      line: lineNumberAt(source, index),
      kind,
    });

    index = closing;
  }

  return tokens;
}

export interface PlaceholderSpec {
  /**
   * Class list for the placeholder element, e.g.
   * `mehrmaid-label mehrmaid-label-0`.
   */
  className: string;
  /**
   * Inline style for the placeholder. Must not contain single or double quotes:
   * the placeholder is embedded inside a double-quoted Mermaid label.
   */
  style: string;
}

/**
 * Rewrites the source, swapping every Markdown label for an empty placeholder
 * element that Mermaid measures and renders in place of the label.
 */
export function buildPlaceholderSource(
  source: string,
  tokens: readonly LabelToken[],
  placeholders: readonly PlaceholderSpec[],
): string {  if (tokens.length === 0) return source;

  let cursor = 0;
  let out = "";

  tokens.forEach((token, i) => {
    const placeholder = placeholders[i];
    if (!placeholder) return;

    // Single quotes for attributes: the placeholder sits inside a
    // double-quoted Mermaid label.
    const markup =
      `<span class='${placeholder.className}' ` +
      `style='${placeholder.style.replace(/['"]/g, "")}'></span>`;

    out += source.slice(cursor, token.start);
    out += `"${markup}"`;
    cursor = token.end;
  });

  out += source.slice(cursor);
  return out;
}

/**
 * Number of source lines a label occupies.
 */
export function tokenLineSpan(
  source: string,
  token: LabelToken,
): number {
  let lines = 1;
  for (let i = token.start; i < token.end; i += 1) {
    if (source[i] === "\n") lines += 1;
  }
  return lines;
}

/**
 * Maps a line number from the placeholder-substituted source back to the
 * original source.
 *
 * A Markdown label may span several lines but is replaced by a single-line
 * placeholder, so every collapsed label above the reported line shifts later
 * line numbers up. Without this, Mermaid's "parse error on line N" would point
 * at the wrong line in the editor.
 */
export function mapProcessedLineToSource(
  source: string,
  tokens: readonly LabelToken[],
  processedLine: number,
): number {
  let shift = 0;
  for (const token of tokens) {
    const placeholderLine = token.line - shift;
    if (processedLine <= placeholderLine) break;
    shift += tokenLineSpan(source, token) - 1;
  }
  return processedLine + shift;
}
