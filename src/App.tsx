import { useEffect, useState } from "react";
import { PanelLeftIcon, PanelRightIcon } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { DiagramCanvas } from "@/components/diagram-canvas";
import { EditorPanel } from "@/components/editor-panel";
import { ExportMenu } from "@/components/export-menu";
import { StatusBar } from "@/components/status-bar";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/app/provider";
import { ThemeProvider } from "@/components/theme-provider";
import { LABEL_CSS } from "@/lib/label";

/** Injects the shared label stylesheet so preview and export always agree. */
function LabelStyles() {
  return <style data-mehrmaid-labels>{LABEL_CSS}</style>;
}

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const listener = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);
  return isDesktop;
}

function Workspace() {
  const { settings } = useApp();
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const isDesktop = useIsDesktop();

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppHeader />

      <main className="flex min-h-0 flex-1 flex-col">
        {isDesktop ? (
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
            <ResizablePanel
              defaultSize="42"
              minSize="24"
              maxSize="70"
              className="min-h-0 min-w-0"
            >
              {/* h-full: Panel content is not a flex container */}
              <EditorPanel cursor={cursor} onCursorChange={setCursor} />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="58" minSize="28" className="min-h-0">
              <div className="flex h-full min-h-0 flex-col">
                <DiagramCanvas toolbarEnd={<ExportMenu />} />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <Tabs defaultValue="source" className="flex min-h-0 flex-1 flex-col gap-0">
            <div className="border-b px-3 py-2">
              <TabsList className="w-full">
                <TabsTrigger value="source" className="flex-1 gap-1.5">
                  <PanelLeftIcon className="size-3.5" />
                  Source
                </TabsTrigger>
                <TabsTrigger value="preview" className="flex-1 gap-1.5">
                  <PanelRightIcon className="size-3.5" />
                  Preview
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent
              value="source"
              className="m-0 flex min-h-0 flex-1 flex-col"
            >
              <EditorPanel cursor={cursor} onCursorChange={setCursor} />
            </TabsContent>
            <TabsContent
              value="preview"
              className="m-0 flex min-h-0 flex-1 flex-col"
            >
              <DiagramCanvas toolbarEnd={<ExportMenu />} />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <StatusBar cursor={cursor} />
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        visibleToasts={3}
        duration={3200}
        toastOptions={{ duration: 3200 }}
      />
      <span className="sr-only" aria-live="polite">
        {settings.autoRender ? "Live preview enabled" : "Live preview disabled"}
      </span>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={300}>
        <AppProvider>
          <LabelStyles />
          <Workspace />
        </AppProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
