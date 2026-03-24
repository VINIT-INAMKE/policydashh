# Phase 3: Block Editor - Research

**Researched:** 2026-03-25
**Domain:** Tiptap 3 block editor, slash commands, drag-and-drop, media embeds, Next.js App Router
**Confidence:** HIGH (core stack verified via npm registry and official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Section content stored as Tiptap JSON (JSONB) in policySections table (Phase 2)
- Read-only renderer exists at `src/lib/tiptap-renderer.ts` (Phase 2) — editor replaces this for edit mode
- tRPC document router has section CRUD procedures (Phase 2)
- Tiptap 3 chosen as editor (project research STACK.md)
- Real-time collab (Yjs/Hocuspocus) is Phase 11 — this phase is single-user editing only

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)
- Real-time collaborative editing (Phase 11)
- Inline comments on selected text (Phase 11)
- Presence indicators (Phase 11)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EDIT-01 | Notion-style block editor with slash commands for inserting block types | Tiptap 3 + `@tiptap/suggestion` for custom slash command extension; no official published extension yet — must build on `@tiptap/suggestion` |
| EDIT-02 | Block types: text, heading (H1-H3), callout, table, toggle/collapsible, quote, divider, code block | All available via Tiptap extensions except callout (no first-party extension) — callout must be a custom Node built from Tiptap's Node.create() API |
| EDIT-03 | Drag-and-drop reordering of blocks within a section | `@tiptap/extension-drag-handle-react` + `@tiptap/extension-node-range` handle this natively |
| EDIT-04 | Rich text formatting (bold, italic, underline, strikethrough, links, inline code) | All included in `@tiptap/starter-kit` v3 (Underline and Link are now part of StarterKit in v3) |
| EDIT-05 | Embeds and media support (images, file attachments, rich link previews) | Image: `@tiptap/extension-image`; File upload: `@tiptap/extension-file-handler` + Uploadthing; Rich link preview: custom OEmbed Node (no first-party extension) |
</phase_requirements>

---

## Summary

Phase 3 installs Tiptap 3 into the existing Next.js 16 / React 19 codebase and replaces the placeholder `SectionContentView` component with a fully interactive block editor. The editor reads and writes Tiptap JSON directly to the `policySections.content` JSONB column via an existing tRPC mutation (to be added: `updateSectionContent`). Single-user editing only — no Yjs or Hocuspocus in this phase.

Tiptap 3.20.5 is on npm and confirmed stable. All first-party extensions follow the same version (`3.20.5`). The primary implementation challenges are: (1) slash commands must be hand-built using `@tiptap/suggestion` because the official slash commands extension is experimental/unpublished, (2) callout blocks require a custom Tiptap Node (no first-party callout extension exists), and (3) rich link previews require a custom OEmbed-fetching Node. Everything else maps cleanly to published Tiptap extensions.

**Primary recommendation:** Install Tiptap with a curated extension set (StarterKit + 7 additional extensions), build a custom slash command menu using `@tiptap/suggestion`, implement a custom Callout node, and wire auto-save via debounced `onUpdate` → tRPC `section.updateContent` mutation. Bubble menu handles inline formatting toolbar; DragHandleReact handles block reordering.

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md contains `@AGENTS.md` which references `AGENTS.md`:

> "This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices."

**Directive: Before writing any Next.js route handlers, layouts, or API routes, read `node_modules/next/dist/docs/` for the applicable pattern.** This is particularly relevant for any new API routes (e.g., Uploadthing file route) introduced in this phase.

---

## Standard Stack

### Core (already installed in package.json)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Next.js | 16.2.1 | Framework | Installed |
| React | 19.2.4 | UI | Installed |
| @tanstack/react-query | ^5.95.2 | Data fetching | Installed |
| @trpc/react-query | ^11.15.0 | Type-safe mutations | Installed |
| sonner | ^2.0.7 | Toast notifications | Installed |
| zod | ^4.3.6 | Validation | Installed |
| lucide-react | ^1.6.0 | Icons | Installed |
| uploadthing + @uploadthing/react | not installed | File uploads | Must install |

