# Camera Calibration Tool

A frontend prototype of Aeyesky's camera calibration screen: an operator draws
and labels polygonal regions over a still frame from a table camera, then saves
the result as a calibration file. Built from the provided Figma design.

![Calibration screen](docs/screenshot.png)

## Setup

Requires Node 18+.

```bash
npm install
npm run dev      # http://localhost:5173
```

`npm run build` · `npm run preview` · `npm run typecheck`

## Using it

| Action | How |
| --- | --- |
| Pick a category | Click a label in **LABEL** — this also arms the polygon tool |
| Draw a region | Polygon tool (`P`), click to place anchors, click the first anchor (or double-click) to close |
| Undo an anchor / cancel | `Backspace` / `Esc` |
| Select | Select tool (`V`), click a region or its row in **LABELLED AREA** |
| Select several | `Shift`/`Cmd`+click, drag a marquee on empty canvas, `Cmd`+`A` for all, or click a group's label chip |
| Move | Drag — a multi-selection moves together as one body |
| Reshape | Double-click to enter anchor mode, then drag anchors; click a dashed midpoint to add one, `Alt`+click to remove |
| Change a region's label | Click the id badge above a selected region |
| Copy / paste / duplicate | `Cmd`+`C`, `Cmd`+`V`, `Cmd`+`D` — pastes cascade so copies don't hide |
| Hide / show | Eye icon on a row, or on a group header for the whole label |
| Delete | Trash icon or `Delete` — a multi-selection goes in one confirmation, with a count bar offering **Clear** / **Delete** |
| Save | **Save Calibration** — downloads JSON and writes to `localStorage` |

## Coordinate format

**Polygon vertices are normalised to the source image: `x, y ∈ [0, 1]`, origin
top-left, x rightwards, y downwards.** To convert to pixels:

```
px = x * image.width
py = y * image.height
```

