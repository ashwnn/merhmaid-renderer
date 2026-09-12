import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import {
  DiagramError,
  renderDiagram,
  type RenderResult,
  type RenderSettings,
} from "@/lib/render-diagram";
import {
  detectDiagramType,
  normalizeMermaidError,
  type MermaidThemeName,
} from "@/lib/mermaid-runtime";
import {
  buildFilename,
  copyPngToClipboard,
  copyText,
  downloadBlob,
  openSvgInNewTab,
  renderPng,
  serializeSvg,
  svgBlob,
} from "@/lib/export";
import {
  backgroundColour,
  DEFAULT_SETTINGS,
  normalizeSettings,
  type Settings,
} from "@/lib/settings";
import {
  clearShareHash,
  decodeShareLink,
  encodeShareLink,
  readSettings,
  readStorage,
  STORAGE_KEYS,
  writeStorage,
} from "@/lib/persist";
import { DEFAULT_SOURCE } from "@/lib/examples";
import { useTheme } from "@/components/theme-provider";

export type RenderStatus = "idle" | "rendering" | "ready" | "error";

interface DiagramState {
  status: RenderStatus;
  result: RenderResult | null;
  error: DiagramError | null;
  /** True when the source has changed since the last successful render. */
  stale: boolean;
  labelCount: number;
  diagramType: string | null;
}

export interface EditorApi {
  focusLine: (line: number) => void;
}

interface AppContextValue {
  source: string;
  setSource: (value: string) => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
  resolvedTheme: MermaidThemeName;
  diagram: DiagramState;
  renderNow: () => void;
  busyAction: string | null;
  exportSvg: () => void;
  exportPng: () => Promise<void>;
  copySvg: () => Promise<void>;
  copyPng: () => Promise<void>;
  copySource: () => Promise<void>;
  downloadSource: () => void;
  openInNewTab: () => void;
  shareLink: () => Promise<void>;
  registerEditor: (api: EditorApi | null) => void;
  focusLine: (line: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function readInitialSource(): string {
  const shared = decodeShareLink(window.location.hash);
  if (shared) return shared.source;
  return readStorage(STORAGE_KEYS.source) ?? DEFAULT_SOURCE;
}

function readInitialSettings(): Settings {
  const stored = readSettings() ?? { ...DEFAULT_SETTINGS };
  const shared = decodeShareLink(window.location.hash);
  return shared ? normalizeSettings({ ...stored, ...shared.settings }) : stored;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme: appTheme } = useTheme();

  const sharedRef = useRef(decodeShareLink(window.location.hash));
  const [source, setSourceState] = useState(readInitialSource);
  const [settings, setSettings] = useState(readInitialSettings);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [diagram, setDiagram] = useState<DiagramState>({
    status: "idle",
    result: null,
    error: null,
    stale: true,
    labelCount: 0,
    diagramType: null,
  });

  const editorApiRef = useRef<EditorApi | null>(null);
  const runIdRef = useRef(0);
  const sourceRef = useRef(source);
  sourceRef.current = source;

  const resolvedTheme: MermaidThemeName = useMemo(() => {
    if (settings.theme !== "auto") return settings.theme;
    return appTheme === "dark" ? "dark" : "default";
  }, [settings.theme, appTheme]);

  const renderSettings: RenderSettings = useMemo(
    () => ({
      mermaidTheme: resolvedTheme,
      look: settings.look,
      direction: settings.direction,
      curve: settings.curve,
      markdownLabels: settings.markdownLabels,
      subgraphTitles: settings.markdownLabels && settings.subgraphTitles,
      labelMaxWidth: settings.labelMaxWidth,
      labelFontSize: settings.labelFontSize,
      fontFamily: settings.fontFamily,
    }),
    [resolvedTheme, settings],
  );

  const renderSettingsRef = useRef(renderSettings);
  renderSettingsRef.current = renderSettings;

  /* ------------------------------ rendering ------------------------------ */

  const runRender = useCallback(async () => {
    const text = sourceRef.current.trim();
    const runId = (runIdRef.current += 1);

    if (!text) {
      setDiagram((previous) => ({
        ...previous,
        status: "idle",
        error: null,
        stale: true,
        labelCount: 0,
        diagramType: null,
      }));
      return;
    }

    setDiagram((previous) => ({ ...previous, status: "rendering", error: null }));

    try {
      const result = await renderDiagram(text, renderSettingsRef.current);
      if (runId !== runIdRef.current) return;
      setDiagram({
        status: "ready",
        result,
        error: null,
        stale: false,
        labelCount: result.labelCount,
        diagramType: detectDiagramType(text),
      });
    } catch (error) {
      if (runId !== runIdRef.current) return;
      const detail =
        error instanceof DiagramError
          ? error
          : new DiagramError(normalizeMermaidError(error));
      setDiagram((previous) => ({
        ...previous,
        status: "error",
        error: detail,
        stale: true,
      }));
    }
  }, []);

  // Keep the "out of date" badge honest.
  useEffect(() => {
    setDiagram((previous) =>
      previous.stale ? previous : { ...previous, stale: true },
    );
  }, [source]);

  // Auto render, debounced.
  useEffect(() => {
    if (!settings.autoRender) return;
    const timer = window.setTimeout(() => void runRender(), 400);
    return () => window.clearTimeout(timer);
  }, [
    source,
    settings.autoRender,
    settings.markdownLabels,
    settings.subgraphTitles,
    settings.labelMaxWidth,
    settings.labelFontSize,
    settings.fontFamily,
    settings.curve,
    settings.direction,
    settings.look,
    resolvedTheme,
    runRender,
  ]);

  const renderNow = useCallback(() => {
    void runRender();
  }, [runRender]);

  /* ------------------------------ persistence ------------------------------ */

  useEffect(() => {
    const timer = window.setTimeout(
      () => writeStorage(STORAGE_KEYS.source, source),
      500,
    );
    return () => window.clearTimeout(timer);
  }, [source]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [settings]);

  /* ------------------------------ actions ------------------------------ */

  const setSource = useCallback((value: string) => {
    setSourceState(value);
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((previous) => normalizeSettings({ ...previous, ...patch }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS, fileName: "merhmaid-diagram" });
    toast.success("Settings restored to defaults");
  }, []);

  const registerEditor = useCallback((api: EditorApi | null) => {
    editorApiRef.current = api;
  }, []);

  const focusLine = useCallback((line: number) => {
    editorApiRef.current?.focusLine(line);
  }, []);

  const currentSvg = () => diagram.result?.svg ?? null;

  const backgroundFor = useCallback(
    (): string | null =>
      backgroundColour(settings.previewBackground, resolvedTheme),
    [settings.previewBackground, resolvedTheme],
  );

  const exportSvg = useCallback(() => {
    const svg = currentSvg();
    if (!svg) {
      toast.error("Nothing to export yet — render a diagram first.");
      return;
    }
    const { markup } = serializeSvg(svg, {
      background: backgroundFor(),
      padding: 16,
    });
    downloadBlob(buildFilename(settings.fileName, "svg"), svgBlob(markup));
    toast.success("SVG downloaded");
  }, [diagram.result, settings.fileName, backgroundFor]);

  const exportPng = useCallback(async () => {
    const svg = currentSvg();
    if (!svg) {
      toast.error("Nothing to export yet — render a diagram first.");
      return;
    }
    setBusyAction("png");
    const pending = toast.loading("Rendering PNG…");
    try {
      const { blob, width, height, warnings } = await renderPng(svg, {
        scale: settings.pngScale,
        background: backgroundFor(),
        padding: 16,
      });
      downloadBlob(
        buildFilename(settings.fileName, "png", settings.pngScale),
        blob,
      );
      toast.success(`PNG downloaded — ${width}×${height}px`, { id: pending });
      for (const warning of warnings) toast.warning(warning);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "PNG export failed.",
        { id: pending },
      );
    } finally {
      setBusyAction(null);
    }
  }, [diagram.result, settings.pngScale, settings.fileName, backgroundFor]);

