import { DEFAULT_APPEARANCE } from "@/lib/label";
import type {
  CurveStyle,
  DiagramLook,
  FlowDirection,
  MermaidThemeName,
} from "@/lib/mermaid-runtime";

export type ThemeChoice = MermaidThemeName | "auto";
export type PreviewBackground =
  | "auto"
  | "white"
  | "dark"
  | "checkerboard"
  | "none";

export interface Settings {
  /** `auto` follows the app's light/dark mode. */
  theme: ThemeChoice;
  look: DiagramLook;
  direction: FlowDirection | "auto";
  curve: CurveStyle;
  markdownLabels: boolean;
  /** Markdown inside `subgraph "Title"` labels. */
  subgraphTitles: boolean;
  labelMaxWidth: number;
  labelFontSize: number;
  fontFamily: string;
  autoRender: boolean;
  pngScale: number;
  /** Canvas backdrop, which is also the background of exported files. */
  previewBackground: PreviewBackground;
  fileName: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "auto",
  look: "classic",
  direction: "auto",
  curve: "basis",
  markdownLabels: true,
  subgraphTitles: true,
  labelMaxWidth: DEFAULT_APPEARANCE.maxWidth,
  labelFontSize: DEFAULT_APPEARANCE.fontSize,
  fontFamily: DEFAULT_APPEARANCE.fontFamily,
  autoRender: true,
  pngScale: 2,
  previewBackground: "auto",
  fileName: "merhmaid-diagram",
};

export const MERMAID_THEME_OPTIONS: {
  value: ThemeChoice;
  label: string;
  swatch: string;
}[] = [
  { value: "auto", label: "Match app theme", swatch: "linear-gradient(135deg,#e5e7eb 50%,#1e293b 50%)" },
  { value: "default", label: "Default", swatch: "linear-gradient(135deg,#ececff 50%,#9370db 50%)" },
  { value: "neutral", label: "Neutral", swatch: "linear-gradient(135deg,#f4f4f5 50%,#a1a1aa 50%)" },
  { value: "dark", label: "Dark", swatch: "linear-gradient(135deg,#334155 50%,#0f172a 50%)" },
  { value: "forest", label: "Forest", swatch: "linear-gradient(135deg,#e8f5e9 50%,#2e7d32 50%)" },
  { value: "base", label: "Base", swatch: "linear-gradient(135deg,#fafafa 50%,#71717a 50%)" },
];

export const FONT_OPTIONS = [
  {
    value:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif",
    label: "System sans",
  },
  {
    value: "Inter, ui-sans-serif, system-ui, Segoe UI, Roboto, sans-serif",
    label: "Inter",
  },
  {
    value: "Georgia, Cambria, Times New Roman, Times, serif",
    label: "Serif",
  },
  {
    value: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    label: "Monospace",
  },
  {
    value: "Verdana, Geneva, Tahoma, sans-serif",
    label: "Verdana",
  },
];

export const CURVE_OPTIONS: { value: CurveStyle; label: string }[] = [
  { value: "basis", label: "Curved" },
  { value: "linear", label: "Straight" },
  { value: "cardinal", label: "Cardinal" },
  { value: "monotoneX", label: "Monotone" },
  { value: "stepBefore", label: "Step (before)" },
  { value: "stepAfter", label: "Step (after)" },
];

export const DIRECTION_OPTIONS: {
  value: FlowDirection | "auto";
  label: string;
  short: string;
}[] = [
  { value: "auto", label: "From diagram source", short: "Auto" },
  { value: "TB", label: "Top to bottom", short: "TB" },
  { value: "BT", label: "Bottom to top", short: "BT" },
  { value: "LR", label: "Left to right", short: "LR" },
  { value: "RL", label: "Right to left", short: "RL" },
];

export const PNG_SCALE_OPTIONS = [1, 2, 3, 4];

export const PREVIEW_BACKGROUND_OPTIONS: {
  value: PreviewBackground;
  label: string;
  short: string;
  description: string;
}[] = [
  {
    value: "auto",
    label: "Match diagram theme",
    short: "Auto",
    description: "White for light themes, dark for the dark theme.",
  },
  { value: "white", label: "White", short: "Light", description: "Solid white background." },
  { value: "dark", label: "Dark slate", short: "Dark", description: "Solid dark background." },
  {
    value: "checkerboard",
    label: "Transparent (grid)",
    short: "Transparent",
    description: "Exports have no background colour.",
  },
  {
    value: "none",
    label: "Transparent (plain)",
    short: "None",
    description: "Exports have no background colour.",
  },
];

/**
 * Turns the background preference into the colour actually drawn behind the
 * diagram — `null` means "leave it transparent".
 */
export function resolveBackground(
  preference: PreviewBackground,
  theme: MermaidThemeName,
): "white" | "dark" | null {
  switch (preference) {
    case "auto":
      return theme === "dark" ? "dark" : "white";
    case "white":
      return "white";
    case "dark":
      return "dark";
    default:
      return null;
  }
}

export function backgroundColour(preference: PreviewBackground, theme: MermaidThemeName): string | null {
  const resolved = resolveBackground(preference, theme);
  if (resolved === "white") return "#ffffff";
  if (resolved === "dark") return "#0f172a";
  return null;
}

/** Merges stored/partial settings with the defaults, ignoring bad values. */
export function normalizeSettings(input: unknown): Settings {
  if (!input || typeof input !== "object") return { ...DEFAULT_SETTINGS };
  const raw = input as Record<string, unknown>;
  const result: Settings = { ...DEFAULT_SETTINGS };

  const boolKeys: (keyof Settings)[] = [
    "markdownLabels",
    "subgraphTitles",
    "autoRender",
  ];
  for (const key of boolKeys) {
    const value = raw[key];
    if (typeof value === "boolean") {
      (result[key] as boolean) = value;
    }
  }

  const number = (value: unknown, min: number, max: number, fallback: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.min(Math.max(value, min), max)
      : fallback;

  result.labelMaxWidth = number(raw.labelMaxWidth, 160, 1200, DEFAULT_SETTINGS.labelMaxWidth);
  result.labelFontSize = number(raw.labelFontSize, 9, 32, DEFAULT_SETTINGS.labelFontSize);
  result.pngScale = number(raw.pngScale, 1, 4, DEFAULT_SETTINGS.pngScale);

  const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    typeof value === "string" && (allowed as readonly string[]).includes(value)
      ? (value as T)
      : fallback;

  result.theme = oneOf(
    raw.theme,
    ["auto", "default", "neutral", "dark", "forest", "base"] as const,
    DEFAULT_SETTINGS.theme,
  );
  result.look = oneOf(raw.look, ["classic", "handDrawn"] as const, DEFAULT_SETTINGS.look);
  result.direction = oneOf(
    raw.direction,
    ["auto", "LR", "RL", "TB", "BT"] as const,
    DEFAULT_SETTINGS.direction,
  );
  result.curve = oneOf(
    raw.curve,
    ["basis", "linear", "cardinal", "monotoneX", "stepBefore", "stepAfter"] as const,
    DEFAULT_SETTINGS.curve,
  );
  result.previewBackground = oneOf(
    raw.previewBackground,
    ["auto", "white", "dark", "checkerboard", "none"] as const,
    DEFAULT_SETTINGS.previewBackground,
  );

  if (typeof raw.fontFamily === "string" && raw.fontFamily.trim()) {
    result.fontFamily = raw.fontFamily;
  }
  if (typeof raw.fileName === "string") {
    result.fileName = raw.fileName.slice(0, 60);
  }

  return result;
}
