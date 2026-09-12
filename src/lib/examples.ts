export interface Example {
  id: string;
  title: string;
  description: string;
  /** Diagram kinds, shown as badges in the gallery. */
  tags: string[];
  source: string;
}

export const EXAMPLES: Example[] = [
  {
    id: "markdown-showcase",
    title: "Markdown playground",
    description:
      "Headings, lists, tables, code and links inside a single node label.",
    tags: ["flowchart", "markdown"],
    source: `flowchart LR
    A("### Mehrmaid
Double-quoted labels are
rendered as **Markdown**.

- bullet one
- bullet two

\`inline code\` and a [link](https://mermaid.js.org)") --> B("| Setting | Value |
| --- | --- |
| Labels | Markdown |
| Export | SVG + PNG |
| Backend | none |")

    B --> C("1. Paste a diagram
2. Edit the source
3. Export the result")

    C --> D("\`\`\`js
const diagram = await render(source);
download(diagram);
\`\`\`")`,
  },
  {
    id: "release-pipeline",
    title: "Release pipeline",
    description: "Subgraphs, Markdown titles and decision points.",
    tags: ["flowchart", "subgraph"],
    source: `flowchart TB
    subgraph "**Build**"
        direction LR
        A("Checkout") --> B("Install deps")
        B --> C("Run \`npm test\`")
    end

    subgraph "**Publish**"
        direction LR
        D("Build artifacts") --> E("Upload to CDN")
        E --> F("Announce release")
    end

    C --> D
    C -.->|"failure"| G("**Notify** the team")
    G --> C`,
  },
  {
    id: "decision-tree",
    title: "Support triage",
    description: "A left-to-right decision tree with rich labels.",
    tags: ["flowchart", "decision"],
    source: `flowchart LR
    Start("Customer reports
an **issue**") --> Triage{"Is it reproducible?"}

    Triage -->|"yes"| Repro("Reproduce locally")
    Triage -->|"no"| Ask("Ask for:
- steps
- version
- logs")

    Repro --> Fix{"Known cause?"}
    Fix -->|"yes"| Patch("**Ship a patch**")
    Fix -->|"no"| Bisect("Bisect the regression")

    Patch --> Notes("Update the
_changelog_ and close")`,
  },
  {
    id: "sequence",
    title: "Sequence diagram",
    description:
      "Any Mermaid diagram type renders — Markdown labels only apply to flowcharts.",
    tags: ["sequence"],
    source: `sequenceDiagram
    autonumber
    actor User
    participant App as Merhmaid Renderer
    participant Mermaid

    User->>App: Paste diagram source
    App->>App: Extract Markdown labels
    App->>Mermaid: render(text)
    Mermaid-->>App: SVG
    App-->>User: Preview + PNG/SVG export`,
  },
  {
    id: "state-machine",
    title: "State machine",
    description: "State diagrams with descriptions and styled transitions.",
    tags: ["state"],
    source: `stateDiagram-v2
    [*] --> Idle
    Idle --> Editing: user types
    Editing --> Validating: debounce 400ms

    state Validating {
        [*] --> Parsing
        Parsing --> Layout
        Layout --> [*]
    }

    Validating --> Ready: success
    Validating --> Failed: syntax error
    Failed --> Editing: user fixes
    Ready --> [*]`,
  },
  {
    id: "class-diagram",
    title: "Class diagram",
    description: "Namespaces, generics and relationships.",
    tags: ["class"],
    source: `classDiagram
    direction LR
    class Renderer {
        +render(source) Diagram
        +measure(label) Size
    }
    class LabelParser {
        +extract(source) LabelToken[]
        +build(source, tokens) string
    }
    class Exporter {
        +toSvg(diagram) Blob
        +toPng(diagram, scale) Blob
    }
    Renderer --> LabelParser : uses
    Renderer --> Exporter : delegates
    Renderer ..> Mermaid : dynamic import`,
  },
  {
    id: "gantt",
    title: "Gantt chart",
    description: "Timelines and sections render out of the box.",
    tags: ["gantt"],
    source: `gantt
    title Ship Merhmaid Renderer
    dateFormat YYYY-MM-DD
    axisFormat %b %d

    section Core
    Markdown labels      :done,    a1, 2026-01-05, 6d
    Export pipeline      :active,  a2, after a1, 5d

    section Polish
    Keyboard shortcuts   :         b1, after a2, 3d
    Docs and examples    :         b2, after b1, 4d`,
  },
  {
    id: "starter",
    title: "Starter",
    description: "The minimal diagram the app opens with.",
    tags: ["flowchart"],
    source: `flowchart LR
    A("**Markdown** node") --> B("\`Inline code\` in labels")
    B --> C("Supports **bold**,
_italic_ and more")`,
  },
];

export const DEFAULT_SOURCE = EXAMPLES[0].source;

export function findExample(id: string): Example | undefined {
  return EXAMPLES.find((example) => example.id === id);
}
