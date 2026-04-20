# Changelog

## [1.3.0.0] - 2026-04-21

### Added

- **Zoom-responsive drawings and notes** — rectangles, ellipses, freehand strokes, and sticky notes now reposition and resize proportionally when the zoom level changes. Line widths scale with the page. All coordinates are stored as fractions of the canvas/page dimensions (same model highlights already used).
- **`reapplyNotes()`** (JS) — internal helper called from `rerenderAllPages` to re-position note icons after zoom/rotation changes.

### Fixed

- **`DocumentLoaded` fired before page DOMs existed** — the event was sent from `documentLoaded()` in JS *before* `renderAllPages()` ran. A Clarion handler that called `ImportAnnotationsData` on the event saw only `page-1` in the DOM (created synchronously before the first `await`); notes for pages 2+ were silently dropped by `placeNote`'s `if (!pageEl) return` guard. The event now fires *after* all pages have rendered.
- **Note edit popup consumed cursor-positioning clicks** — double-clicking a note opened the edit popup correctly, but clicking inside the textarea to position the cursor bubbled up to the viewer's click handler. If note mode was still active, the bubble triggered a fresh "Add Note" popup that replaced the edit popup. Popups now `stopPropagation()` on their own click events.

### Changed (BREAKING — annotation JSON format)

- **Stored coordinates are now fractions `[0..1]` of canvas/page size**, not absolute pixels. Affects drawings (`drawingHistory`) and notes (`annotations[].fx`/`.fy`):
  - Drawings: rect/circle use `fx1, fy1, fx2, fy2` (was `x1, y1, x2, y2`); freehand points use `{fx, fy}` (was `{x, y}`); line width is `fwidth` (was `width`).
  - Notes: `fx, fy` (was `x, y`).
- Annotation JSON saved by 1.2.x will render incorrectly in 1.3.0.0 (old pixel values interpreted as fractions collapse into the top-left). Delete and re-create existing annotations, or run a one-off conversion script.

### Resolved

- **Annotation persistence bleed (disk-load after blob-load)** — was not a control bug. Diagnosed in testing as a workflow artifact: integrators that funnel every load through `LoadBase64Data` (disk, blob, eInvoice.xml attachments) cannot rely on `LoadType` to distinguish annotation ownership. The fix is Clarion-side — track an `AnnotSourceKey` that maps to the owning record's GUID and guard `ImportAnnotationsData` on it. See *Clarion-Integration-Guide.md* § 12.

### Notes

- GUIDs unchanged — drop-in replacement for 1.2.x at the COM-dispatch level, but annotation JSON is not forward-compatible.

---

## [1.2.1.0] - 2026-04-16

### Added

- **Drawing passive select / move / delete** — users can now click any drawn stroke (freehand, rectangle, circle) to select it without entering Draw mode first. Cursor changes to "move" on hover. Drag to reposition. Right-click on a stroke deletes it (browser context menu still shows for empty page area).
- **Note double-click → edit** — double-clicking an existing note opens the same Save/Cancel popup used at creation, pre-filled with the current text. Save updates both the note's stored text and its tooltip.

### Fixed

- **Documentation: `.GetLong()` / `.GetReal()` references** — `Clarion-Integration-Guide.md` previously claimed `UltimateCOM.ParmN.GetLong()` and `.GetReal()` accessors existed. They are not present in current builds (calling them yields `Unknown function label and Field not found: GETLONG`). All event examples now use `.GetValue()`, which Clarion coerces to the receiving variable's type.

### Corrections to previously-published 1.2.1.0 release notes

- **`GetPageCount` entry was misfiled as "Known Issue"** — this was never a new bug; it is the documented dispatch pattern. Page count and current page are delivered as event payloads (`Parm1`), not read back via method calls inside the handler. See the 1.2.0.0 note below.

### Known Issues (documented, not fixed)

- **Annotation persistence on disk-load after blob-load** — when the control is loaded from a blob (with annotations restored) and the user then loads a different PDF from disk, annotations from the previous blob load persist visually under the new document. Workaround confirmed: call `PDFViewerCOM_Ctrl{'ClearAnnotations'}` **after** `DocumentLoaded` (e.g., from a separate action). Running it as the first statement inside the `DocumentLoaded` handler does not clear the bleed, likely due to render-ordering. See `Clarion-Integration-Guide.md` § 12.

### Notes

- GUIDs unchanged — drop-in replacement for 1.2.0.0.
- No new COM methods or events were added.

---

## [1.2.0.0] - 2026-04-12

### Added

