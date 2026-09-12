import type { ReactNode } from "react";
import { KeyboardIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Ctrl", "Enter"], label: "Render the diagram" },
  { keys: ["Ctrl", "S"], label: "Download the diagram as SVG" },
  { keys: ["Ctrl", "Shift", "S"], label: "Download the diagram as PNG" },
  { keys: ["Ctrl", "scroll"], label: "Zoom the preview" },
  { keys: ["Double click"], label: "Toggle fit / 100% zoom in the preview" },
  { keys: ["Tab"], label: "Indent in the editor" },
  { keys: ["Enter"], label: "Keep the current indentation" },
];

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

export function ShortcutsDialog({ children }: { children?: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyboardIcon className="size-4 text-primary" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            On macOS use <Kbd>⌘</Kbd> instead of <Kbd>Ctrl</Kbd>.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <ul className="flex flex-col gap-2.5">
          {SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.label}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span className="text-muted-foreground">{shortcut.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {shortcut.keys.map((key, index) => (
                  <span key={key} className="flex items-center gap-1">
                    {index > 0 && (
                      <span className="text-[10px] text-muted-foreground">+</span>
                    )}
                    <Kbd>{key}</Kbd>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
