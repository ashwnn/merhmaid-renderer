import { describe, expect, it } from "vitest";

import { applyDirectionOverride, normalizeMermaidError } from "@/lib/mermaid-runtime";
import { DEFAULT_SETTINGS, normalizeSettings } from "@/lib/settings";

describe("applyDirectionOverride", () => {
  it("rewrites the direction of a graph declaration", () => {
    expect(applyDirectionOverride("graph LR\n A --> B", "TB")).toBe(
      "graph TB\n A --> B",
    );
    expect(applyDirectionOverride("flowchart TD\n A --> B", "RL")).toBe(
      "flowchart RL\n A --> B",
    );
  });

  it("skips comments and only changes the first declaration", () => {
    const source = "%% keep me\nflowchart LR\nA --> B\nflowchart TB";
    expect(applyDirectionOverride(source, "BT")).toBe(
      "%% keep me\nflowchart BT\nA --> B\nflowchart TB",
    );
  });

  it("leaves other diagram types untouched", () => {
    const source = "sequenceDiagram\n  A->>B: hi";
    expect(applyDirectionOverride(source, "LR")).toBe(source);
  });
});

describe("normalizeMermaidError", () => {
  it("extracts the failing line and strips the error prefix", () => {
    const detail = normalizeMermaidError(
      new Error("Error: Parse error on line 3:\nA[ --> B\n------^\nExpecting 'SQE'"),
    );
    expect(detail.line).toBe(3);
    expect(detail.message.startsWith("Parse error on line 3")).toBe(true);
  });

  it("falls back to a readable message", () => {
    expect(normalizeMermaidError(undefined).message).toBe(
      "Unknown rendering error",
    );
    expect(normalizeMermaidError("boom").message).toBe("boom");
  });
});

describe("normalizeSettings", () => {
  it("returns defaults for junk input", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings("nope")).toEqual(DEFAULT_SETTINGS);
    // Unknown enum values fall back, out-of-range numbers are clamped.
    expect(normalizeSettings({ theme: "neon" })).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ pngScale: 99 }).pngScale).toBe(4);
  });

  it("keeps valid overrides and clamps numbers", () => {
    const settings = normalizeSettings({
      theme: "dark",
      labelMaxWidth: 10_000,
      labelFontSize: 0,
      pngScale: 3,
      markdownLabels: false,
      fileName: "my diagram",
    });
    expect(settings.theme).toBe("dark");
    expect(settings.labelMaxWidth).toBe(1200);
    expect(settings.labelFontSize).toBe(9);
    expect(settings.pngScale).toBe(3);
    expect(settings.markdownLabels).toBe(false);
    expect(settings.fileName).toBe("my diagram");
    // Untouched keys keep their defaults.
    expect(settings.autoRender).toBe(DEFAULT_SETTINGS.autoRender);
  });
});
