import { useState, type ReactNode } from "react";
import {
  CheckIcon,
  MonitorIcon,
  MoonIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  SunIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  CURVE_OPTIONS,
  FONT_OPTIONS,
  MERMAID_THEME_OPTIONS,
  PNG_SCALE_OPTIONS,
  PREVIEW_BACKGROUND_OPTIONS,
} from "@/lib/settings";
import { useApp } from "@/app/provider";
import { useTheme, type Theme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

function Row({
  label,
  description,
  children,
  htmlFor,
}: {
  label: string;
  description?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </Label>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

const THEME_ICONS: Record<Theme, typeof SunIcon> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
};

export function SettingsSheet({ children }: { children?: ReactNode }) {
  const { settings, updateSettings, resetSettings, resolvedTheme } = useApp();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            <SlidersHorizontalIcon className="size-4 text-primary" />
            Settings
          </SheetTitle>
          <SheetDescription>
            Everything is stored locally in your browser.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="divide-y px-5 pb-10">
            <section className="py-2">
              <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Appearance
              </h3>
              <Row label="App theme" description="Light, dark or follow your system.">
                <div className="flex rounded-md border p-0.5">
                  {(["light", "dark", "system"] as Theme[]).map((value) => {
                    const Icon = THEME_ICONS[value];
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTheme(value)}
                        aria-label={`${value} theme`}
                        aria-pressed={theme === value}
                        className={cn(
                          "rounded px-2 py-1 transition-colors",
                          theme === value
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                      </button>
                    );
                  })}
                </div>
              </Row>

              <Row
                label="Diagram theme"
                description="Colours used by Mermaid for the diagram itself."
              >
                <Select
                  value={settings.theme}
                  onValueChange={(value) =>
                    updateSettings({ theme: value as typeof settings.theme })
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MERMAID_THEME_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2">
                          <span
                            className="size-3.5 rounded-full border"
                            style={{ background: option.swatch }}
                          />
                          {option.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>

              <Row
                label="Diagram style"
                description="Hand-drawn adds a sketchy, whiteboard feel."
              >
                <div className="flex rounded-md border p-0.5">
                  {(["classic", "handDrawn"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateSettings({ look: value })}
                      className={cn(
                        "rounded px-2.5 py-1 text-xs capitalize transition-colors",
                        settings.look === value
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {value === "handDrawn" ? "Hand-drawn" : "Classic"}
                    </button>
                  ))}
                </div>
              </Row>

              <Row label="Connector style">
                <Select
                  value={settings.curve}
                  onValueChange={(value) =>
                    updateSettings({ curve: value as typeof settings.curve })
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURVE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>

              <Row label="Font">
                <Select
                  value={settings.fontFamily}
                  onValueChange={(value) => updateSettings({ fontFamily: value })}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((option) => (
                      <SelectItem key={option.label} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
            </section>

            <section className="py-2">
              <h3 className="mb-1 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Markdown labels
              </h3>
              <Row
                label="Render double-quoted labels as Markdown"
                htmlFor="settings-markdown"
                description="Applies to flowchart node labels. Other diagrams are never modified."
              >
                <Switch
                  id="settings-markdown"
                  checked={settings.markdownLabels}
                  onCheckedChange={(checked) =>
                    updateSettings({ markdownLabels: checked })
                  }
                />
              </Row>

              <Row
                label="Also convert subgraph titles"
                htmlFor="settings-subgraph"
                description={`subgraph "**Title**"`}
              >
                <Switch
                  id="settings-subgraph"
                  checked={settings.subgraphTitles}
                  disabled={!settings.markdownLabels}
                  onCheckedChange={(checked) =>
                    updateSettings({ subgraphTitles: checked })
                  }
                />
              </Row>

              <Row
                label="Maximum label width"
                description={`${settings.labelMaxWidth}px — wide labels wrap onto more lines.`}
              >
                <Slider
                  className="w-[200px]"
                  min={160}
                  max={1200}
                  step={10}
                  value={[settings.labelMaxWidth]}
                  onValueChange={([value]) =>
                    updateSettings({ labelMaxWidth: value })
                  }
                />
              </Row>

              <Row
                label="Label font size"
                description={`${settings.labelFontSize}px`}
              >
                <Slider
                  className="w-[200px]"
                  min={9}
                  max={32}
                  step={1}
                  value={[settings.labelFontSize]}
                  onValueChange={([value]) =>
                    updateSettings({ labelFontSize: value })
                  }
                />
              </Row>
            </section>

            <section className="py-2">
              <h3 className="mb-1 pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Rendering &amp; export
              </h3>
              <Row
                label="Live preview"
                htmlFor="settings-auto"
                description="Re-render automatically as you type (400 ms debounce)."
              >
                <Switch
                  id="settings-auto"
                  checked={settings.autoRender}
                  onCheckedChange={(checked) =>
                    updateSettings({ autoRender: checked })
                  }
                />
              </Row>

              <Row label="PNG resolution">
                <Select
                  value={String(settings.pngScale)}
                  onValueChange={(value) =>
                    updateSettings({ pngScale: Number(value) })
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PNG_SCALE_OPTIONS.map((scale) => (
                      <SelectItem key={scale} value={String(scale)}>
                        {scale}× {scale === 1 ? "(screen)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>

              <Row
                label="Background"
                description={
                  PREVIEW_BACKGROUND_OPTIONS.find(
                    (option) => option.value === settings.previewBackground,
                  )?.description
                }
              >
                <Select
                  value={settings.previewBackground}
                  onValueChange={(value) =>
                    updateSettings({
                      previewBackground: value as typeof settings.previewBackground,
                    })
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PREVIEW_BACKGROUND_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>

              <Row
                label="File name"
                description="Used for SVG, PNG and .mmd downloads."
              >
                <Input
                  className="w-[200px]"
                  value={settings.fileName}
                  onChange={(event) =>
                    updateSettings({ fileName: event.target.value })
                  }
                  placeholder="merhmaid-diagram"
                />
              </Row>

              <div className="flex items-center gap-2 pt-3">
                <p className="flex-1 text-xs text-muted-foreground">
                  Currently rendering with the{" "}
                  <span className="font-medium text-foreground">
                    {resolvedTheme}
                  </span>{" "}
                  Mermaid theme.
                </p>
                <Button variant="outline" size="sm" onClick={resetSettings}>
                  <RotateCcwIcon />
                  Reset
                </Button>
              </div>
            </section>
          </div>
        </ScrollArea>

        <Separator />
        <div className="flex items-center gap-2 px-5 py-3 text-xs text-muted-foreground">
          <CheckIcon className="size-3.5 text-primary" />
          No backend, no uploads — diagrams never leave your device.
        </div>
      </SheetContent>
    </Sheet>
  );
}
