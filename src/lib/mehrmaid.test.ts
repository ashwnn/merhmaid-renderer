import { describe, expect, it } from "vitest";

import {
  buildPlaceholderSource,
  extractLabels,
  findClosingQuote,
  mapProcessedLineToSource,
} from "@/lib/mehrmaid";

const placeholder = (index: number) => ({
  className: `mehrmaid-label mehrmaid-label-${index}`,
  style: "display:inline-block;width:10px;height:10px",
});

describe("findClosingQuote", () => {
  it("respects escaped quotes", () => {
    const source = 'A["say \\"hi\\" now"]';
    const start = source.indexOf('"') + 1;
    expect(source[findClosingQuote(source, start)]).toBe('"');
    expect(findClosingQuote(source, start)).toBe(source.length - 2);
  });

  it("returns -1 when the quote is never closed", () => {
    expect(findClosingQuote('A["unterminated', 3)).toBe(-1);
  });
});

describe("extractLabels", () => {
  it("finds a simple node label", () => {
    const tokens = extractLabels('graph LR\nA("**bold**") --> B');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].markdown).toBe("**bold**");
    expect(tokens[0].kind).toBe("node");
    expect(tokens[0].line).toBe(2);
  });

  it("supports every node shape wrapper", () => {
    const source = [
      'graph LR',
      'A["square"]',
      'B("round")',
      'C{"diamond"}',
      'D>"asymmetric"]',
      'E[/"parallelogram"/]',
      'F[\\"trapezoid"\\]',
      'G(("circle"))',
      'H{{"hexagon"}}',
      'I[("cylinder")]',
    ].join("\n");
    const tokens = extractLabels(source);
    expect(tokens.map((token) => token.markdown)).toEqual([
      "square",
      "round",
      "diamond",
      "asymmetric",
      "parallelogram",
      "trapezoid",
      "circle",
      "hexagon",
      "cylinder",
    ]);
  });

  it("leaves configuration, edge labels and non-flowchart text alone", () => {
    const source = [
      '%%{init: {"theme":"dark"}}%%',
      "sequenceDiagram",
      '  participant A as "Alice"',
      '  A->>B: "quoted message"',
      'graph LR',
      '  A -->|"edge label"| B',
      '  click A "https://example.com"',
      '  state "Still" as s2',
    ].join("\n");
    expect(extractLabels(source)).toHaveLength(0);
  });

  it("does not treat a subgraph title as Markdown by default", () => {
    const source = 'flowchart TB\n  subgraph "**Group**"\n    A --> B\n  end';
    expect(extractLabels(source)).toHaveLength(0);
  });

  it("extracts subgraph titles when enabled", () => {
    const source = 'flowchart TB\n  subgraph "**Group**"\n    A --> B\n  end';
    const tokens = extractLabels(source, { subgraphTitles: true });
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe("subgraph");
    expect(tokens[0].markdown).toBe("**Group**");
  });

  it("handles multi-line labels and multiple nodes", () => {
    const source = 'graph LR\n  A("line one\n  line two") --> B("second")';
    const tokens = extractLabels(source);
    expect(tokens).toHaveLength(2);
    expect(tokens[0].markdown).toContain("line two");
    expect(tokens[0].line).toBe(2);
    expect(tokens[1].line).toBe(3);
  });

  it("survives an unterminated quote and keeps scanning", () => {
    const source = 'graph LR\n  A["oops\n  B["fine"]';
    const tokens = extractLabels(source);
    expect(tokens.map((token) => token.markdown)).toEqual(["fine"]);
  });
});

describe("buildPlaceholderSource", () => {
  it("replaces only the quoted label text", () => {
    const source = 'graph LR\nA("hello") --> B("world")';
    const tokens = extractLabels(source);
    const result = buildPlaceholderSource(source, tokens, [
      placeholder(0),
      placeholder(1),
    ]);
    expect(result).toContain("A(");
    expect(result).toContain("B(");
    expect(result).toContain("mehrmaid-label-0");
    expect(result).toContain("mehrmaid-label-1");
    expect(result).not.toContain("hello");
    expect(result).not.toContain("world");
    expect(result).toContain("-->");
  });

  it("returns the source untouched when there is nothing to replace", () => {
    const source = "graph LR\nA --> B";
    expect(buildPlaceholderSource(source, [], [])).toBe(source);
  });

  it("produces placeholders without quote characters", () => {
    const source = 'graph LR\nA("x")';
    const tokens = extractLabels(source);
    const result = buildPlaceholderSource(source, tokens, [
      { className: "mehrmaid-label-0", style: "font-family:Segoe UI" },
    ]);
    const inner = result.slice(result.indexOf("A(") + 2, result.lastIndexOf(")"));
    expect(inner.startsWith('"')).toBe(true);
    expect(inner.endsWith('"')).toBe(true);
    expect(inner.slice(1, -1)).not.toContain('"');
  });
});

describe("mapProcessedLineToSource", () => {
  const source = [
    'flowchart LR',
    '  A("line one',
    '  line two',
    '  line three") --> B',
    '  B[ --> C(',
  ].join("\n");

  it("keeps lines above a multi-line label unchanged", () => {
    const tokens = extractLabels(source);
    expect(mapProcessedLineToSource(source, tokens, 1)).toBe(1);
    expect(mapProcessedLineToSource(source, tokens, 2)).toBe(2);
  });

  it("maps lines after a collapsed label back to the real line", () => {
    const tokens = extractLabels(source);
    // The 3-line label becomes 1 line, so processed line 3 is source line 5.
    expect(mapProcessedLineToSource(source, tokens, 3)).toBe(5);
  });

  it("is a no-op when no labels were replaced", () => {
    expect(mapProcessedLineToSource(source, [], 4)).toBe(4);
  });
});