### New Dependencies to Install (Phase 3)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| @tiptap/react | 3.20.5 | React bindings + EditorContent | Core |
| @tiptap/pm | 3.20.5 | ProseMirror peer dependency | Required by all Tiptap |
| @tiptap/starter-kit | 3.20.5 | Bundle: Paragraph, Heading, Bold, Italic, Underline, Strike, Link, Code, Blockquote, CodeBlock, HardBreak, HorizontalRule, BulletList, OrderedList, ListItem, Dropcursor, Gapcursor, History, ListKeymap, TrailingNode | Core |
| @tiptap/extension-image | 3.20.5 | Image blocks | EDIT-05 |
| @tiptap/extension-file-handler | 3.20.5 | File drop/paste handling | EDIT-05 |
| @tiptap/extension-table | 3.20.5 | Table blocks | EDIT-02 |
| @tiptap/extension-details | 3.20.5 | Toggle/collapsible blocks (Details + DetailsSummary + DetailsContent) | EDIT-02 |
| @tiptap/extension-code-block-lowlight | 3.20.5 | Syntax-highlighted code blocks | EDIT-02 |
| @tiptap/extension-drag-handle-react | 3.20.5 | Block drag-and-drop via React component | EDIT-03 |
| @tiptap/extension-drag-handle | 3.20.5 | Peer required by drag-handle-react | EDIT-03 |
| @tiptap/extension-node-range | 3.20.5 | Peer required by drag-handle-react | EDIT-03 |
| @tiptap/extension-bubble-menu | 3.20.5 | Floating formatting toolbar on text selection | EDIT-04 |
| @tiptap/suggestion | 3.20.5 | Slash command triggering engine | EDIT-01 |
| lowlight | 3.3.0 | Syntax highlighting for CodeBlockLowlight | EDIT-02 |
| uploadthing | latest | File storage (S3 under the hood) | EDIT-05 |
| @uploadthing/react | latest | React hooks for upload progress | EDIT-05 |
| use-debounce | latest | Debounce auto-save writes | Auto-save |

**Version verification (confirmed against npm registry 2026-03-25):**
- All `@tiptap/*` packages: `3.20.5` (last published recently, all in sync)
- `lowlight`: `3.3.0`

**Installation:**
```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit \
  @tiptap/extension-image @tiptap/extension-file-handler \
  @tiptap/extension-table @tiptap/extension-details \
  @tiptap/extension-code-block-lowlight \
  @tiptap/extension-drag-handle-react @tiptap/extension-drag-handle @tiptap/extension-node-range \
  @tiptap/extension-bubble-menu @tiptap/suggestion \
  lowlight uploadthing @uploadthing/react use-debounce
```

### What StarterKit v3 Includes (verified)
StarterKit v3 now bundles **Underline** and **Link** that were separate in v2. Full list:
- **Nodes:** Blockquote, BulletList, CodeBlock, Document, HardBreak, Heading, HorizontalRule, ListItem, OrderedList, Paragraph, Text
- **Marks:** Bold, Code, Italic, **Link (new in v3)**, Strike, **Underline (new in v3)**
- **Functionality:** Dropcursor, Gapcursor, History (Undo/Redo), ListKeymap, TrailingNode

Do NOT separately install `@tiptap/extension-link` or `@tiptap/extension-underline` — they are in StarterKit and will conflict.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom slash command (via @tiptap/suggestion) | Tiptap SlashDropdownMenu UI Component | UI component is in Tiptap's "Start plan" (paid subscription). Custom is free but requires ~100 lines of code. |
| Custom Callout Node | Extend Blockquote with icon/color | Blockquote extension could be extended; callout is semantically different (icon, background color) — custom Node is cleaner for future diff rendering |
| Uploadthing | Vercel Blob | STACK.md recommends Uploadthing; Vercel Blob is noted as tighter integration on Vercel. Either works. Uploadthing provides type-safe file routes. |
| @tiptap/extension-code-block-lowlight | @tiptap/extension-code-block | Lowlight adds syntax highlighting; plain CodeBlock is in StarterKit already — must override/replace it |

---

## Architecture Patterns