- **`AnnotationsExported` event (DispId 18)** — fired when `ExportAnnotations()` completes. Parm1 contains the full annotation JSON with highlights, notes, and drawing strokes.
- **`ExportAnnotations()` (DispId 55)** — now triggers the JS export asynchronously; result delivered via `AnnotationsExported` event.
- **`SourceBase64` property (DispId 103)** — returns the original PDF bytes as a Base64 string (from `LoadFile` or `LoadBase64`). Use alongside annotation JSON to enable editable round-trips.
- **`AnnotationsData` property (DispId 104)** — holds annotation JSON for `ImportAnnotationsData()`. Set this before calling the method.
- **`ImportAnnotationsData()` method (DispId 105)** — imports annotations from the `AnnotationsData` property. Clarion-friendly alternative to `ImportAnnotations()`.
- **`LoadType` property (DispId 106)** — returns `'base64'`, `'file'`, or `'url'` depending on how the current document was loaded. Use in `DocumentLoaded` handler to guard annotation restore (`if LoadType = 'base64'`).

### Fixed

- **Drawing/highlight bleed** — annotations and drawings from a previously loaded document no longer appear on a newly loaded document. `documentLoaded()` in JS now clears `annotations` and `drawingHistory` at the start of each load.
- **`LoadType` always returning `'base64'`** — `LoadType` now correctly reflects the actual load method. Previously it always defaulted to `'base64'` because the JS never sent the load type back.

### Documented (event-payload access for page metadata)

- **Reading `pageCount` / `currentPage` from inside event handlers** — these values are delivered as event arguments, not via method round-trips inside the handler:
  - `DocumentLoaded` → `PageTotal = PDFViewerCOM.Parm1.GetValue()`
  - `PageChanged`   → `CurrentPage = PDFViewerCOM.Parm1.GetValue()`

  Calling `GetPageCount()` (or equivalent) from inside `DocumentLoaded` returns 0 because the COM property is snapshotted before the JS render completes. Always read from `Parm1` inside the handler; `GetPageCount()` is still valid outside the event.

### Notes

- GUIDs are unchanged — drop-in replacement for 1.1.0.0.
- Clarion round-trip pattern: load base64 PDF → handle `DocumentLoaded` → if `LoadType = 'base64'` → call `ImportAnnotationsData`.

---

## [1.1.0.0] - 2026-04-03

### Added

- **`Base64Data` property (DispId 99)** — set before calling `LoadBase64Data`. Enables loading PDFs from StringTheory / Blob fields without using `ExecuteScript`.
- **`LoadBase64Data` method (DispId 100)** — loads the PDF from the `Base64Data` property. Automatically strips MIME-format line breaks that StringTheory's `EncodeBase64()` inserts every 76 characters.
- **`SidebarVisible` property (DispId 101)** — get/set sidebar visibility. Real COM property (same pattern as `AllowHighlight`); can be set in `EVENT:OpenWindow` before `ViewerReady` fires. Applied automatically at viewer initialization.
- **`AnnotationsEnabled` property (DispId 102)** — get/set annotation UI visibility. Same semantics as `SidebarVisible`.

### Fixed

- **StringTheory base64 loading** — `LoadBase64` now strips `\r\n` line breaks before passing to `ExecuteScriptAsync`. Previously, MIME-formatted base64 from StringTheory caused a silent JavaScript syntax error and the PDF never loaded.
- **`SidebarVisible` / `AnnotationsEnabled` pre-ViewerReady** — calling these before the viewer was ready stored the preference but the JS call was silently dropped. A new `ApplyInitialViewerState()` call at ViewerReady now applies any stored preferences automatically.
- **`SetSidebarVisible` / `SetAnnotationsEnabled` via Clarion `= value` syntax** — the old void-method form could not be called via Clarion's `DISPATCH_PROPERTYPUT` dispatch. Use the new `SidebarVisible` / `AnnotationsEnabled` properties instead.
- **Clarion-Integration-Guide.md** — updated Recipe 4 (StringTheory blob round-trip), added gotchas for `DISPATCH_PROPERTYPUT` dispatch rules and MIME base64 line breaks.

### Notes

- GUIDs are unchanged — this is a drop-in replacement for 1.0.3.0.
- After copying the new DLL to your application folder, no Clarion source changes are required unless you use the new API.

---

## [1.0.3.0] - Initial release

- Full PDF rendering via PDF.js
- Load from file path, URL, or Base64
- Page navigation, zoom, rotation, search
- Annotations: highlights, notes, freehand drawing
- Sidebar: thumbnails and bookmarks
- Print and SaveAsBase64 (flattened output)
- 17 COM events
- Registration-free COM (manifest-based)
