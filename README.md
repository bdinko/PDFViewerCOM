# PDFViewerCOM

> A full-featured, registration-free PDF viewer COM control for [Clarion](https://www.softvelocity.com/) and any COM host — powered by WebView2 and Mozilla [PDF.js](https://mozilla.github.io/pdf.js/).

![Version](https://img.shields.io/badge/version-1.3.0.0-blue)
![.NET](https://img.shields.io/badge/.NET-4.8-512bd4)
![Platform](https://img.shields.io/badge/platform-Windows%20x86-informational)
![License](https://img.shields.io/badge/license-MIT-green)

Built with the [ClarionCOM](https://github.com/peterparker57/ClarionCOM) framework. No `regasm`, no registry writes — drop the DLL + manifest next to your EXE and it just works.

---

## Why PDFViewerCOM

Existing PDF options for Clarion are either ActiveX remnants of the 2000s or external processes you have to shell out to. PDFViewerCOM renders inside your window, speaks COM like any OCX, and ships a modern viewer (zoom, search, annotations, thumbnails, bookmarks) without asking users to install Acrobat.

If you need **editable PDF annotations that survive a save-and-reload cycle** — highlights, sticky notes, freehand drawings that your users can delete later — that's a first-class feature (v1.3.0.0).

---

## Features

### Rendering & Navigation
- PDF rendering via Mozilla PDF.js (no Adobe runtime)
- Load from **file path, URL, Base64, or Clarion BLOB** (via StringTheory)
- Page nav: first / last / next / previous / go-to-page
- Zoom: in / out / fit-width / fit-page / actual size / custom %
- 90° rotation (both directions)
- Text selection + copy
- Text search with case-sensitivity and find-next / find-previous
- Sidebar with **thumbnails** and document **bookmarks / outline**

### Annotations (editable round-trip)
- **Highlights** — any selected text, any colour
- **Sticky notes** — click-to-place, double-click to edit
- **Freehand drawing** — pen, rectangle, ellipse with colour + width
- **Select / move / delete** strokes without re-entering draw mode
- **Zoom-responsive** — everything reflows proportionally at any zoom level (v1.3.0.0)
- **Import / export as JSON** — store annotations separately from the PDF bytes (`SourceBase64`) and reload with full editability
- **Per-feature permission flags** — `AllowHighlight`, `AllowNotes`, `AllowDrawing`, `AllowSaveAs` for role-based UIs

### Persistence
- `SaveAs` — original bytes to disk
- `SaveAsBase64` — current view with annotations **flattened** (for archival / printing)
- `ExportAnnotations` + `SourceBase64` — editable round-trip (store the two separately; reload with annotations intact and still editable)

### COM Integration
- **18 COM events** — `ViewerReady`, `DocumentLoaded`, `PageChanged`, `ZoomChanged`, `AnnotationAdded`, `TextSelected`, `SaveAsBase64Ready`, `AnnotationsExported`, etc.
- **Registration-free activation** via side-by-side manifest
- **Apartment (STA) threading** — safe for Clarion window threads
- **Print** — opens the system print dialog

---

## Requirements

| Component | Version |
|---|---|
| .NET Framework | 4.8 (bundled with Windows 10/11) |
| WebView2 Runtime | [Evergreen Bootstrapper](https://developer.microsoft.com/microsoft-edge/webview2/) |
| Platform | Windows, x86 (32-bit) |
| Host | Clarion 11.x+ or any COM host |

---

## Quick Start

### 1. Download a release

Grab the latest build from [**Releases**](https://github.com/bdinko/PDFViewerCOM/releases). You'll get:

- `PDFViewerCOM.dll` — the control
- `PDFViewerCOM.manifest` — side-by-side COM manifest
- `wwwroot/` — the PDF.js viewer assets
- WebView2 SDK + `Newtonsoft.Json.dll`

Or build from source:

```bash
msbuild PDFViewerCOM/PDFViewerCOM.csproj /p:Configuration=Release /p:Platform=x86
```

### 2. Deploy

Copy everything to your Clarion app folder (next to the `.EXE`):

```
YourApp.exe
YourApp.exe.manifest                    # references PDFViewerCOM via <dependency>
PDFViewerCOM.dll
PDFViewerCOM.manifest
Microsoft.Web.WebView2.Core.dll
Microsoft.Web.WebView2.WinForms.dll
WebView2Loader.dll
Newtonsoft.Json.dll
wwwroot/
  controls/pdfviewercom/...
  css/...
  lib/pdfjs/...
```

### 3. Use it in Clarion

```clarion
PROGRAM
  INCLUDE('CWCOM.INC'),ONCE

PDFViewer          UltimateCOM                   ! event-routing helper
PDFViewer_Ctrl     LONG                          ! OLE control field — dispatch target
PDFViewer_Event    EQUATE(Event:User + 2000 + ?UltimateCOM)

  CODE
  ! EVENT:OpenWindow:
  PDFViewer_Ctrl = ?UltimateCOM
  PDFViewer_Ctrl{PROP:Create} = 'PDFViewerCOM.PDFViewerCOMControl'
  PDFViewer.SetUCPostEvent(PDFViewer_Event)
  PDFViewer.RegisterEventFunc(PDFViewer_Ctrl)

  ! after ViewerReady fires:
  PDFViewer_Ctrl{'FilePath'} = 'C:\Documents\sample.pdf'
  PDFViewer_Ctrl{'LoadFilePath'}
```

> **Wait for `ViewerReady`** (not `ControlReady`) before calling any `Load*` method. Full patterns — including BLOB loads, annotation round-trips, and the `AnnotSourceKey` ownership pattern — are in the [Clarion Integration Guide](PDFViewerCOM/Clarion-Integration-Guide.md).

### Try the demo app

A working Clarion example lives in [`Example/School/`](Example/School) — open `SCHOOL.APP` in the Clarion IDE to see the control in a real window.

---

## Documentation

| Document | What's in it |
|---|---|
| [**API Reference**](PDFViewerCOM/README.md) | Every method, property, event — with DispIds, parameters, return types |
| [**Clarion Integration Guide**](PDFViewerCOM/Clarion-Integration-Guide.md) | Calling patterns, event handling, BLOB round-trips, annotation ownership (§ 12), gotchas |
| [**CHANGELOG**](CHANGELOG.md) | What changed in every release |

---

## Repository Layout

```
PDFViewerCOM/                   # C# source (control, interfaces, manifest)
  wwwroot/                      # PDF.js viewer (HTML + JS + CSS)
  Clarion-Integration-Guide.md
  README.md                     # detailed API reference
Clarion/accessory/              # drag-and-drop deploy for Clarion installs
  bin/                          # compiled DLL + WebView2 deps
  resources/                    # manifest, metadata, HTML docs, wwwroot
Example/School/                 # Clarion demo app (SCHOOL.APP)
CHANGELOG.md
LICENSE
```

---

## Technical Details

| | |
|---|---|
| **ProgID** | `PDFViewerCOM.PDFViewerCOMControl` |
| **Class GUID** | `{2193ddb6-df52-40bc-a41c-b0f0788963a7}` |
| **Interface GUID** | `{fb694e21-68af-4a45-907e-88867de9fd93}` |
| **Events GUID** | `{b5cd456b-4dda-4097-9880-57a41ac16ecf}` |
| **Threading** | Apartment (STA) |
| **Activation** | Registration-free (side-by-side manifest) |

---

## License

[MIT](LICENSE) — commercial use, modification, and redistribution permitted.

---

## Credits

- [PDF.js](https://mozilla.github.io/pdf.js/) — Mozilla
- [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) — Microsoft
- [ClarionCOM](https://github.com/peterparker57/ClarionCOM) — framework for RegFree COM in Clarion
- [StringTheory](https://www.capesoft.com/accessories/stringtheorysp.htm) — BLOB round-trips (CapeSoft)
