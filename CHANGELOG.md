# Changelog

## [1.2.1.0] - 2026-04-16

### Added

- **Drawing passive select / move / delete** — users can now click any drawn stroke (freehand, rectangle, circle) to select it without entering Draw mode first. Cursor changes to "move" on hover. Drag to reposition. Right-click on a stroke deletes it (browser context menu still shows for empty page area).
- **Note double-click → edit** — double-clicking an existing note opens the same Save/Cancel popup used at creation, pre-filled with the current text. Save updates both the note's stored text and its tooltip.

### Fixed

- **Documentation: `.GetLong()` / `.GetReal()` references** — `Clarion-Integration-Guide.md` previously claimed `UltimateCOM.ParmN.GetLong()` and `.GetReal()` accessors existed. They are not present in current builds (calling them yields `Unknown function label and Field not found: GETLONG`). All event examples now use `.GetValue()`, which Clarion coerces to the receiving variable's type.

### Known Issues (documented, not fixed)

- **Annotation persistence on disk-load after blob-load** — when the control is loaded from a blob (with annotations restored) and the user then loads a different PDF from disk, annotations from the previous blob load persist visually under the new document. Workaround: close & reopen the window between loads. See `Clarion-Integration-Guide.md` § 12.
- **`GetPageCount` returns 0 inside `DocumentLoaded` event handler** — read the page count from `PDFViewerCOM.Parm1.GetValue()` instead. `GetPageCount` works correctly outside the event. See `Clarion-Integration-Guide.md` § 12.

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
