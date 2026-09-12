import { useCallback, useRef, useState } from "react";
import {
  EraserIcon,
  Loader2Icon,
  PlayIcon,
  RefreshCwIcon,
  SparklesIcon,
  WandSparklesIcon,
  WrapTextIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CodeEditor, type CodeEditorHandle } from "@/components/code-editor";
import { ExamplesDialog } from "@/components/examples-dialog";
import { useApp } from "@/app/provider";
import { DIRECTION_OPTIONS } from "@/lib/settings";

interface EditorPanelProps {
  cursor: { line: number; column: number };
  onCursorChange: (position: { line: number; column: number }) => void;
}

export function EditorPanel({ cursor, onCursorChange }: EditorPanelProps) {
  const {
    source,
    setSource,
    settings,
    updateSettings,
    diagram,
    renderNow,
    registerEditor,
  } = useApp();
  const [wordWrap, setWordWrap] = useState(true);
  const editorRef = useRef<CodeEditorHandle | null>(null);

  const handleRef = useCallback(
    (handle: CodeEditorHandle | null) => {
      editorRef.current = handle;
      registerEditor(handle);
    },
    [registerEditor],
  );

  const lineCount = source.split("\n").length;
  const charCount = source.length;
  const rendering = diagram.status === "rendering";

  return (
    <section
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2 p-3"
      aria-label="Diagram source editor"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={renderNow}
          disabled={rendering || !source.trim()}
          className="gap-1.5"
        >
          {rendering ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <PlayIcon />
          )}
          Render
          <kbd className="ml-1 hidden rounded border border-primary-foreground/30 px-1 font-mono text-[10px] opacity-80 sm:inline">
            ⌘⏎
          </kbd>
        </Button>

        <div className="flex items-center gap-2 rounded-md border px-2 py-1">
          <Switch
            id="auto-render"
            checked={settings.autoRender}
            onCheckedChange={(checked) => updateSettings({ autoRender: checked })}
          />
          <Label htmlFor="auto-render" className="text-xs text-muted-foreground">
            Live preview
          </Label>
          {settings.autoRender && (
            <RefreshCwIcon className="size-3 text-muted-foreground/70" />
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={wordWrap ? "secondary" : "ghost"}
                size="icon-sm"
                onClick={() => setWordWrap((value) => !value)}
                aria-label="Toggle word wrap"
                aria-pressed={wordWrap}
              >
                <WrapTextIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle word wrap</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSource("")}
                disabled={!source}
                aria-label="Clear editor"
              >
                <EraserIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear editor</TooltipContent>
          </Tooltip>

          <ExamplesDialog>
            <Button variant="outline" size="sm" className="gap-1.5">
              <WandSparklesIcon />
              Examples
            </Button>
          </ExamplesDialog>
        </div>
      </div>

      {/* Markdown-label context bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5">
        <div className="flex items-center gap-2">
          <Switch
            id="markdown-labels"
            checked={settings.markdownLabels}
            onCheckedChange={(checked) =>
              updateSettings({ markdownLabels: checked })
            }
          />
          <Label
            htmlFor="markdown-labels"
            className="flex items-center gap-1.5 text-xs"
          >
            <SparklesIcon className="size-3 text-primary" />
            Markdown labels
          </Label>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Direction
          </span>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={settings.direction}
            onValueChange={(value) => {
              if (!value) return;
              updateSettings({
                direction: value as typeof settings.direction,
              });
            }}
          >
            {DIRECTION_OPTIONS.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                className="px-2 font-mono text-[11px]"
                title={option.label}
              >
                {option.short}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <CodeEditor
        value={source}
        onChange={setSource}
        onCursorChange={onCursorChange}
        onRender={renderNow}
        wordWrap={wordWrap}
        ariaLabel="Mermaid diagram source"
        handleRef={handleRef}
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">
          Ln {cursor.line}, Col {cursor.column}
        </span>
        <span aria-hidden="true">·</span>
        <span className="font-mono">{lineCount} lines</span>
        <span aria-hidden="true">·</span>
        <span className="font-mono">{charCount} chars</span>
        {settings.markdownLabels && (
          <>
            <span aria-hidden="true">·</span>
            <Badge
              variant="outline"
              className="h-5 border-primary/40 text-[10px] font-normal text-primary"
            >
              double-quoted labels render as Markdown
            </Badge>
          </>
        )}
      </div>
    </section>
  );
}