Vertices are in draw order and the ring is **implicitly closed** — the last
vertex connects back to the first, and the first is not repeated. Winding is not
normalised (it follows the operator's draw direction), so consumers that care
about orientation should compute the signed area.

Normalised rather than pixel coordinates because a calibration describes a
*camera view*, not a *particular JPEG*: regions stay valid if the feed is later
delivered at 4K instead of 1080p, and the editor can be resized without
rewriting stored data.

### Saved file

Downloads as `calibration-DSH-4532.json`. A real export from the app is checked
in at [`docs/example-calibration.json`](docs/example-calibration.json).

```jsonc
{
  "version": 1,
  "cameraId": "DSH-4532",
  "savedAt": "2026-07-27T20:58:30.731Z",
  "image": { "source": "/table.jpg", "width": 1293, "height": 893 },
  "coordinateSystem": {
    "space": "normalized", "origin": "top-left",
    "xAxis": "left-to-right", "yAxis": "top-to-bottom", "range": [0, 1]
  },
  "areas": [
    {
      "id": "dqxic4sui",                    // unique identifier
      "label": "main_bet",                  // area label
      "polygon": [                          // polygon coordinates, normalised
        [0.128, 0.36], [0.21, 0.36], [0.21, 0.45], [0.128, 0.45]
      ],
      "visible": true,
      "createdAt": "..."
    }
  ]
}
```

`image` is embedded so a consumer can reconstruct pixel coordinates without
knowing which frame was calibrated, and `coordinateSystem` is written into every
file so the format is self-describing rather than relying on this README.

## Technical approach

**Stack:** React 18 + TypeScript + Vite, Zustand for state. No canvas, geometry
or UI libraries.

**SVG, not `<canvas>`.** The regions are a handful of polygons with handles, not
a high-frequency render loop. SVG gives hit-testing, hover states, cursors and
crisp strokes at any zoom for free, and stays inspectable in devtools. Canvas
would have meant hand-rolling picking and redraw for no benefit at this scale.

**Coordinates converted in JS, not by an SVG `viewBox`.** A `ResizeObserver` on
the stage computes the contain-fit box for the image, and normalised points are
multiplied into screen pixels at render time. A normalised viewBox would have
been less code but scales stroke widths and handle radii with the image, so
anchors would be sub-pixel dots on a large display and blobs on a small one, and
the 9px grab threshold would mean a different physical distance at every window
size. Hit radii and handle sizes are specified in real pixels instead.

**One flat store.** All editor state — areas, tool, draft polygon, selection,
edit mode, clipboard, pending deletion — lives in a single Zustand store, so the
canvas and the layer panel are two views of the same state and selection sync
between them is automatic rather than plumbed through props.

**Interaction state is explicit.** `draft` (mid-drawing), `selectedIds`
(bounding box + badge) and `editingId` (draggable anchors) are separate fields
rather than one overloaded mode enum, which is what makes the design's three
distinct polygon appearances fall out directly. Selection is a list so regions
can be copied, moved and deleted in bulk; anchor editing stays single-region.

**Clipboard is in-app first.** Copy mirrors regions to the OS clipboard as JSON
so they survive across tabs, but paste reads the in-app clipboard whenever it has
contents. Reading the system clipboard can block on a permission prompt or never
settle when the page isn't focused, which makes paste feel broken.

**Labels are configuration.** `src/config.ts` holds the catalogue with colours
and required counts; adding a category is a one-line change with no component
edits. In production this would be fetched per table type.

### Tradeoffs

- **Zustand over Redux/Context** — one screen, frequent pointer-driven updates.
  Selector-level subscriptions without a reducer layer that wouldn't earn its keep.
- **No undo/redo** — the largest thing I'd add next. The action-shaped store
  methods are the seam a command history would slot into.
- **Geometry written by hand** — point-in-polygon, bounding box, midpoints and
  group clamping are ~60 lines. A library would have added a dependency for less
  code than it saved.
- **`localStorage` as the fake backend** — work survives a reload without
  pretending to be a real persistence layer.

### Layout

```
src/
  components/
    CanvasStage.tsx   drawing, selection, marquee, anchor editing, rendering
    LabelPanel.tsx    LABEL — category picker + completion counts
    LayerPanel.tsx    LABELLED AREA — grouped list, search, multi-select, visibility
    ConfirmDialog.tsx delete confirmation
    Toolbar.tsx       select / polygon tools
  lib/
    geometry.ts       point-in-polygon, bbox, midpoints, group clamping, ids
    clipboard.ts      copy/paste envelope + OS clipboard interop
    persistence.ts    calibration file build / download / localStorage
  store.ts            single Zustand store
  config.ts           label catalogue, camera id, image metadata
  types.ts            domain types + coordinate format documentation
```

## Assumptions

1. **`main_bet 3/7` means "3 drawn of 7 required."** The red warning icon on an
   incomplete count supports this, so required counts live in the label config
   (7 betting spots, 1 chip tray) and drive the warning state.
2. **The two toolbar icons are select and polygon** — the design shows exactly
   two, and the notes only describe polygon drawing.
3. **"Click the label to switch category" refers to the id badge** on a selected
   polygon, the only label attached to a region on the canvas.
4. **The tool stays armed after closing a polygon** — an operator drawing seven
   betting spots shouldn't re-arm the tool seven times.
5. **Minimum three vertices** for a valid region.
6. **Hidden regions can't be deleted** — the design greys out the trash on a
   hidden row, so it's disabled rather than merely styled.
7. **Group headers act on the whole label** (hide all / delete all / select all).
8. **The background is a still frame** cropped from the Figma mock and served as
   a static asset; a real tool would pull a frame from the camera.
9. **Ids are random 9-character strings**, matching the design's style
   (`23wpfu238`). A real system would use server-issued ids.

### Product questions

- **Are the seven betting spots distinct labelled positions (`main_bet_1` …
  `main_bet_7`), or interchangeable instances of one category?** The numbered
  index badges hint at the former. I assumed the latter and kept ids
  machine-generated. This is also why regions aren't renameable: if seat position
  is meaningful to the model it belongs in the label taxonomy or an explicit
  `position` field, not an operator's free-text string — and a rename box would
  quietly commit to the wrong answer while also making the required unique
  identifier editable.
- **Who owns the label catalogue** — is it fixed per table type by the backend,
  or can an operator define new categories during calibration? I assumed the
  former, which is why there's no add-label UI.
- **Should regions be constrained** to be convex or non-self-intersecting?
  Nothing currently stops an operator drawing a bowtie.
- **Can regions overlap?** Chip trays and bet spots plausibly shouldn't.
- **Is an incomplete calibration saveable?** Currently yes, with a warning —
  blocking it seems wrong for a long, interruptible task.
- **What happens when the camera moves?** Is there a re-calibration flow that
  preserves labels and only adjusts geometry?

## Known limitations

- **No undo/redo.**
- **No zoom or pan** — fine work on small regions is harder than it should be,
  and a zoomable viewport is the next thing an operator would ask for.
- **No self-intersection or overlap validation.**
- **Bounding-box handles are decorative** — they render the design's selected
  state but don't scale the polygon; reshaping is via anchor editing.
- **Marquee uses bounding-box intersection**, catching anything the box touches
  rather than only fully-enclosed regions. That matches most design tools, but a
  large concave region can be caught by a box that never overlaps its fill.
- **Relabelling is one region at a time** — the id badge is the entry point and
  only shows on a single selection, since badges would stack illegibly.
- **Copy/paste and multi-select are keyboard-driven**; there's no context menu.
- **Search matches ids and label names only** — regions have no name field.
- **Touch is untested.** Pointer events are used throughout so it should largely
  work, but no touch-specific affordances were added.
- **No automated tests.** Given the time budget I verified behaviour by driving
  the running app in a real browser and asserting on the resulting DOM and
  exported JSON — including that saved coordinates match on-screen geometry to
  within 0.02px. The pure functions in `lib/geometry.ts` are where I'd start
  with unit tests.
- **Accessibility is partial.** Buttons are labelled and the dialog is a proper
  `alertdialog`, but the canvas is pointer-only.

## Time spent

~4 hours, including verification and this README.

## AI tools used

I used **Claude Code (Claude Opus 5)** as an implementation tool, plus editor
autocomplete. I planned the work and made the product and architecture calls —
stack, SVG-over-image approach, normalised coordinate format, the single-store
state model, how selection and edit modes decompose, what belongs in config
versus the export schema — and directed the AI to build to those decisions,
reviewing and correcting the output as it went. Everything here is code I
understand and can walk through.

**How I used it**

- **Design extraction** — the Figma MCP server needed an OAuth round-trip, so I
  had it read the four exported frames directly and enumerate every interaction
  state the two annotation sheets specify (anchor-point states, line colours,
  selection vs. edit mode, layer-panel hover/delete/visibility behaviour).
- **Implementation** — scaffolding, the SVG canvas component, the panels, the
  CSS, to the architecture I'd set.
- **Verification** — driving the running app through Chrome DevTools to exercise
  drawing, anchor editing, multi-select, copy/paste and delete, then asserting
  on the DOM and the exported JSON.

**Representative prompts**

- "Read these four exported Figma frames and list every interaction state the
  notes specify."
- "Build the calibration screen: React + TS + Vite, SVG overlay on the table
  image, Zustand store, polygon and select tools."
- "Implement the draft-polygon states from the notes: hollow anchors, filled last
  anchor, light-blue rubber-band line, blue committed segments, close by clicking
  the first point."
- "Selection should be a list, not a single id — I want multi-select and bulk
  delete in one confirmation."
- "Drive the app in Chrome and verify drawing, edit mode, vertex insertion,
  delete confirmation and the saved JSON."

**Where I changed, corrected or rejected a suggestion**

The main one was architectural. The first canvas implementation rendered the SVG
with a normalised `viewBox="0 0 1 1"` and expressed everything in 0–1 units —
elegant, and it makes the coordinate conversion disappear. I rejected it: a
normalised viewBox scales stroke widths and handle radii along with the image, so
anchor points would render as sub-pixel dots on a large monitor and blobs on a
small one, and the 9-pixel grab threshold for closing a polygon would mean a
different physical distance at every window size. I had it replaced with a
`ResizeObserver` that measures the stage and converts normalised points to screen
pixels in JS, so hit radii and handle sizes are specified in real pixels. That
decision is why the coordinate conversion lives in `CanvasStage.tsx` rather than
in the markup.

Two more worth recording:

- A refactor extracting a `capturePointer` helper was applied as a blind
  find-and-replace, which also matched the line *inside the new helper's own
  body* and rewrote it to call itself — infinite recursion on every drag.
  `tsc --noEmit` passed, because infinite recursion is perfectly well-typed. I
  caught it by reading the diff rather than trusting the green typecheck.
- The first clipboard implementation always read the OS clipboard on paste.
  Paste silently did nothing, because `navigator.clipboard.readText()` never
  settles when the page lacks focus or permission. I made the in-app clipboard
  the fast path and demoted the OS clipboard to the cross-tab fallback.

I also turned down two AI-suggested additions as scope creep against the design:
an add-label UI and a rename-layer field. Both invent product surface the Figma
doesn't have, and the rename in particular would have made the required unique
identifier editable while pre-empting a taxonomy decision that isn't mine to
make — see the product questions above.
