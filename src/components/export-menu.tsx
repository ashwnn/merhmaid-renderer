import {
  CheckIcon,
  ChevronDownIcon,
  ClipboardCopyIcon,
  ClipboardIcon,
  Code2Icon,
  DownloadIcon,
  ExternalLinkIcon,
  FileCodeIcon,
  FileImageIcon,
  ImageIcon,
  LinkIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp } from "@/app/provider";

export function ExportMenu() {
  const {
    diagram,
    settings,
    exportSvg,
    exportPng,
    copySvg,
    copyPng,
    copySource,
    downloadSource,
    openInNewTab,
    shareLink,
    busyAction,
  } = useApp();

  const disabled = !diagram.result;
  const busy = busyAction !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" disabled={disabled || busy} className="gap-1.5">
          <DownloadIcon />
          Export
          <ChevronDownIcon className="size-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Download</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => exportSvg()}>
          <ImageIcon />
          SVG image
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            .svg
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void exportPng()}>
          <FileImageIcon />
          PNG image
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {settings.pngScale}× · .png
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => downloadSource()}>
          <FileCodeIcon />
          Mermaid source
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            .mmd
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Copy to clipboard</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void copyPng()}>
          <ClipboardIcon />
          Image (PNG)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copySvg()}>
          <ClipboardCopyIcon />
          SVG markup
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copySource()}>
          <Code2Icon />
          Diagram source
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void shareLink()}>
          <LinkIcon />
          Copy share link
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openInNewTab()}>
          <ExternalLinkIcon />
          Open SVG in a new tab
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-[11px] text-muted-foreground">
          <CheckIcon className="opacity-60" />
          Exports are pixel-identical to the preview
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
