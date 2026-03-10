# CARF UX Renewal Design

> Cross-tab action integration, smart split panes, and action popover system

## Problem

Current CARF UI displays rich data (addresses, functions, modules, classes) but provides no way to act on them directly. Users must manually copy-paste values between tabs (e.g., copy an address from Modules tab to use in Memory tab). No context menus, no inline actions, no cross-tab linking.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Action access pattern | Hybrid: inline primary + context menu | Hook button visible on hover; full menu via `...` |
| Split pane resize | Smart Responsive (min 200/max 400, drag, dbl-click toggle) | Flexible but bounded; persists to localStorage |
| Cross-tab navigation | Action Popover on click | Shows Navigate + Actions in one popover; preserves context |

## Architecture

### Shared Components (new)

#### 1. `ActionPopover`
- Renders a popover menu when clicking linkable text (address, module, symbol, class, thread)
- Two sections: **Navigate to** (tab jumps) and **Actions** (hook, copy, pin)
- Uses Kobalte Popover primitive
- Props: `type` (address|module|symbol|class|thread), `value`, `sessionId`, `context?`

#### 2. `SplitPane`
- Replaces all hardcoded `w-[40%]/w-[60%]` splits
- Drag handle with visual indicator
- Double-click handle to collapse/expand list panel
- Persists width to localStorage keyed by `split-{tabId}`
- Props: `id`, `minLeft?` (default 200), `maxLeft?` (default 400), `defaultLeft?` (default 280)

#### 3. `InlineActions`
- Hover-visible action buttons on data rows
- Shows 1-2 primary actions (Hook, Copy) + `...` overflow button
- `...` opens full context menu (Pin, View in Memory, Start Stalker, etc.)
- Props: `actions: ActionDef[]`, `onAction`

#### 4. `CopyButton`
- Small clipboard icon button
- Copies value to clipboard, shows brief "Copied!" tooltip
- Props: `value: string`

### Tab Modifications

Each tab gets:
1. **SplitPane** replacing fixed width splits
2. **ActionPopover** on clickable addresses/modules/symbols
3. **InlineActions** on data rows (hover)
4. **Selection caching** via localStorage

#### Per-tab action mapping:

| Tab | Inline Actions | Popover Links | Cross-tab Targets |
|-----|---------------|---------------|-------------------|
| Modules | Hook export, Copy addr | Address→Memory, Module→select | Memory, Native |
| Memory | Copy addr, Pin | Address→Modules (symbol lookup) | Modules |
| Java | Hook method, Copy sig | Class→select, Method→hook events | Hooks, Console |
| ObjC | Hook method, Copy sel | Class→select, Method→hook events | Hooks, Console |
| Native | Unhook, Copy addr | Address→Memory, Module→Modules | Memory, Modules |
| Threads | Hook frame, Copy addr | Address→Memory, Module→Modules, TID→Stalker | Memory, Modules, Native |
| CallGraph | Hook node, Copy addr | Address→Memory, Module→Modules | Memory, Modules, Native |
| Network | Copy URL, Copy as cURL | - | - |
| Files | Download, Copy path | - | - |
| Hooks | Toggle, Remove | Target→source tab | Java, ObjC, Native |
| Pinboard | Jump, Remove | Value→source tab | Any |
| Console | Copy message | Address→Memory | Memory |
| Script | - | - | - |

### Selection Caching

Each store persists its selected item to localStorage:
- `carf:selected:module` — selected module name
- `carf:selected:java-class` — selected Java class
- `carf:selected:objc-class` — selected ObjC class
- `carf:selected:thread` — selected thread ID
- `carf:selected:file-path` — current filesystem path

Restored on tab mount via `createEffect` reading localStorage.

### Layout Fixes

- Replace all `w-[40%]/w-[60%]`, `w-[35%]/w-[65%]`, `w-1/2` with `SplitPane`
- Address columns: use `min-w-0 truncate` instead of fixed `w-28`/`w-32`
- Long names (Java classes, ObjC selectors): add `title` attribute for tooltip on hover

## Implementation Order

1. Shared components: SplitPane, ActionPopover, InlineActions, CopyButton
2. Modules tab (prototype — most cross-tab links)
3. Remaining tabs: Memory, Java, ObjC, Native, Threads, CallGraph
4. Secondary tabs: Network, Files, Hooks, Pinboard, Console
5. Selection caching across all stores
6. Layout/width fixes

## Success Criteria

- Zero manual copy-paste needed between tabs
- Every address, module, symbol, class, thread is clickable
- Split panes resizable, persisted
- Hook any function in 1-2 clicks from any tab where it appears