### Component Structure
```
app/(workspace)/policies/[id]/
├── page.tsx                          # Existing page — selects sections, renders editor
├── _components/
│   ├── section-content-view.tsx      # REPLACE: was read-only, now conditionally renders editor
│   ├── block-editor.tsx              # NEW: main editor component (use client)
│   ├── editor-toolbar.tsx            # NEW: formatting toolbar above editor (BubbleMenu)
│   ├── slash-command-menu.tsx        # NEW: slash command dropdown list
│   └── (existing components remain unchanged)

src/
├── lib/
│   ├── tiptap-renderer.ts            # Keep for read-only views in other phases
│   └── tiptap-extensions/
│       ├── callout-node.ts           # NEW: custom callout block node
│       ├── slash-command-extension.ts # NEW: slash command trigger (uses @tiptap/suggestion)
│       └── link-preview-node.ts      # NEW: OEmbed rich link preview node (optional, can defer)
└── server/routers/
    └── document.ts                   # ADD: updateSectionContent mutation
```

### Pattern 1: Basic Editor Initialization (Next.js App Router)
**What:** Client component with `useEditor`, `immediatelyRender: false` to prevent SSR hydration mismatch
**When to use:** Every Tiptap component in a Next.js App Router codebase

```typescript
// Source: https://tiptap.dev/docs/editor/getting-started/install/nextjs
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

const BlockEditor = ({ content, onUpdate }: Props) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content,                    // Pass Tiptap JSON from policySections.content
    immediatelyRender: false,   // REQUIRED for Next.js SSR — prevents hydration mismatch
    onUpdate: ({ editor }) => {
      onUpdate(editor.getJSON())
    },
  })

  if (!editor) return null
  return <EditorContent editor={editor} />
}
```

### Pattern 2: Auto-save via Debounced tRPC Mutation
**What:** `onUpdate` fires on every keystroke — debounce prevents API flooding; write only after 1-2 seconds idle
**When to use:** Any time Tiptap content must persist to a database

```typescript
// Source: https://github.com/ueberdosis/tiptap/discussions/2871 (verified pattern)
import { useDebouncedCallback } from 'use-debounce'

const updateContent = trpc.document.updateSectionContent.useMutation()

const debouncedSave = useDebouncedCallback((json: Record<string, unknown>) => {
  updateContent.mutate({ id: sectionId, content: json })
}, 1500)  // 1.5s idle before saving

const editor = useEditor({
  extensions: [...],
  content: section.content,
  immediatelyRender: false,
  onUpdate: ({ editor }) => {
    debouncedSave(editor.getJSON())
  },
})
```

### Pattern 3: Slash Commands via @tiptap/suggestion
**What:** `@tiptap/suggestion` provides the trigger mechanism; UI rendering is custom React portal
**When to use:** Implementing the `/` command palette (EDIT-01)

```typescript
// Source: https://tiptap.dev/docs/examples/experiments/slash-commands (pattern)
import Suggestion from '@tiptap/suggestion'
import { Extension } from '@tiptap/core'

const SlashCommands = Extension.create({
  name: 'slashCommands',
  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }) => {
          props.command({ editor, range })
        },
      },
    }
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})
```

The suggestion `items` callback receives the query string typed after `/` and returns filtered command objects. Each command object has a `title`, optional `description`, and a `command` function that executes on selection. Render is handled by a React component using `tippy.js` or a positioned `div` portal.

### Pattern 4: Custom Callout Node
**What:** Tiptap has no built-in callout. Build a custom `Node.create()` that renders a styled div with an emoji icon slot and content area.
**When to use:** EDIT-02 requires callout block type

```typescript
// Source: Tiptap custom node documentation pattern
import { Node, mergeAttributes } from '@tiptap/core'

const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      type: { default: 'info' },   // 'info' | 'warning' | 'tip' | 'danger'
      emoji: { default: '💡' },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout' }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutComponent)
  },
})
```

### Pattern 5: DragHandleReact for Block Reordering
**What:** `DragHandleReact` wraps the `DragHandle` extension and renders a visual grip handle to the left of each block, enabling drag-and-drop reordering of ProseMirror nodes.
**When to use:** EDIT-03

```typescript
// Source: https://tiptap.dev/docs/editor/extensions/functionality/drag-handle-react
import { DragHandle } from '@tiptap/extension-drag-handle-react'

// Add NodeRange to extensions array:
extensions: [StarterKit, NodeRange, ...]

// Wrap EditorContent with DragHandle:
<DragHandle editor={editor}>
  <div className="drag-handle-icon">
    <GripVertical className="h-4 w-4 text-muted-foreground" />
  </div>
</DragHandle>
<EditorContent editor={editor} />
```

