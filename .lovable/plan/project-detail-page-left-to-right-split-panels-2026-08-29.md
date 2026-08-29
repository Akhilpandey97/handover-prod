# Project detail page: left-to-right split panels

Rework the project workspace into a two-pane, left-to-right layout: context on the left, the working surface on the right.

## Layout

```text
+-----------------------------+  +--------------------------------------+
| LEFT (context, ~40%)        |  | RIGHT (work surface, ~60%)           |
|                             |  |                                      |
| Waiting On                  |  | Checklist | Activity | Notes | Detail|
| Next Step                   |  |--------------------------------------|
| Go-Live                     |  |                                      |
| Risk (score + reason)       |  |  Checklist groups, tasks, comments   |
|-----------------------------|  |  (default tab, full height scroll)   |
| Owner card                  |  |                                      |
| Needs attention (3 items)   |  |                                      |
| Project overview            |  |                                      |
| Update state                |  |                                      |
+-----------------------------+  +--------------------------------------+
```

- The four top cards (Waiting On, Next Step, Go-Live, Risk) move out of the full-width strip and become a compact vertical stack at the top of the left panel.
- Owner, Needs Attention, Project Overview and Update State follow below them in the same left column, keeping their current content and behaviour.
- The right panel holds the tab bar and all tab content, with Checklist as the default and the primary work surface.
- The header row (back to Kanban, project name, prev/next, Assign owner, Portal link, Edit project, Transfer) stays full width and unchanged.

## Responsive behaviour

- Desktop (lg and up): two columns side by side, each scrolling independently under the sticky header.
- Tablet/mobile: single column — left context stacks above the tab panel, with the four status cards in a 2-up grid so they stay compact.

## Technical notes

- Change the layout in `src/pages/ProjectWorkspace.tsx` only; no data, hook, or business-logic changes.
- Replace the current `grid ... lg:grid-cols-[1fr_1fr_1fr_1.75fr]` metric strip with the left-column stack, and switch the body wrapper to a `lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]` two-pane grid.
- Reuse the existing `WorkspaceMetricCard` and `WorkspaceSection` components; the metric cards get a compact variant (smaller padding, single-line value) via className rather than new components.
- Keep independent scroll regions with `overflow-y-auto` on each pane and the existing sticky header offsets.
- Colors and surfaces continue to come from the existing tokens and `LabelsContext` color settings — no new hardcoded colors.