  const copySvg = useCallback(async () => {
    const svg = currentSvg();
    if (!svg) {
      toast.error("Nothing to copy yet.");
      return;
    }
    try {
      const { markup } = serializeSvg(svg, {
        background: backgroundFor(),
        padding: 16,
      });
      await copyText(markup);
      toast.success("SVG markup copied to the clipboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Copy failed.");
    }
  }, [diagram.result, backgroundFor]);

  const copyPng = useCallback(async () => {
    const svg = currentSvg();
    if (!svg) {
      toast.error("Nothing to copy yet.");
      return;
    }
    setBusyAction("copy-png");
    try {
      const { blob } = await renderPng(svg, {
        scale: settings.pngScale,
        background: backgroundFor(),
        padding: 16,
      });
      await copyPngToClipboard(blob);
      toast.success("Diagram image copied to the clipboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Copy failed.");
    } finally {
      setBusyAction(null);
    }
  }, [diagram.result, settings.pngScale, backgroundFor]);

  const copySource = useCallback(async () => {
    try {
      await copyText(source);
      toast.success("Diagram source copied");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Copy failed.");
    }
  }, [source]);

  const downloadSource = useCallback(() => {
    downloadBlob(
      buildFilename(settings.fileName, "mmd"),
      new Blob([source], { type: "text/plain;charset=utf-8" }),
    );
  }, [settings.fileName, source]);

  const openInNewTab = useCallback(() => {
    const svg = currentSvg();
    if (!svg) {
      toast.error("Nothing to open yet.");
      return;
    }
    const { markup } = serializeSvg(svg, {
      background: backgroundFor(),
      padding: 16,
    });
    openSvgInNewTab(markup);
  }, [diagram.result, backgroundFor]);

  const shareLink = useCallback(async () => {
    const url = encodeShareLink(source, settings);
    window.history.replaceState(null, "", url);
    try {
      await copyText(url);
      toast.success("Share link copied", {
        description:
          "The diagram is encoded in the URL — no server involved.",
      });
    } catch {
      toast.info("Share link is now in the address bar");
    }
  }, [source, settings]);

  // Show the "shared diagram loaded" notice once.
  useEffect(() => {
    if (!sharedRef.current) return;
    clearShareHash();
    sharedRef.current = null;
    toast.info("Loaded a shared diagram from the link");
  }, []);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      const key = event.key.toLowerCase();

      if (key === "enter") {
        event.preventDefault();
        void runRender();
        return;
      }
      if (key === "s") {
        event.preventDefault();
        if (event.shiftKey) void exportPng();
        else exportSvg();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runRender, exportSvg, exportPng]);

  const value: AppContextValue = {
    source,
    setSource,
    settings,
    updateSettings,
    resetSettings,
    resolvedTheme,
    diagram,
    renderNow,
    busyAction,
    exportSvg,
    exportPng,
    copySvg,
    copyPng,
    copySource,
    downloadSource,
    openInNewTab,
    shareLink,
    registerEditor,
    focusLine,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside <AppProvider>");
  return context;
}
