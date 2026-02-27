# PDFViewerCOM

A full-featured PDF viewer COM control for [Clarion](https://www.softvelocity.com/) applications, powered by WebView2 and [PDF.js](https://mozilla.github.io/pdf.js/). Registration-free COM — no registry entries needed.

Built with the [ClarionCOM](https://github.com/peterparker57/ClarionCOM) framework.

---

## Features

- **PDF Rendering** — High-quality rendering via Mozilla's PDF.js
- **Multiple Load Sources** — Open PDFs from file paths, URLs, or Base64-encoded data
- **Page Navigation** — Go to any page, next/previous, first/last
- **Zoom Controls** — Zoom in/out, fit width, fit page, actual size, custom percentage
- **Text Search** — Find text with case sensitivity, navigate between matches
- **Annotations** — Highlights, sticky notes, freehand drawing with import/export (JSON)
- **Sidebar** — Thumbnail previews and document bookmarks/outline
- **Page Rotation** — Clockwise and counter-clockwise rotation
- **Print & Save** — System print dialog and save-as with annotations
- **Text Selection** — Select and copy text from PDFs
- **Registration-Free COM** — Manifest-based activation, no `regasm` needed
- **16 COM Events** — Rich event model for full Clarion integration

---

## Requirements

| Component | Version |
|---|---|
| .NET Framework | 4.7.2 |
| WebView2 Runtime | [Evergreen](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) |
| Platform | Windows x86 (32-bit) |
| Clarion | 11.x+ (or any COM host) |

---

## Quick Start

### 1. Build

```
msbuild PDFViewerCOM.csproj /p:Configuration=Release /p:Platform=x86
```

### 2. Deploy

Copy these to your Clarion application folder:

| Files | Description |
|---|---|
| `PDFViewerCOM.dll` | The COM control |
| `PDFViewerCOM.manifest` | Registration-free COM manifest |
| `wwwroot/` | PDF.js viewer assets (HTML, CSS, JS) |
| `Microsoft.Web.WebView2.*.dll` | WebView2 SDK |
| `Newtonsoft.Json.dll` | JSON serialization |

### 3. Use in Clarion

```
PROGRAM
  MAP
  END

  INCLUDE('CWCOM.INC'),ONCE

PDFViewer   OCX('PDFViewerCOM.PDFViewerCOMControl')

  CODE
  ! Wait for ViewerReady event, then:
  PDFViewer{'LoadFile'}('C:\Documents\sample.pdf')
```

> **Tip:** Use the `ViewerReady` event (not `ControlReady`) before calling `LoadFile`, `LoadUrl`, or `LoadBase64`.

---

## API Reference

### Document Operations

| Method | Description |
|---|---|
| `LoadFile(filePath)` | Load a PDF from a local file path |
| `LoadUrl(url)` | Load a PDF from a URL |
| `LoadBase64(base64Data)` | Load a PDF from Base64-encoded data |
| `CloseDocument()` | Close the current document |
| `SaveAs(filePath)` | Save the PDF (with annotations) to a file |
| `Print()` | Open the system print dialog |

### Navigation

| Method | Description |
|---|---|
| `GoToPage(pageNumber)` | Jump to a specific page (1-based) |
| `NextPage()` | Go to the next page |
| `PreviousPage()` | Go to the previous page |
| `FirstPage()` | Jump to the first page |
| `LastPage()` | Jump to the last page |

### Zoom

| Method | Description |
|---|---|
| `ZoomIn()` | Zoom in by a standard increment |
| `ZoomOut()` | Zoom out by a standard increment |
| `SetZoom(percentage)` | Set zoom to a specific percentage (e.g., `150` for 150%) |
| `FitWidth()` | Fit the page width to the viewer |
| `FitPage()` | Fit the entire page in the viewer |
| `ActualSize()` | Reset zoom to 100% |
| `GetZoomLevel()` | Get current zoom level (1.0 = 100%) |
| `SetZoomLevel(value)` | Set zoom level directly (1.0 = 100%) |

### Search

| Method | Description |
|---|---|
| `Search(text, caseSensitive)` | Search for text in the document |
| `FindNext()` | Navigate to the next match |
| `FindPrevious()` | Navigate to the previous match |
| `ClearSearch()` | Clear search highlighting |

### Annotations

| Method | Description |
|---|---|
| `HighlightSelection(color)` | Highlight selected text (e.g., `"#FFFF00"`) |
| `AddNote(page, x, y, text)` | Add a sticky note at a position |
| `EnableDrawing(color, width)` | Start freehand drawing mode |
| `DisableDrawing()` | Stop drawing mode |
| `ClearAnnotations()` | Delete all annotations on the current page |
| `ExportAnnotations()` | Export all annotations as JSON |
| `ImportAnnotations(json)` | Import annotations from JSON |
| `GetAnnotationsEnabled()` | Check if annotations are enabled |
| `SetAnnotationsEnabled(value)` | Enable or disable annotations |

### View Options

| Method | Description |
|---|---|
| `ToggleSidebar()` | Toggle the sidebar panel |
| `ShowThumbnails()` | Show page thumbnails in the sidebar |
| `ShowBookmarks()` | Show document outline/bookmarks in the sidebar |
| `RotateClockwise()` | Rotate the page 90° clockwise |
| `RotateCounterClockwise()` | Rotate the page 90° counter-clockwise |
| `GetSidebarVisible()` | Check if sidebar is visible |
| `SetSidebarVisible(value)` | Show or hide the sidebar |

### State

| Method | Returns | Description |
|---|---|---|
| `GetIsReady()` | `bool` | Whether WebView2 is initialized |
| `GetLastError()` | `string` | Last error message |
| `GetSource()` | `string` | Current PDF source (path or URL) |
| `GetCurrentPage()` | `int` | Current page number (1-based) |
| `GetPageCount()` | `int` | Total number of pages |

### Advanced

| Method | Description |
|---|---|
| `Navigate(url)` | Navigate WebView2 to any URL |
| `Refresh()` | Reload the current page |
| `ExecuteScript(script)` | Execute arbitrary JavaScript |
| `PostMessage(message)` | Send a message to JavaScript |
| `About()` | Show control version info |

---

## Events

| Event | Parameters | Description |
|---|---|---|
| `ViewerReady` | — | PDF.js is initialized and ready to load documents |
| `ControlReady` | — | WebView2 runtime is initialized |
| `DocumentLoaded` | `pageCount`, `title` | A PDF was loaded successfully |
| `PageChanged` | `pageNumber` | The current page changed |
| `ZoomChanged` | `zoomLevel` | The zoom level changed |
| `SearchCompleted` | `matchCount`, `currentMatch` | A search finished |
| `AnnotationAdded` | `annotationType`, `pageNumber` | An annotation was created |
| `AnnotationSelected` | `annotationId`, `annotationType` | An annotation was clicked |
| `TextSelected` | `selectedText`, `pageNumber` | Text was selected |
| `BookmarkClicked` | `title`, `pageNumber` | A bookmark was clicked |
| `ThumbnailClicked` | `pageNumber` | A thumbnail was clicked |
| `LinkClicked` | `url`, `isInternal` | A link in the PDF was clicked |
| `NavigationStarting` | `url` | WebView2 navigation started |
| `NavigationCompleted` | `url`, `success` | WebView2 navigation finished |
| `PrintCompleted` | `success` | Print operation finished |
| `ErrorOccurred` | `errorMessage` | An error occurred |

---

## Technical Details

| | |
|---|---|
| **ProgID** | `PDFViewerCOM.PDFViewerCOMControl` |
| **Class GUID** | `{2193ddb6-df52-40bc-a41c-b0f0788963a7}` |
| **Interface GUID** | `{fb694e21-68af-4a45-907e-88867de9fd93}` |
| **Events GUID** | `{b5cd456b-4dda-4097-9880-57a41ac16ecf}` |
| **Threading** | Apartment (STA) |
| **COM Activation** | Registration-free (manifest-based) |

---

## Project Structure

```
PDFViewerCOM/
  IPDFViewerCOMControl.cs       # COM interface (methods)
  IPDFViewerCOMControlEvents.cs # COM events interface
  PDFViewerCOMControl.cs        # Control implementation
  PDFViewerCOM.manifest         # RegFree COM manifest
  PDFViewerCOM.csproj           # Project file
  Properties/
    AssemblyInfo.cs             # Assembly metadata & GUIDs
  wwwroot/
    controls/pdfviewercom/      # PDF.js viewer (HTML + JS)
    css/                        # Viewer styles
    lib/                        # Third-party libraries (PDF.js)
    js/                         # Shared JavaScript
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.
