import { AlertTriangleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";

import { useApp } from "@/app/provider";
import { cn } from "@/lib/utils";

function Divider({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("h-3 w-px shrink-0 bg-border", className)}
    />
  );
}

export function StatusBar({
  cursor,
}: {
  cursor: { line: number; column: number };
}) {
  const { diagram, settings, resolvedTheme } = useApp();

  const status = (() => {
    switch (diagram.status) {
      case "rendering":
        return {
          icon: Loader2Icon,
          text: "Rendering…",
          className: "text-amber-600 dark:text-amber-400",
          spin: true,
        };
      case "error":
        return {
          icon: AlertTriangleIcon,
          text: diagram.error?.detail.line
            ? `Syntax error on line ${diagram.error.detail.line}`
            : "Syntax error",
          className: "text-destructive",
          spin: false,
        };
      case "ready":
        return {
          icon: CheckCircle2Icon,
          text: "Rendered",
          className: "text-emerald-600 dark:text-emerald-400",
          spin: false,
        };
      default:
        return {
          icon: AlertTriangleIcon,
          text: "Waiting for diagram source",
          className: "text-muted-foreground",
          spin: false,
        };
    }
  })();

  const StatusIcon = status.icon;

  return (
    <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t bg-background/95 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
      <span
        data-testid="render-status"
        className={cn("flex items-center gap-1.5 font-medium", status.className)}
        role="status"
        aria-live="polite"
      >
        <StatusIcon className={cn("size-3.5", status.spin && "animate-spin")} />
        {status.text}
      </span>

      {diagram.result && (
        <>
          <Divider />
          <span className="font-mono">
            {Math.round(diagram.result.width)} × {Math.round(diagram.result.height)} px
          </span>
          <Divider />
          <span>{diagram.labelCount} Markdown label(s)</span>
          <Divider />
          <span>{diagram.result.durationMs.toFixed(0)} ms</span>
        </>
      )}

      <div className="ml-auto flex items-center gap-x-3">
        <span className="hidden sm:inline">
          Theme: <span className="text-foreground">{resolvedTheme}</span>
        </span>
        <Divider className="hidden sm:block" />
        <span className="font-mono">
          Ln {cursor.line}, Col {cursor.column}
        </span>
        <Divider />
        <span className="hidden md:inline">
          {settings.autoRender ? "Live preview on" : "Manual render"}
        </span>
      </div>
    </footer>
  );
}
