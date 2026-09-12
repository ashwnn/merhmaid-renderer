import { useState, type ReactNode } from "react";
import { ArrowRightIcon, FileCode2Icon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EXAMPLES, type Example } from "@/lib/examples";
import { useApp } from "@/app/provider";
import { cn } from "@/lib/utils";

export function ExamplesDialog({ children }: { children?: ReactNode }) {
  const { setSource, source } = useApp();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Example>(EXAMPLES[0]);

  const apply = (example: Example) => {
    if (example.source.trim() === source.trim()) {
      setOpen(false);
      return;
    }
    const previous = source;
    setSource(example.source);
    setOpen(false);
    toast.success(`Loaded “${example.title}”`, {
      description: "Your previous diagram can be restored from this toast.",
      action: { label: "Undo", onClick: () => setSource(previous) },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl lg:max-w-5xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-primary" />
            Examples
          </DialogTitle>
          <DialogDescription>
            Start from a working diagram, then edit the source on the left.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[70vh] grid-cols-1 md:grid-cols-[280px_1fr]">
          <ScrollArea className="border-b md:border-b-0 md:border-r">
            <div className="flex flex-col gap-1 p-3">
              {EXAMPLES.map((example) => {
                const isSelected = example.id === selected.id;
                const isActive = example.source.trim() === source.trim();
                return (
                  <button
                    key={example.id}
                    type="button"
                    onClick={() => setSelected(example)}
                    onDoubleClick={() => apply(example)}
                    className={cn(
                      "rounded-md px-3 py-2 text-left transition-colors",
                      isSelected
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/60",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {example.title}
                      {isActive && (
                        <Badge
                          variant="outline"
                          className="h-4 px-1 text-[10px] font-normal text-primary"
                        >
                          current
                        </Badge>
                      )}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                      {example.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          <div className="flex min-h-0 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
              {selected.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="font-normal">
                  {tag}
                </Badge>
              ))}
              <Button
                size="sm"
                className="ml-auto gap-1.5"
                onClick={() => apply(selected)}
              >
                Use this example
                <ArrowRightIcon />
              </Button>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <pre className="thin-scrollbar overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-muted-foreground">
                {selected.source}
              </pre>
            </ScrollArea>

            <div className="flex items-center gap-2 border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
              <FileCode2Icon className="size-3.5" />
              Double-click an example in the list to load it instantly.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
