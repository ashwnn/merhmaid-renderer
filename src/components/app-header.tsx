import {
  KeyboardIcon,
  LinkIcon,
  MonitorIcon,
  MoonIcon,
  Settings2Icon,
  SunIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SettingsSheet } from "@/components/settings-sheet";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { useApp } from "@/app/provider";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const THEME_ORDER = ["light", "dark", "system"] as const;

export function AppHeader() {
  const { theme, setTheme } = useTheme();
  const { shareLink, diagram } = useApp();

  const nextTheme =
    THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
  const ThemeIcon =
    theme === "light" ? SunIcon : theme === "dark" ? MoonIcon : MonitorIcon;

  return (
    <header className="flex flex-wrap items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <a
        href="./"
        className="flex items-center gap-2.5 rounded-md px-1 py-0.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-sm">
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
            <path
              fill="currentColor"
              d="M4 5.5A1.5 1.5 0 0 1 5.5 4h4A1.5 1.5 0 0 1 11 5.5v2A1.5 1.5 0 0 1 9.5 9H8v2.5h5.5V9H13a1.5 1.5 0 0 1-1.5-1.5v-2A1.5 1.5 0 0 1 13 4h4a1.5 1.5 0 0 1 1.5 1.5v2A1.5 1.5 0 0 1 17 9h-.5v3.5a1 1 0 0 1-1 1H8V17h.5a1.5 1.5 0 0 1 1.5 1.5v0A1.5 1.5 0 0 1 8.5 20h-3A1.5 1.5 0 0 1 4 18.5v0A1.5 1.5 0 0 1 5.5 17H6v-8.5H5.5A1.5 1.5 0 0 1 4 7.5v-2Z"
            />
          </svg>
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">
            Merhmaid Renderer
          </span>
          <span className="text-[11px] text-muted-foreground">
            Mermaid diagrams with Markdown labels
          </span>
        </span>
      </a>

      <div className="ml-auto flex items-center gap-1">
        <span className="mr-1 hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground md:flex">
          <span
            className={cn(
              "size-1.5 rounded-full",
              diagram.status === "error"
                ? "bg-destructive"
                : diagram.status === "rendering"
                  ? "bg-amber-500"
                  : "bg-emerald-500",
            )}
          />
          {diagram.status === "error"
            ? "Syntax error"
            : diagram.status === "rendering"
              ? "Rendering…"
              : "Ready"}
        </span>

        <ShortcutsDialog>
          <Button variant="ghost" size="icon-sm" aria-label="Keyboard shortcuts">
            <KeyboardIcon />
          </Button>
        </ShortcutsDialog>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void shareLink()}
              aria-label="Copy share link"
            >
              <LinkIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy a link that contains this diagram</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setTheme(nextTheme)}
              aria-label={`Switch to ${nextTheme} theme`}
            >
              <ThemeIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Theme: {theme} — click to change</TooltipContent>
        </Tooltip>

        <a
          href="https://github.com/ashwnn/merhmaid-renderer"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="Open the GitHub repository"
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.99 7.99 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
        </a>

        <div aria-hidden="true" className="mx-1 h-6 w-px bg-border" />

        <SettingsSheet>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Settings2Icon />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </SettingsSheet>
      </div>
    </header>
  );
}
