import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangleIcon,
  DownloadIcon,
  Loader2Icon,
  Maximize2Icon,
  Minimize2Icon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  ScanIcon,
  SparklesIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useApp } from "@/app/provider";
import { PREVIEW_BACKGROUND_OPTIONS, resolveBackground } from "@/lib/settings";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 6;
const STAGE_PADDING = 32;

type Zoom = number | "fit";

interface DiagramCanvasProps {
  /** Extra controls rendered at the right of the canvas toolbar. */
  toolbarEnd?: ReactNode;
}

const BACKGROUND_CLASS = {
  white: "bg-white",
  dark: "bg-slate-900",
  checkerboard: "bg-checkerboard",
  none: "bg-transparent",
} as const;

export function DiagramCanvas({ toolbarEnd }: DiagramCanvasProps) {
  const { diagram, settings, updateSettings, renderNow, resolvedTheme } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState<Zoom>("fit");
  const [fitScale, setFitScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const svg = diagram.result?.svg ?? null;
  const naturalWidth = diagram.result?.width ?? 800;
  const naturalHeight = diagram.result?.height ?? 600;
  const scale = zoom === "fit" ? fitScale : zoom;

  /* ------------------------------ fit to view ------------------------------ */

  const recomputeFit = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const availableWidth = container.clientWidth - STAGE_PADDING * 2;
    const availableHeight = container.clientHeight - STAGE_PADDING * 2;
    if (availableWidth <= 0 || availableHeight <= 0) return;
    const next = Math.min(
      availableWidth / naturalWidth,
      availableHeight / naturalHeight,
    );
    setFitScale(Math.min(Math.max(next, MIN_ZOOM), MAX_ZOOM));
  }, [naturalWidth, naturalHeight]);

  useLayoutEffect(() => {
    recomputeFit();
    const container = scrollRef.current;
    if (!container) return;
    const observer = new ResizeObserver(recomputeFit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [recomputeFit]);

  /* -------------------------------- rendering -------------------------------- */

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!svg) {
      host.replaceChildren();
      return;
    }
    svg.style.display = "block";
    svg.style.maxWidth = "none";
    svg.style.width = `${naturalWidth * scale}px`;
    svg.style.height = `${naturalHeight * scale}px`;
    host.replaceChildren(svg);
  }, [svg, scale, naturalWidth, naturalHeight]);

  /* ---------------------------------- zoom ---------------------------------- */

  const applyZoom = useCallback(
    (next: Zoom, anchor?: { x: number; y: number }) => {
      const container = scrollRef.current;
      setZoom(next);

      if (!container) return;
      const target = next === "fit" ? fitScale : next;
      const ratio = target / scale;
      if (!Number.isFinite(ratio) || ratio === 1) return;

      const point = anchor ?? {
        x: container.clientWidth / 2,
        y: container.clientHeight / 2,
      };
      const contentX = container.scrollLeft + point.x;
      const contentY = container.scrollTop + point.y;
      requestAnimationFrame(() => {
        container.scrollLeft = contentX * ratio - point.x;
        container.scrollTop = contentY * ratio - point.y;
      });
    },
    [fitScale, scale],
  );

  const zoomBy = useCallback(
    (factor: number, anchor?: { x: number; y: number }) => {
      const next = Math.min(Math.max(scale * factor, MIN_ZOOM), MAX_ZOOM);
      applyZoom(next, anchor);
    },
    [applyZoom, scale],
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const container = scrollRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const anchor = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12, anchor);
    },
    [zoomBy],
  );

  /* ---------------------------------- pan ---------------------------------- */

  const panState = useRef<{ x: number; y: number; left: number; top: number } | null>(
    null,
  );

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const container = scrollRef.current;
    if (!container) return;
    if ((event.target as HTMLElement).closest("a, button")) return;
    panState.current = {
      x: event.clientX,
      y: event.clientY,
      left: container.scrollLeft,
      top: container.scrollTop,
    };
    container.setPointerCapture(event.pointerId);
    container.dataset.panning = "true";
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const state = panState.current;
    const container = scrollRef.current;
    if (!state || !container) return;
    container.scrollLeft = state.left - (event.clientX - state.x);
    container.scrollTop = state.top - (event.clientY - state.y);
  }, []);

  const endPan = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const container = scrollRef.current;
    panState.current = null;
    if (container) {
      delete container.dataset.panning;
      if (container.hasPointerCapture(event.pointerId)) {
        container.releasePointerCapture(event.pointerId);
      }
    }
  }, []);

  /* ------------------------------- fullscreen ------------------------------- */

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void stage.requestFullscreen?.().catch(() => {
        /* Fullscreen can be blocked by the browser; ignore. */
      });
    }
  }, []);

  // `auto` follows the diagram theme, so a dark diagram never sits on white.
  const resolvedBackground =
    resolveBackground(settings.previewBackground, resolvedTheme) ??
    (settings.previewBackground === "checkerboard" ? "checkerboard" : "none");
  const backgroundClass = BACKGROUND_CLASS[resolvedBackground];
  const zoomPercent = Math.round(scale * 100);
  const isEmpty = !svg && diagram.status !== "rendering";

  return (
    <div
      ref={stageRef}
      className="relative flex min-h-0 flex-1 flex-col bg-muted/40"
    >
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-background/80 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-1.5">
          {diagram.diagramType && (
            <Badge variant="secondary" className="font-normal capitalize">
              {diagram.diagramType}
            </Badge>
          )}
          {diagram.result && (
            <Badge variant="outline" className="font-mono text-[11px] font-normal">
              {Math.round(diagram.result.width)} × {Math.round(diagram.result.height)}
            </Badge>
          )}
          {diagram.labelCount > 0 && (
            <Badge
              variant="outline"
              className="gap-1 border-primary/40 font-normal text-primary"
            >
              <SparklesIcon className="size-3" />
              {diagram.labelCount} Markdown label
              {diagram.labelCount === 1 ? "" : "s"}
            </Badge>
          )}
          {diagram.stale && diagram.status !== "rendering" && (
            <Badge variant="outline" className="font-normal text-amber-600 dark:text-amber-400">
              out of date
            </Badge>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => zoomBy(1 / 1.2)}
                aria-label="Zoom out"
              >
                <MinusIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom out</TooltipContent>
          </Tooltip>

          <button
            type="button"
            onClick={() => applyZoom("fit")}
            className="min-w-[52px] rounded-md px-1.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Reset zoom to fit"
          >
            {zoomPercent}%
          </button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => zoomBy(1.2)}
                aria-label="Zoom in"
              >
                <PlusIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom in</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={zoom === "fit" ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => applyZoom("fit")}
                aria-label="Fit to view"
              >
                <ScanIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit to view</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => applyZoom(1)}
                aria-label="Actual size"
              >
                <RotateCcwIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Actual size (100%)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2Icon /> : <Maximize2Icon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </TooltipContent>
          </Tooltip>

          <div className="mx-1 h-5 w-px bg-border" />
          {toolbarEnd}
        </div>
      </div>

      {/* stage */}
      <div
        ref={scrollRef}
        data-testid="preview-stage"
        onWheel={handleWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onDoubleClick={() => applyZoom(zoom === "fit" ? 1 : "fit")}
        className={cn(
          "thin-scrollbar relative min-h-0 flex-1 overflow-auto data-[panning=true]:cursor-grabbing",
          "cursor-grab",
          backgroundClass,
        )}
        style={{ overscrollBehavior: "contain" }}
      >
        <div
          className="flex min-h-full w-max min-w-full"
          style={{ padding: STAGE_PADDING }}
        >
          <div ref={hostRef} data-testid="preview-host" className="m-auto shrink-0" />
        </div>

        {diagram.status === "rendering" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40">
            <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs shadow-sm">
              <Loader2Icon className="size-3.5 animate-spin" />
              Rendering…
            </div>
          </div>
        )}

        {isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <div className="rounded-full border border-dashed p-3 text-muted-foreground">
              <DownloadIcon className="size-5" />
            </div>
            <p className="text-sm font-medium">Nothing rendered yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Paste Mermaid source on the left and press{" "}
              <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
                Ctrl
              </kbd>{" "}
              +{" "}
              <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
                Enter
              </kbd>
            </p>
          </div>
        )}
      </div>

      {/* error */}
      {diagram.status === "error" && diagram.error && (
        <ErrorBanner />
      )}

      {/* background picker */}
      <div className="flex flex-wrap items-center gap-2 border-t bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
        <span>Background</span>
        <div className="flex items-center gap-1">
          {PREVIEW_BACKGROUND_OPTIONS.filter((option) =>
            ["auto", "white", "dark", "checkerboard"].includes(option.value),
          ).map((option) => (
            <Button
              key={option.value}
              variant={
                settings.previewBackground === option.value ? "secondary" : "ghost"
              }
              size="xs"
              title={option.description}
              onClick={() =>
                updateSettings({ previewBackground: option.value })
              }
            >
              {option.short}
            </Button>
          ))}
        </div>
        <span className="ml-auto hidden items-center gap-1 sm:flex">
          Drag to pan · Ctrl + scroll to zoom · double-click to toggle fit
        </span>
        <Button variant="ghost" size="xs" onClick={renderNow} className="sm:hidden">
          Re-render
        </Button>
      </div>
    </div>
  );
}

function ErrorBanner() {
  const { diagram, focusLine } = useApp();
  const error = diagram.error;
  if (!error) return null;

  return (
    <div
      data-testid="error-banner"
      className="border-t border-destructive/30 bg-destructive/10 px-3 py-2"
    >
      <div className="flex items-start gap-2">
        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-destructive">
            {error.detail.line
              ? `Syntax error on line ${error.detail.line}`
              : "Could not render this diagram"}
          </p>
          <pre className="thin-scrollbar mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
            {error.detail.message}
          </pre>
          {error.detail.hint && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {error.detail.hint}
            </p>
          )}
        </div>
        {error.detail.line !== undefined && (
          <Button
            variant="outline"
            size="xs"
            onClick={() => focusLine(error.detail.line as number)}
          >
            Go to line
          </Button>
        )}
      </div>
    </div>
  );
}
