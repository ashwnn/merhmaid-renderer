import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { cn } from "@/lib/utils";

const LINE_HEIGHT = 22;
const FONT_SIZE = 13.5;

const EDITOR_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

const SHARED_TEXT_STYLE: CSSProperties = {
  fontFamily: EDITOR_FONT,
  fontSize: `${FONT_SIZE}px`,
  lineHeight: `${LINE_HEIGHT}px`,
  whiteSpace: "pre-wrap",
  overflowWrap: "break-word",
  wordBreak: "break-word",
  tabSize: 4,
};

export interface CodeEditorHandle {
  focusLine: (line: number) => void;
  focus: () => void;
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onCursorChange?: (position: { line: number; column: number }) => void;
  onRender?: () => void;
  wordWrap: boolean;
  ariaLabel: string;
  handleRef?: (handle: CodeEditorHandle | null) => void;
}

/**
 * A textarea dressed as a code editor: line numbers, active-line highlight,
 * auto-indent and a gutter that stays in sync with wrapped lines.
 */
export function CodeEditor({
  value,
  onChange,
  onCursorChange,
  onRender,
  wordWrap,
  ariaLabel,
  handleRef,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState<number[]>(() => value.split("\n").map(() => 1));
  const [caretLine, setCaretLine] = useState(1);
  const [scrollTop, setScrollTop] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const lines = useMemo(() => value.split("\n"), [value]);

  /* --------------------------- wrapped-row math --------------------------- */

  const measureRows = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const width = textarea.clientWidth;
    if (!wordWrap) {
      setRows((previous) =>
        previous.every((row) => row === 1) && previous.length === lines.length
          ? previous
          : lines.map(() => 1),
      );
      return;
    }
    if (width <= 0) return;

    let mirror = mirrorRef.current;
    if (!mirror) {
      mirror = document.createElement("div");
      mirror.setAttribute("aria-hidden", "true");
      Object.assign(mirror.style, {
        position: "fixed",
        top: "0",
        left: "-100000px",
        visibility: "hidden",
        pointerEvents: "none",
        zIndex: "-1",
      } satisfies Partial<CSSStyleDeclaration>);
      document.body.appendChild(mirror);
      mirrorRef.current = mirror;
    }

    const style = window.getComputedStyle(textarea);
    Object.assign(mirror.style, {
      width: `${width}px`,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      whiteSpace: "pre-wrap",
      overflowWrap: "break-word",
      wordBreak: "break-word",
      padding: "0",
      border: "0",
      boxSizing: "content-box",
    });

    mirror.replaceChildren(
      ...lines.map((line) => {
        const row = document.createElement("div");
        row.textContent = line.length > 0 ? line : "\u200b";
        return row;
      }),
    );

    const lineHeight =
      Number.parseFloat(style.lineHeight) || LINE_HEIGHT;
    const next = Array.from(mirror.children, (child) => {
      const height = child.getBoundingClientRect().height;
      return Math.max(1, Math.round(height / lineHeight));
    });
    setRows((previous) =>
      previous.length === next.length &&
      previous.every((row, index) => row === next[index])
        ? previous
        : next,
    );
  }, [lines, wordWrap]);

  useLayoutEffect(() => {
    measureRows();
  }, [measureRows, contentWidth]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const observer = new ResizeObserver(() => {
      setContentWidth(textarea.clientWidth);
      measureRows();
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [measureRows]);

  useEffect(
    () => () => {
      mirrorRef.current?.remove();
      mirrorRef.current = null;
    },
    [],
  );

  /* ------------------------------ caret state ------------------------------ */

  const updateCaret = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const caret = textarea.selectionStart;
    const current = textarea.value;
    const before = current.slice(0, caret);
    const line = before.split("\n").length;
    const column = caret - (before.lastIndexOf("\n") + 1) + 1;
    setCaretLine(line);
    onCursorChange?.({ line, column });
  }, [onCursorChange]);

  // Keep the highlight aligned with the textarea's own scrolling.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const onScroll = () => setScrollTop(textarea.scrollTop);
    textarea.addEventListener("scroll", onScroll);
    return () => textarea.removeEventListener("scroll", onScroll);
  }, []);

  /* ------------------------------- editing ------------------------------- */

  const insertText = useCallback(
    (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      let inserted = false;
      try {
        inserted = document.execCommand("insertText", false, text);
      } catch {
        inserted = false;
      }
      if (!inserted) {
        const { selectionStart, selectionEnd } = textarea;
        const next =
          value.slice(0, selectionStart) + text + value.slice(selectionEnd);
        onChange(next);
        const caret = selectionStart + text.length;
        requestAnimationFrame(() => {
          textarea.selectionStart = caret;
          textarea.selectionEnd = caret;
        });
      }
      updateCaret();
    },
    [onChange, updateCaret, value],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = event.currentTarget;

      if (event.key === "Tab" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        insertText("  ");
        return;
      }

      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        const caret = textarea.selectionStart;
        const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
        const currentLine = value.slice(lineStart, caret);
        const indent = /^[ \t]*/.exec(currentLine)?.[0] ?? "";
        if (indent) {
          event.preventDefault();
          insertText(`\n${indent}`);
        }
        return;
      }

      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        onRender?.();
      }
    },
    [insertText, onRender, value],
  );

  /* -------------------------------- handle -------------------------------- */

  const handle = useMemo<CodeEditorHandle>(
    () => ({
      focusLine(line: number) {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const target = Math.min(Math.max(line, 1), lines.length);
        let index = 0;
        for (let i = 0; i < target - 1; i += 1) index += lines[i].length + 1;
        const end = index + lines[target - 1].length;

        textarea.focus();
        textarea.setSelectionRange(index, end);

        const rowsBefore = rows.slice(0, target - 1).reduce((sum, r) => sum + r, 0);
        textarea.scrollTop = Math.max(rowsBefore * LINE_HEIGHT - LINE_HEIGHT * 2, 0);
        setScrollTop(textarea.scrollTop);
        updateCaret();
      },
      focus: () => textareaRef.current?.focus(),
    }),
    [lines, rows, updateCaret],
  );

  useEffect(() => {
    handleRef?.(handle);
    return () => handleRef?.(null);
  }, [handle, handleRef]);

  const highlightTop =
    rows.slice(0, caretLine - 1).reduce((sum, row) => sum + row, 0) *
    LINE_HEIGHT;
  const highlightHeight = (rows[caretLine - 1] ?? 1) * LINE_HEIGHT;

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-md border bg-background">
      {/* gutter */}
      <div
        ref={gutterRef}
        aria-hidden="true"
        className="thin-scrollbar relative hidden shrink-0 select-none overflow-hidden border-r bg-muted/40 py-3 text-right sm:block"
        style={{ width: 52 }}
      >
        <div
          className="relative"
          style={{ transform: `translateY(${-scrollTop}px)` }}
        >
          {lines.map((_, index) => (
            <div
              key={index}
              className={cn(
                "pr-2 font-mono tabular-nums",
                index + 1 === caretLine
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground/60",
              )}
              style={{ height: (rows[index] ?? 1) * LINE_HEIGHT, fontSize: 12 }}
            >
              {index + 1}
            </div>
          ))}
        </div>
      </div>

      {/* code surface */}
      <div className="relative min-w-0 flex-1">
        <div
          ref={highlightRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bg-primary/6"
          style={{
            top: 12 + highlightTop - scrollTop,
            height: highlightHeight,
          }}
        />
        <textarea
          ref={textareaRef}
          data-testid="source-input"
          value={value}
          aria-label={ariaLabel}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          onChange={(event) => {
            onChange(event.target.value);
            requestAnimationFrame(updateCaret);
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={updateCaret}
          onClick={updateCaret}
          onSelect={updateCaret}
          wrap={wordWrap ? "soft" : "off"}
          className={cn(
            "thin-scrollbar absolute inset-0 h-full w-full resize-none bg-transparent py-3 text-foreground caret-primary outline-none",
            wordWrap ? "overflow-x-hidden" : "overflow-x-auto",
          )}
          style={{ ...SHARED_TEXT_STYLE, paddingLeft: 12, paddingRight: 12 }}
        />
      </div>
    </div>
  );
}