**Important peer deps:** `@tiptap/extension-node-range` must be in the extensions array, not just installed. The drag handle docs show this as required.

### Pattern 6: BubbleMenu for Inline Formatting
**What:** `BubbleMenu` from `@tiptap/react/menus` appears on text selection with formatting buttons
**When to use:** EDIT-04 inline formatting toolbar

```typescript
// Source: https://tiptap.dev/docs/editor/extensions/functionality/bubble-menu
import { BubbleMenu } from '@tiptap/react'   // Note: NOT from @tiptap/extension-bubble-menu

<BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
  <button onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'is-active' : ''}>
    Bold
  </button>
  {/* italic, underline, strikethrough, code, link */}
</BubbleMenu>
```

### Pattern 7: CodeBlock with Syntax Highlighting
**What:** StarterKit includes a plain CodeBlock. Override it with `CodeBlockLowlight` for language-aware highlighting.
**When to use:** EDIT-02 code block type

```typescript
import { lowlight } from 'lowlight/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
// Register only needed languages to keep bundle small
lowlight.registerLanguage('js', javascript)
lowlight.registerLanguage('python', python)

extensions: [
  StarterKit.configure({ codeBlock: false }),  // Disable plain CodeBlock from StarterKit
  CodeBlockLowlight.configure({ lowlight }),
]
```

### Anti-Patterns to Avoid
- **Not disabling `codeBlock` in StarterKit when adding CodeBlockLowlight:** Results in two competing CodeBlock extensions and schema conflicts.
- **Not setting `immediatelyRender: false`:** Causes React hydration mismatch errors in Next.js App Router. Hard to debug — always set this.
- **Installing `@tiptap/extension-link` or `@tiptap/extension-underline` separately:** These are bundled in StarterKit v3 — duplicate imports cause extension conflicts.
- **Saving on every `onUpdate` without debounce:** Floods the tRPC mutation; causes write conflicts and visible lag on every keystroke.
- **Forgetting `NodeRange` in extensions array:** `DragHandleReact` silently fails or throws cryptic errors when `@tiptap/extension-node-range` is installed but not added to the extensions array.
- **SSR-rendering DragHandleReact:** There is a known Tiptap GitHub issue (#5602) — DragHandle React + `immediatelyRender` causes SSR issues. Use `dynamic(() => import('./block-editor'), { ssr: false })` for the editor component if hydration issues persist.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ProseMirror state management | Custom document model | Tiptap + StarterKit | ProseMirror schema, transactions, history undo/redo are thousands of lines of battle-tested code |
| Slash command trigger mechanism | Custom keydown handler | `@tiptap/suggestion` | Handles cursor position tracking, dismissal on Escape/blur, query extraction, and item rendering lifecycle |
| Block drag-and-drop | Custom HTML5 drag events | `@tiptap/extension-drag-handle-react` | Handles ProseMirror node identification, drop target calculation, and undo/redo integration |
| File upload S3 infrastructure | Custom presigned URL flow | Uploadthing | IAM policies, CORS, presigning, progress tracking, type-safe routes |
| Syntax highlighting tokenizer | Custom regex | lowlight + CodeBlockLowlight | 190+ language grammars, security-vetted |
| Collapsible blocks (toggle) | Custom collapse state | `@tiptap/extension-details` | Handles Details/DetailsSummary/DetailsContent ProseMirror node schema and toggling |
| Rich text table | Custom table rendering | `@tiptap/extension-table` | Cell merging, column resizing, tab navigation between cells, copy-paste handling |

**Key insight:** The ProseMirror document model underneath Tiptap has many subtle invariants (marks across nodes, list nesting, block/inline distinction). Any custom solution fights these constraints. Use Tiptap's extension system to stay within the model.

---

## Common Pitfalls

### Pitfall 1: SSR Hydration Mismatch
**What goes wrong:** The editor renders different HTML on server vs. client, causing React hydration error and broken editor.
**Why it happens:** Tiptap uses browser DOM APIs and generates random IDs. Next.js App Router server-renders components by default.
**How to avoid:** Always add `'use client'` AND `immediatelyRender: false` to any component using `useEditor`. If DragHandle causes issues even with this, wrap the entire editor in `dynamic(() => import('./block-editor'), { ssr: false })`.
**Warning signs:** `Text content does not match server-rendered HTML` in browser console; editor renders blank or throws on first load.

### Pitfall 2: StarterKit v3 Includes Link and Underline
**What goes wrong:** Developer installs `@tiptap/extension-link` and `@tiptap/extension-underline` separately (v2 pattern), causing schema conflicts or double registration.
**Why it happens:** In Tiptap v2 these were separate; in v3 they're bundled in StarterKit.
**How to avoid:** Check STACK.md confirmation: StarterKit v3 bundles Link and Underline. Do not install them separately.
**Warning signs:** Console warning "Extension X is already registered" or link commands not working.

### Pitfall 3: CodeBlock Conflict with CodeBlockLowlight
**What goes wrong:** Both `CodeBlock` (from StarterKit) and `CodeBlockLowlight` are active, causing schema errors or duplicate node names.
**Why it happens:** StarterKit includes CodeBlock by default.
**How to avoid:** Explicitly disable CodeBlock in StarterKit: `StarterKit.configure({ codeBlock: false })`.
**Warning signs:** `Duplicate node type "codeBlock"` schema error on editor mount.

### Pitfall 4: NodeRange Not in Extensions Array
**What goes wrong:** DragHandleReact fails silently or throws `Cannot read properties of undefined` related to node selection.
**Why it happens:** `@tiptap/extension-node-range` is a peer dependency that must be explicitly added to the `extensions: [...]` array, not just installed as a package.
**How to avoid:** Add `NodeRange` (imported from `@tiptap/extension-node-range`) to the extensions array alongside StarterKit.
**Warning signs:** Drag handle appears but clicking/dragging has no effect; no drag overlay shown.

### Pitfall 5: Missing `section:update` Permission in RBAC
**What goes wrong:** `updateSectionContent` tRPC mutation is accessible to roles that should not edit policy content.
**Why it happens:** The existing `PERMISSIONS` table grants `section:manage` to `admin` and `policy_lead` only. The new mutation must respect the same permission gate.
**How to avoid:** Use `requirePermission('section:manage')` on the new `updateSectionContent` mutation — same permission used by `createSection`, `renameSection`, `deleteSection`.
**Warning signs:** Stakeholder or Observer role can save content; no 403 thrown.

### Pitfall 6: Slash Commands Not Official/Stable
**What goes wrong:** Attempting to install `@tiptap/extension-slash-commands` (doesn't exist as a published package) and getting an npm 404.
**Why it happens:** The Tiptap experimental slash commands page explicitly states "this extension does not have a published package yet."
**How to avoid:** Build the slash command extension directly on `@tiptap/suggestion`. About 80-120 lines of code for the extension + a separate React component for the dropdown UI. Reference the experimental example code on tiptap.dev.
**Warning signs:** `npm WARN 404 Not Found - @tiptap/extension-slash-commands`.

### Pitfall 7: File Upload Without API Route in Next.js 16
**What goes wrong:** Uploadthing file route handler fails or returns 404 because the Next.js 16 API route convention changed.
**Why it happens:** CLAUDE.md/AGENTS.md explicitly warns that Next.js 16 has breaking changes from prior knowledge.
**How to avoid:** Read `node_modules/next/dist/docs/` for the current API route export convention before writing the Uploadthing handler. In Next.js App Router, API routes export named handlers (`export async function POST`); Uploadthing's `createNextRouteHandler` pattern must match the current signature.
**Warning signs:** Uploadthing file routes return 404 in production; upload progress never completes.

---

## Code Examples

### Full Extension Array (Production-ready)
```typescript
// Source: Tiptap official docs (multiple pages), npm registry verified 2026-03-25
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { FileHandler } from '@tiptap/extension-file-handler'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Details from '@tiptap/extension-details'
import DetailsSummary from '@tiptap/extension-details-summary'
import DetailsContent from '@tiptap/extension-details-content'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import NodeRange from '@tiptap/extension-node-range'
import { lowlight } from 'lowlight/lib/core'
import { SlashCommands } from '@/src/lib/tiptap-extensions/slash-command-extension'
import { Callout } from '@/src/lib/tiptap-extensions/callout-node'

export const buildExtensions = () => [
  StarterKit.configure({
    codeBlock: false,    // Replaced by CodeBlockLowlight
  }),
  CodeBlockLowlight.configure({ lowlight }),
  Image.configure({ allowBase64: false }),
  FileHandler.configure({
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'],
    onDrop: (currentEditor, files, pos) => {
      // Handle file drop -- trigger upload to Uploadthing, then insert node
    },
    onPaste: (currentEditor, files) => {
      // Handle paste from clipboard
    },
  }),
  Table.configure({ resizable: false }),
  TableRow,
  TableCell,
  TableHeader,
  Details.configure({ persist: true, openClassName: 'is-open' }),
  DetailsSummary,
  DetailsContent,
  NodeRange,
  Callout,
  SlashCommands.configure({
    suggestion: {
      items: ({ query }) => getSlashCommandItems(query),
    },
  }),
]
```

### New tRPC Mutation: updateSectionContent
```typescript
// Add to src/server/routers/document.ts
// Source: existing pattern in document.ts (Phase 2 code)
updateSectionContent: requirePermission('section:manage')
  .input(z.object({
    id: z.string().uuid(),
    documentId: z.string().uuid(),
    content: z.record(z.unknown()),
  }))
  .mutation(async ({ ctx, input }) => {
    const [updated] = await db
      .update(policySections)
      .set({ content: input.content, updatedAt: new Date() })
      .where(and(
        eq(policySections.id, input.id),
        eq(policySections.documentId, input.documentId),
      ))
      .returning()

    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Section not found' })
    }

    // Note: content changes are high-frequency, so audit log is omitted here
    // per architectural decision: audit log captures structural operations, not content edits
    // (this decision may be revisited in Phase 6 versioning)

    return updated
  }),
```

### Section Integration: Replacing SectionContentView
```typescript
// Replace in app/(workspace)/policies/[id]/_components/section-content-view.tsx
// The existing component renders placeholder text -- Phase 3 replaces it with the editor
'use client'
import dynamic from 'next/dynamic'

// Avoid SSR entirely for the editor
const BlockEditor = dynamic(() => import('./block-editor'), { ssr: false })

interface SectionContentViewProps {
  section: { id: string; documentId: string; title: string; content: Record<string, unknown> | null; updatedAt: string }
  canEdit: boolean  // derived from user role (admin | policy_lead = true)
}

export function SectionContentView({ section, canEdit }: SectionContentViewProps) {
  if (canEdit) {
    return <BlockEditor section={section} />
  }
  // Read-only fallback for non-editing roles (uses existing renderTiptapToText or new HTML renderer)
  return <ReadOnlyRenderer content={section.content} />
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@tiptap/extension-link` separate package | Bundled in StarterKit v3 | Tiptap 3.0 release | Do not install separately |
| `@tiptap/extension-underline` separate | Bundled in StarterKit v3 | Tiptap 3.0 release | Do not install separately |
| Tiptap PRO for drag handle | `@tiptap/extension-drag-handle-react` in open-source v3 | Tiptap 3.x | No subscription needed |
| Manual suggestion handling | `@tiptap/suggestion` utility | Tiptap v2+ | Standard approach for slash/mention |
| `@tiptap/extension-table-kit` (mentioned in STACK.md) | Install individual table extensions | STACK.md noted v3 "TableKit" — npm shows only individual `@tiptap/extension-table` | Install Table, TableRow, TableCell, TableHeader individually |

**Deprecated/outdated patterns:**
- Tiptap v2 separate Link/Underline imports: replaced by StarterKit v3 bundle
- `@tiptap-pro/extension-drag-handle`: moved to open-source `@tiptap/extension-drag-handle` in v3
- `@tiptap/extension-table-kit` as a single package: not found on npm (3.20.5) — install individual table sub-extensions

---

## Open Questions

1. **Rich Link Preview (EDIT-05 partial)**
   - What we know: EDIT-05 requires "rich link previews." No Tiptap extension exists for OEmbed-style previews. Building one requires a server-side OEmbed fetch (e.g., `https://iframe.ly/api/oembed?url=...`) + a custom Tiptap Node with NodeView.
   - What's unclear: Is a rich link preview essential for MVP (the success criteria says "insert rich link previews"), or can a simpler hyperlink suffice initially? This adds ~1 day of work.
   - Recommendation: Implement basic hyperlink (already in StarterKit via Link mark) for the MVP, build an OEmbed "link embed" custom node as a stretch goal within Phase 3. If deferred, document as a known gap.

2. **Audit logging for content edits**
   - What we know: Every tRPC mutation currently writes an audit log. Content edits are high-frequency and saving every keystroke (even debounced) could generate thousands of audit entries.
   - What's unclear: Should section content edits write audit entries?
   - Recommendation: Do NOT audit individual content saves in Phase 3. Audit structural events (create/delete/reorder) only. Phase 6 (Versioning) creates explicit version snapshots — those are the auditworthy content events.

3. **TableKit vs Individual Table Extensions**
   - What we know: STACK.md mentions "TableKit (e.g., TableKit)" as a Tiptap 3 unified extension. npm search for `@tiptap/extension-table-kit` returns no result at 3.20.5.
   - What's unclear: Whether TableKit ships as a separate package not yet published, or whether the STACK.md reference was based on pre-release notes.
   - Recommendation: Install individual table sub-extensions (`@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`). This is confirmed to work at 3.20.5.

---

## Environment Availability

Step 2.6: Only external dependency added in this phase is Uploadthing (for file uploads). No new CLI tools, databases, or services are required beyond what Phase 2 established. The project already has Node.js and npm available.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| npm / Node.js | Package installation | Assumed (existing project) | — | — |
| Uploadthing API key | EDIT-05 file uploads | Must be provisioned | — | Skip file attachments in dev until key configured |
| Neon PostgreSQL | Saving content | Already set up (Phase 2) | 16+ | — |

**Missing with no fallback:** Uploadthing API key must be added to `.env.local` before file upload features work. This is a provisioning step, not a code blocker.

---

## Validation Architecture

Config: `nyquist_validation: true` — include validation section.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.mts` (jsdom environment, globals: true) |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDIT-01 | SlashCommands extension registers `/` trigger and fires suggestion | unit | `npm test -- src/__tests__/slash-commands.test.ts` | ❌ Wave 0 |
| EDIT-01 | getSlashCommandItems() returns filtered list for each block type | unit | `npm test -- src/__tests__/slash-commands.test.ts` | ❌ Wave 0 |
| EDIT-02 | Callout custom node parses and renders HTML correctly | unit | `npm test -- src/__tests__/callout-node.test.ts` | ❌ Wave 0 |
| EDIT-02 | CodeBlockLowlight does not conflict with StarterKit CodeBlock | unit | `npm test -- src/__tests__/editor-extensions.test.ts` | ❌ Wave 0 |
| EDIT-03 | NodeRange extension is present in extensions array | unit | `npm test -- src/__tests__/editor-extensions.test.ts` | ❌ Wave 0 |
| EDIT-04 | Bold/italic/underline/strike marks are in StarterKit v3 | unit | `npm test -- src/__tests__/editor-extensions.test.ts` | ❌ Wave 0 |
| EDIT-05 | FileHandler configuration accepts expected MIME types | unit | `npm test -- src/__tests__/editor-extensions.test.ts` | ❌ Wave 0 |
| EDIT-01..05 | updateSectionContent tRPC mutation validates input schema | unit | `npm test -- src/__tests__/section-content.test.ts` | ❌ Wave 0 |
| EDIT-01..05 | updateSectionContent rejects non-admin/policy_lead role | unit | `npm test -- src/__tests__/section-content.test.ts` | ❌ Wave 0 |

**Note on editor component tests:** `useEditor` and full editor rendering require a browser DOM. Vitest with jsdom can handle basic tests but complex ProseMirror rendering may require mocking. Test the extension configuration (buildExtensions array) and the tRPC mutation schema — not the full interactive editor. E2E tests (Playwright) are the right layer for slash command invocation and drag-and-drop UI behavior. Playwright is in devDependencies already (`package.json` — wait, it is NOT currently in package.json). Playwright will be needed for full editor E2E but is out of scope for Wave 0 unit tests in this phase.

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/slash-commands.test.ts` — covers EDIT-01 slash command item filtering
- [ ] `src/__tests__/callout-node.test.ts` — covers EDIT-02 custom Callout node schema
- [ ] `src/__tests__/editor-extensions.test.ts` — covers EDIT-02/03/04/05 extension configuration
- [ ] `src/__tests__/section-content.test.ts` — covers EDIT-01..05 tRPC mutation schema + RBAC

---

## Sources

### Primary (HIGH confidence)
- [@tiptap/core npm](https://www.npmjs.com/package/@tiptap/core) — version 3.20.5 confirmed 2026-03-25
- [@tiptap/starter-kit npm](https://www.npmjs.com/package/@tiptap/starter-kit) — version 3.20.5, StarterKit v3 includes Link + Underline
- [@tiptap/extension-drag-handle-react npm](https://www.npmjs.com/package/@tiptap/extension-drag-handle-react) — 3.20.5 confirmed
- [@tiptap/extension-node-range npm](https://www.npmjs.com/package/@tiptap/extension-node-range) — 3.20.5 confirmed
- [@tiptap/suggestion npm](https://www.npmjs.com/package/@tiptap/suggestion) — 3.20.5 confirmed
- [lowlight npm](https://www.npmjs.com/package/lowlight) — 3.3.0 confirmed
- [Tiptap Next.js install guide](https://tiptap.dev/docs/editor/getting-started/install/nextjs) — `immediatelyRender: false` pattern, `'use client'` requirement
- [Tiptap StarterKit docs](https://tiptap.dev/docs/editor/extensions/functionality/starterkit) — confirmed v3 bundle contents
- [Tiptap drag-handle-react docs](https://tiptap.dev/docs/editor/extensions/functionality/drag-handle-react) — DragHandle component API, peer deps
- [Tiptap details extension docs](https://tiptap.dev/docs/editor/extensions/nodes/details) — Details/DetailsSummary/DetailsContent API
- [Tiptap table extension docs](https://tiptap.dev/docs/editor/extensions/nodes/table) — TableKit note, individual sub-extensions
- [Tiptap image extension docs](https://tiptap.dev/docs/editor/extensions/nodes/image) — Image extension config, FileHandler for uploads
- [Tiptap CodeBlockLowlight docs](https://tiptap.dev/docs/editor/extensions/nodes/code-block-lowlight) — lowlight integration pattern
- [Tiptap BubbleMenu docs](https://tiptap.dev/docs/editor/extensions/functionality/bubble-menu) — BubbleMenu component API
- [Tiptap events docs](https://tiptap.dev/docs/editor/api/events) — `onUpdate` event pattern

### Secondary (MEDIUM confidence)
- [Tiptap slash commands experimental](https://tiptap.dev/docs/examples/experiments/slash-commands) — "not yet published" status confirmed, `@tiptap/suggestion` as foundation
- [SlashDropdownMenu component](https://tiptap.dev/docs/ui-components/components/slash-dropdown-menu) — paid "Start plan" required; not viable for free tier
- [Tiptap nodes overview](https://tiptap.dev/docs/editor/extensions/nodes) — 27 extensions listed; no callout extension
- [GitHub issue #5602](https://github.com/ueberdosis/tiptap/issues/5602) — DragHandle React + SSR issue confirmed; `dynamic({ ssr: false })` workaround
- [GitHub discussion #2871](https://github.com/ueberdosis/tiptap/discussions/2871) — debounce autosave pattern

### Tertiary (LOW confidence — not needed, informational only)
- [Tiptap SlashCommandTriggerButton](https://tiptap.dev/docs/ui-components/components/slash-command-trigger-button) — paid UI component, not used

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions confirmed from npm registry on research date
- Architecture: HIGH — patterns verified against official Tiptap 3 docs and existing codebase patterns
- Pitfalls: HIGH — hydration, SSR, and StarterKit v3 changes verified against official docs and GitHub issues
- Slash commands (custom): MEDIUM — no official published package; experimental docs exist; pattern is well-established in community

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (Tiptap releases frequently; re-verify versions before install)
