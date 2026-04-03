# PDFViewerCOM — Clarion Integration Guide

This guide covers everything needed to manually add PDFViewerCOM to a Clarion window procedure, handle its events, and call its methods. It is also the reference used by the Clarion IDE assistant when generating embed code.

---

## Table of Contents

1. [Prerequisites & Deployment](#1-prerequisites--deployment)
2. [Control Naming Convention](#2-control-naming-convention)
3. [Adding the Control to a Window Procedure](#3-adding-the-control-to-a-window-procedure)
4. [Complete Embed Point Reference](#4-complete-embed-point-reference)
5. [Methods Reference — Clarion Calling Syntax](#5-methods-reference--clarion-calling-syntax)
6. [Properties Reference](#6-properties-reference)
7. [Events Reference — Handler Patterns](#7-events-reference--handler-patterns)
8. [Common Recipes](#8-common-recipes)
9. [Clarion Type Mappings](#9-clarion-type-mappings)
10. [Critical Rules & Gotchas](#10-critical-rules--gotchas)

---

## 1. Prerequisites & Deployment

### Required files (copy to your application's output folder)

| File | Location |
|------|----------|
| `PDFViewerCOM.dll` | `accessory\bin\` |
| `PDFViewerCOM.manifest` | `accessory\resources\` |
| `Microsoft.Web.WebView2.Core.dll` | `accessory\bin\` |
| `Microsoft.Web.WebView2.WinForms.dll` | `accessory\bin\` |
| `Microsoft.Web.WebView2.Wpf.dll` | `accessory\bin\` |
| `Newtonsoft.Json.dll` | `accessory\bin\` |
| `WebView2Loader.dll` | `accessory\bin\` |
| `wwwroot\` (entire folder) | `accessory\resources\wwwroot\` |

**WebView2 Runtime** (Evergreen) must be installed on the target machine.
Download: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### ClarionCOM header inclusion

Add to the top of your `.clw` source or `.app` global data area:

```clarion
INCLUDE('PDFViewerCOM.header'),ONCE
```

---

## 2. Control Naming Convention

ClarionCOM generates three identifiers when you add the control. In this guide the prefix `PDFViewerCOM` is used. Replace it with whatever name you choose in your APP.

| Identifier | Type | Purpose |
|-----------|------|---------|
| `PDFViewerCOM` | `UltimateCOM` | Event routing helper — use for event methods ONLY |
| `PDFViewerCOM_Ctrl` | `LONG` | Field number of the OLE control — use for ALL COM dispatch |
| `PDFViewerCOM_Event` | `EQUATE` | Event ID constant for the SELECT structure |

**CRITICAL:** Never call COM methods through `PDFViewerCOM{...}`. That calls the Clarion `UltimateCOM` class, not the COM object. Always use `PDFViewerCOM_Ctrl{...}`.

---

## 3. Adding the Control to a Window Procedure

### 3a. Data declarations (above the procedure CODE section)

```clarion
PDFViewerCOM          UltimateCOM
PDFViewerCOM_Ctrl     LONG
PDFViewerCOM_Event    EQUATE(Event:User + 2000 + ?UltimateCOM)
```

### 3b. Window structure (in the WINDOW declaration)

Place the OLE control in the window layout:

```clarion
OLE(1,1,200,150),USE(?UltimateCOM),HVSCROLL,FULL
```

Adjust position and size as needed. `HVSCROLL` enables scrollbars inside the control if the PDF is larger than the view. `FULL` stretches the control to fill the parent on resize.

### 3c. EVENT:OpenWindow embed

```clarion
  PDFViewerCOM_Ctrl = ?UltimateCOM
  PDFViewerCOM_Ctrl{PROP:Create} = 'PDFViewerCOM.PDFViewerCOMControl'
  PDFViewerCOM.SetUCPostEvent(PDFViewerCOM_Event)
  PDFViewerCOM.RegisterEventFunc(PDFViewerCOM_Ctrl)
```

### 3d. Event dispatch (in the ACCEPT loop)

Add after the ACCEPT statement, before OF ?UltimateCOM:

```clarion
  OF PDFViewerCOM_Event
    UCProcessCOMEvents_PDFViewerCOM(PDFViewerCOM)
```

Or if using the generated dispatch procedure directly:

```clarion
  OF PDFViewerCOM_Event
    DO UCProcessCOMEvents_PDFViewerCOM
```

### 3e. Full minimal procedure skeleton

```clarion
PdfWindow       PROCEDURE()

PDFViewerCOM          UltimateCOM
PDFViewerCOM_Ctrl     LONG
PDFViewerCOM_Event    EQUATE(Event:User + 2000 + ?UltimateCOM)

  WINDOW('PDF Viewer'),AT(,,640,480),RESIZE,SYSTEM,MAX
    OLE(1,1,638,478),USE(?UltimateCOM),HVSCROLL,FULL
  END

  CODE
  OPEN(WINDOW)

  PDFViewerCOM_Ctrl = ?UltimateCOM
  PDFViewerCOM_Ctrl{PROP:Create} = 'PDFViewerCOM.PDFViewerCOMControl'
  PDFViewerCOM.SetUCPostEvent(PDFViewerCOM_Event)
  PDFViewerCOM.RegisterEventFunc(PDFViewerCOM_Ctrl)

  ACCEPT
    OF PDFViewerCOM_Event
      UCProcessCOMEvents_PDFViewerCOM(PDFViewerCOM)
  END

  CLOSE(WINDOW)
```

---

## 4. Complete Embed Point Reference

### EVENT:OpenWindow — Control initialization

```clarion
  ! Wire up the control
  PDFViewerCOM_Ctrl = ?UltimateCOM
  PDFViewerCOM_Ctrl{PROP:Create} = 'PDFViewerCOM.PDFViewerCOMControl'
  PDFViewerCOM.SetUCPostEvent(PDFViewerCOM_Event)
  PDFViewerCOM.RegisterEventFunc(PDFViewerCOM_Ctrl)

  ! Set permissions BEFORE ViewerReady if you want to restrict features.
  ! (Permissions are also applied automatically at ViewerReady.)
  ! PDFViewerCOM_Ctrl{'AllowSaveAs'}  = 0    ! hide Download button
  ! PDFViewerCOM_Ctrl{'AllowDrawing'} = 0    ! hide Draw button
  ! PDFViewerCOM_Ctrl{'AllowNotes'}   = 0    ! hide Note button
  ! PDFViewerCOM_Ctrl{'AllowHighlight'} = 0  ! hide Highlight button
```

### UCProcessCOMEvents_PDFViewerCOM — Event handler dispatch

This is the central event dispatcher. Add a SELECT on `PDFViewerCOM.EventName`:

```clarion
UCProcessCOMEvents_PDFViewerCOM   PROCEDURE(PDFViewerCOM UltimateCOM)
  CODE
  SELECT(PDFViewerCOM.EventName)

  OF 'ViewerReady'
    ! Safe to load documents now
    PDFViewerCOM_Ctrl{'FilePath'} = clip(SomePdfPath)
    result = PDFViewerCOM_Ctrl{'LoadFilePath'}

  OF 'DocumentLoaded'
    PageCount  = PDFViewerCOM.Parm1.GetLong()   ! total pages (LONG)
    DocTitle   = PDFViewerCOM.Parm2.GetValue()  ! document title (STRING)
    ! Update your UI...

  OF 'PageChanged'
    CurrentPage = PDFViewerCOM.Parm1.GetLong()  ! new page (LONG)

  OF 'ZoomChanged'
    ZoomLevel = PDFViewerCOM.Parm1.GetReal()    ! zoom (REAL, 1.0 = 100%)

  OF 'SearchCompleted'
    MatchCount   = PDFViewerCOM.Parm1.GetLong() ! total matches
    CurrentMatch = PDFViewerCOM.Parm2.GetLong() ! current index (1-based)

  OF 'AnnotationAdded'
    AnnType   = PDFViewerCOM.Parm1.GetValue()   ! 'highlight' | 'note' | 'drawing'
    AnnPage   = PDFViewerCOM.Parm2.GetLong()    ! page number

  OF 'AnnotationSelected'
    AnnId   = PDFViewerCOM.Parm1.GetValue()     ! annotation ID string
    AnnType = PDFViewerCOM.Parm2.GetValue()     ! annotation type string

  OF 'TextSelected'
    SelText = PDFViewerCOM.Parm1.GetValue()     ! selected text
    SelPage = PDFViewerCOM.Parm2.GetLong()      ! page number

  OF 'BookmarkClicked'
    BkTitle = PDFViewerCOM.Parm1.GetValue()     ! bookmark title
    BkPage  = PDFViewerCOM.Parm2.GetLong()      ! destination page

  OF 'ThumbnailClicked'
    ThumbPage = PDFViewerCOM.Parm1.GetLong()    ! clicked page number

  OF 'LinkClicked'
    LinkUrl      = PDFViewerCOM.Parm1.GetValue() ! URL string
    LinkInternal = PDFViewerCOM.Parm2.GetLong()  ! 1 if internal, 0 if external

  OF 'PrintCompleted'
    PrintOk = PDFViewerCOM.Parm1.GetLong()      ! 1 = success, 0 = failed

  OF 'SaveAsBase64Ready'
    ! Called after SaveAsBase64() — flattened annotated PDF
    ST.SetValue(PDFViewerCOM.Parm1.GetValue())  ! base64-encoded flattened PDF

  OF 'AnnotationsExported'
    ! Called after ExportAnnotations() — use for editable round-trips
    AnnotJsonField = PDFViewerCOM.Parm1.GetValue()  ! JSON: { annotations, drawingHistory }
    ! Store AnnotJsonField in a memo/blob field alongside the original PDF

  OF 'ErrorOccurred'
    ErrMsg = PDFViewerCOM.Parm1.GetValue()      ! error description
    MESSAGE('PDF Error: ' & ErrMsg)

  OF 'ControlReady'
    ! WebView2 initialized. Wait for ViewerReady before loading documents.

  OF 'NavigationCompleted'
    NavUrl     = PDFViewerCOM.Parm1.GetValue()  ! URL navigated to
    NavSuccess = PDFViewerCOM.Parm2.GetLong()   ! 1 = success

  OF 'NavigationStarting'
    NavUrl = PDFViewerCOM.Parm1.GetValue()      ! URL being loaded

  END  ! SELECT
```

### Parameter reading methods

| UltimateCOM method | Clarion type | Use when |
|-------------------|-------------|----------|
| `.GetValue()` | `STRING` | STRING parameters (text, URLs, IDs) |
| `.GetLong()` | `LONG` | LONG/BYTE parameters (page numbers, flags) |
| `.GetReal()` | `REAL` | REAL parameters (zoom level) |

---

## 5. Methods Reference — Clarion Calling Syntax

### IMPORTANT rules

- **No parentheses** in the method name string: `{'LoadFilePath'}` not `{'LoadFilePath()'}`
- **No direct parameter passing** from Clarion `{}` syntax — use the property+method pattern for string params
- All calls go through `PDFViewerCOM_Ctrl{...}`, never `PDFViewerCOM{...}`

---

### Document Operations

#### Load from file path

```clarion
PDFViewerCOM_Ctrl{'FilePath'} = clip(PdfFilePath)   ! set STRING property (DispId 93)
result = PDFViewerCOM_Ctrl{'LoadFilePath'}            ! trigger load, returns path (DispId 94)
```

#### Load from URL

`LoadUrl` requires a string parameter. Use `ExecuteScript` workaround:

```clarion
PDFViewerCOM_Ctrl{'ExecuteScript'} = 'window.pdfViewer.loadUrl(' & QUOTE(url) & ')'
! -- or use PostMessage approach if preferred
```

Alternatively, add a `UrlPath` property pattern (same as `FilePath` + `LoadFilePath`).

#### Load from Base64 / StringTheory blob

```clarion
! ST is a StringTheory object containing the PDF binary
ST.EncodeBase64()                                     ! encode to base64 in-place
PDFViewerCOM_Ctrl{'ExecuteScript'} = |
  'window.pdfViewer.loadBase64("' & clip(ST.GetValue()) & '")'
```

Or using the direct COM method (for smaller PDFs):

```clarion
! Build script call — LoadBase64 takes a parameter, use ExecuteScript
PDFViewerCOM_Ctrl{'ExecuteScript'} = 'window.pdfViewer.loadBase64("' & b64str & '")'
```

#### Close document

```clarion
PDFViewerCOM_Ctrl{'CloseDocument'}
```

---

### Navigation

```clarion
PDFViewerCOM_Ctrl{'NextPage'}
PDFViewerCOM_Ctrl{'PreviousPage'}
PDFViewerCOM_Ctrl{'FirstPage'}
PDFViewerCOM_Ctrl{'LastPage'}
```

Go to a specific page (page number via ExecuteScript — GoToPage takes a parameter):

```clarion
PDFViewerCOM_Ctrl{'ExecuteScript'} = 'window.pdfViewer.goToPage(' & pageNum & ')'
```

---

### Zoom

```clarion
PDFViewerCOM_Ctrl{'ZoomIn'}
PDFViewerCOM_Ctrl{'ZoomOut'}
PDFViewerCOM_Ctrl{'FitWidth'}
PDFViewerCOM_Ctrl{'FitPage'}
PDFViewerCOM_Ctrl{'ActualSize'}
```

Set zoom to a specific percentage (e.g., 150%):

```clarion
PDFViewerCOM_Ctrl{'ExecuteScript'} = 'window.pdfViewer.setZoom(150)'
```

Get current zoom level (returns REAL, 1.0 = 100%):

```clarion
zoomVal = PDFViewerCOM_Ctrl{'GetZoomLevel'}
```

---

### Search

```clarion
PDFViewerCOM_Ctrl{'FindNext'}
PDFViewerCOM_Ctrl{'FindPrevious'}
PDFViewerCOM_Ctrl{'ClearSearch'}
```

Search for text (takes parameters — use ExecuteScript):

```clarion
PDFViewerCOM_Ctrl{'ExecuteScript'} = |
  'window.pdfViewer.search("' & clip(SearchTerm) & '", false)'
  ! Second param: false = case-insensitive, true = case-sensitive
```

---

### Annotations

#### Highlight selected text (user must select text first in the viewer)

```clarion
PDFViewerCOM_Ctrl{'ExecuteScript'} = 'window.pdfViewer.highlightSelection("#FFFF00")'
! Colors: '#FFFF00' yellow, '#90EE90' green, '#ADD8E6' blue, '#FFB6C1' pink
```

#### Enable / disable drawing mode

```clarion
! Enable (color as hex string, width in pixels)
PDFViewerCOM_Ctrl{'ExecuteScript'} = 'window.pdfViewer.enableDrawing("#FF0000", 2)'

! Disable
PDFViewerCOM_Ctrl{'DisableDrawing'}
```

#### Clear all annotations on current page

```clarion
PDFViewerCOM_Ctrl{'ClearAnnotations'}
```

#### Export annotations (asynchronous — result fires AnnotationsExported event)

```clarion
PDFViewerCOM_Ctrl{'ExportAnnotations'}
! Result arrives in AnnotationsExported event — read PDFViewerCOM.Parm1.GetValue()
! JSON format: { "annotations": [...], "drawingHistory": {...} }
! Store this JSON alongside the original SourceBase64 for editable round-trips.
```

#### Get original PDF bytes as Base64

```clarion
OrigB64 = PDFViewerCOM_Ctrl{'SourceBase64'}
! Returns the unmodified PDF bytes that were loaded (via LoadFile or LoadBase64).
! Store this separately from annotation JSON for the two-column storage pattern.
```

#### Import annotations from JSON (Clarion-friendly — no parameter needed)

```clarion
PDFViewerCOM_Ctrl{'AnnotationsData'} = clip(AnnotJsonField)
PDFViewerCOM_Ctrl{'ImportAnnotationsData'}
! Call AFTER DocumentLoaded event fires. Restores highlights, notes, and drawings.
```

---

### Print & Save

#### Print (opens system dialog)

```clarion
PDFViewerCOM_Ctrl{'Print'}
```

#### Save As (original PDF bytes to file — no annotations flattening)

```clarion
PDFViewerCOM_Ctrl{'ExecuteScript'} = 'window.pdfViewer.download()'
! This shows the OS Save dialog and saves with all annotations flattened via PrintToPdfAsync
```

Or programmatic save to a known path (original bytes only, no annotations):

```clarion
PDFViewerCOM_Ctrl{'ExecuteScript'} = 'window.pdfViewer.download()'
! For path-controlled save, handle SaveAsBase64Ready event and write bytes yourself
```

#### Save As Base64 with annotations (for StringTheory / blob round-trip)

```clarion
PDFViewerCOM_Ctrl{'SaveAsBase64'}
! Result fires SaveAsBase64Ready event — read Parm1 in the event handler
```

---

### State Queries

```clarion
isReady    = PDFViewerCOM_Ctrl{'GetIsReady'}       ! BYTE: 1 if WebView2 ready
lastErr    = PDFViewerCOM_Ctrl{'GetLastError'}      ! STRING: last error message
source     = PDFViewerCOM_Ctrl{'GetSource'}         ! STRING: current file/URL
curPage    = PDFViewerCOM_Ctrl{'GetCurrentPage'}    ! LONG: current page (1-based)
pageCount  = PDFViewerCOM_Ctrl{'GetPageCount'}      ! LONG: total pages
zoomLevel  = PDFViewerCOM_Ctrl{'GetZoomLevel'}      ! REAL: zoom (1.0 = 100%)
sidebarVis = PDFViewerCOM_Ctrl{'GetSidebarVisible'} ! BYTE: 1 if sidebar visible
annotEn    = PDFViewerCOM_Ctrl{'GetAnnotationsEnabled'} ! BYTE: 1 if annotations on
```

---

### View Options

```clarion
PDFViewerCOM_Ctrl{'ToggleSidebar'}
PDFViewerCOM_Ctrl{'ShowThumbnails'}
PDFViewerCOM_Ctrl{'ShowBookmarks'}
PDFViewerCOM_Ctrl{'RotateClockwise'}
PDFViewerCOM_Ctrl{'RotateCounterClockwise'}
```

Show/hide sidebar programmatically:

```clarion
PDFViewerCOM_Ctrl{'SidebarVisible'}     = 1   ! 1 = show, 0 = hide
PDFViewerCOM_Ctrl{'AnnotationsEnabled'} = 0   ! 0 = disable all annotation UI
```

**Timing:** These are true COM properties — they can be set anywhere, including `EVENT:OpenWindow` before `ViewerReady` fires. The value is stored and automatically applied when the viewer initializes. If called after `ViewerReady`, the change takes effect immediately.

> **Note:** The older `SetSidebarVisible` and `SetAnnotationsEnabled` method names still exist but cannot be called reliably via Clarion's `= value` syntax because `.NET` only routes `DISPATCH_PROPERTYPUT` to property setters, not `void` methods. Always use `SidebarVisible` / `AnnotationsEnabled`.

---

### Advanced / Escape Hatch

```clarion
! Execute arbitrary JavaScript
PDFViewerCOM_Ctrl{'ExecuteScript'} = 'window.pdfViewer.fitWidth()'

! About dialog
PDFViewerCOM_Ctrl{'About'}
```

---

## 6. Properties Reference

Properties are read or written using the property-name string directly:

```clarion
value = PDFViewerCOM_Ctrl{'PropertyName'}     ! get
PDFViewerCOM_Ctrl{'PropertyName'} = value      ! set
```

| Property | Clarion Type | Default | Description |
|----------|-------------|---------|-------------|
| `FilePath` | STRING | `''` | Path set before calling `LoadFilePath` |
| `Base64Data` | STRING | `''` | Base64 PDF data set before calling `LoadBase64Data` |
| `SourceBase64` | STRING (read-only) | `''` | Original PDF bytes as Base64 (set automatically by `LoadFile`/`LoadBase64`); store with annotation JSON for editable round-trips |
| `AnnotationsData` | STRING | `'{}'` | Annotation JSON to import; set before calling `ImportAnnotationsData` |
| `SidebarVisible` | BYTE | 1 | Show/hide sidebar; safe to set before `ViewerReady` |
| `AnnotationsEnabled` | BYTE | 1 | Enable/disable all annotation UI; safe to set before `ViewerReady` |
| `AllowHighlight` | BYTE | **0** | Show/hide Highlight toolbar button — must be explicitly enabled |
| `AllowNotes` | BYTE | **0** | Show/hide Note toolbar button — must be explicitly enabled |
| `AllowDrawing` | BYTE | **0** | Show/hide Draw toolbar button — must be explicitly enabled |
| `AllowSaveAs` | BYTE | 1 | Show/hide Download (Save As) toolbar button |

Permission properties can be set before `ViewerReady` — they are applied automatically when the viewer initializes. They can also be changed at any time after initialization.

By default the control opens with only the Download button enabled. Enable annotation features explicitly after confirming user permissions:

```clarion
! Grant full annotation access to privileged users
PDFViewerCOM_Ctrl{'AllowHighlight'} = 1
PDFViewerCOM_Ctrl{'AllowNotes'}     = 1
PDFViewerCOM_Ctrl{'AllowDrawing'}   = 1
```

---

## 7. Events Reference — Handler Patterns

Events arrive at `PDFViewerCOM_Event`. Read parameters from `PDFViewerCOM.Parm1..6`.

| Event Name | Parm1 | Parm2 | When to use |
|-----------|-------|-------|-------------|
| `ViewerReady` | — | — | Load documents here — NOT in ControlReady |
| `ControlReady` | — | — | WebView2 runtime initialized — do NOT load docs yet |
| `DocumentLoaded` | pageCount (LONG) | title (STRING) | Update page counter, title bar |
| `PageChanged` | pageNumber (LONG) | — | Sync page indicator in your UI |
| `ZoomChanged` | zoomLevel (REAL) | — | Sync zoom indicator |
| `SearchCompleted` | matchCount (LONG) | currentMatch (LONG) | Update search status |
| `AnnotationAdded` | annotationType (STRING) | pageNumber (LONG) | Track annotation count |
| `AnnotationSelected` | annotationId (STRING) | annotationType (STRING) | Enable delete/edit buttons |
| `TextSelected` | selectedText (STRING) | pageNumber (LONG) | Enable copy/highlight actions |
| `BookmarkClicked` | title (STRING) | pageNumber (LONG) | Optional: sync page nav |
| `ThumbnailClicked` | pageNumber (LONG) | — | Optional: sync page nav |
| `LinkClicked` | url (STRING) | isInternal (LONG) | Optional: handle external links |
| `PrintCompleted` | success (LONG) | — | Show success/error message |
| `SaveAsBase64Ready` | base64Data (STRING) | — | Write flattened annotated PDF to blob/StringTheory |
| `AnnotationsExported` | annotationsJson (STRING) | — | `ExportAnnotations()` completed; JSON contains `{ annotations, drawingHistory }` for editable round-trips |
| `ErrorOccurred` | errorMessage (STRING) | — | Display or log the error |
| `NavigationCompleted` | url (STRING) | success (LONG) | Low-level WebView2 event |
| `NavigationStarting` | url (STRING) | — | Low-level WebView2 event |

---

## 8. Common Recipes

### Recipe 1 — Basic file viewer

```clarion
! In EVENT:OpenWindow
PDFViewerCOM_Ctrl = ?UltimateCOM
PDFViewerCOM_Ctrl{PROP:Create} = 'PDFViewerCOM.PDFViewerCOMControl'
PDFViewerCOM.SetUCPostEvent(PDFViewerCOM_Event)
PDFViewerCOM.RegisterEventFunc(PDFViewerCOM_Ctrl)

! In ViewerReady event
PDFViewerCOM_Ctrl{'FilePath'} = clip(PdfFilePath)
result = PDFViewerCOM_Ctrl{'LoadFilePath'}

! In DocumentLoaded event
PageTotal = PDFViewerCOM.Parm1.GetLong()
DocTitle  = PDFViewerCOM.Parm2.GetValue()
```

---

### Recipe 2 — Read-only viewer (no annotations, no save)

Annotation buttons are hidden by default — only `AllowSaveAs` needs to be turned off:

```clarion
! In EVENT:OpenWindow (before ViewerReady fires)
PDFViewerCOM_Ctrl{'AllowSaveAs'} = 0
PDFViewerCOM_Ctrl{'SetAnnotationsEnabled'} = 0
```

---

### Recipe 3 — Permission-based viewer (e.g., from a user rights table)

```clarion
! After loading user permissions from database:
PDFViewerCOM_Ctrl{'AllowHighlight'} = CHOOSE(UserCanHighlight, 1, 0)
PDFViewerCOM_Ctrl{'AllowNotes'}     = CHOOSE(UserCanAddNotes,  1, 0)
PDFViewerCOM_Ctrl{'AllowDrawing'}   = CHOOSE(UserCanDraw,      1, 0)
PDFViewerCOM_Ctrl{'AllowSaveAs'}    = CHOOSE(UserCanSave,      1, 0)
```

---

### Recipe 4 — Load from StringTheory blob, save with annotations back to blob

```clarion
! LOAD: ST contains raw PDF binary bytes
ST.EncodeBase64()   ! convert binary to base64 string in-place
! NOTE: Use Base64Data + LoadBase64Data — NOT ExecuteScript.
! StringTheory's EncodeBase64() produces MIME base64 with \r\n every 76 chars.
! Embedding that in a JS string literal breaks the script. LoadBase64Data strips
! the line breaks automatically before passing to the JavaScript engine.
PDFViewerCOM_Ctrl{'Base64Data'} = clip(ST.GetValue())
PDFViewerCOM_Ctrl{'LoadBase64Data'}

! SAVE WITH ANNOTATIONS:
PDFViewerCOM_Ctrl{'SaveAsBase64'}
! ... fires SaveAsBase64Ready event ...

! In SaveAsBase64Ready event handler:
ST2.SetValue(PDFViewerCOM.Parm1.GetValue())  ! base64-encoded annotated PDF
ST2.DecodeBase64()                            ! decode back to binary for storage
! Now ST2 contains the flattened annotated PDF as binary — store in blob field
```

---

### Recipe 5 — Editable annotation round-trip (save highlights, notes, drawings and restore them)

This is the recommended pattern when you need annotations to remain **editable** after the document is reloaded. Store the original PDF bytes and annotation JSON separately (two-column pattern), then reload both.

#### Saving

```clarion
! Trigger annotation export — result comes back asynchronously
PDFViewerCOM_Ctrl{'ExportAnnotations'}

! In AnnotationsExported event handler:
OF 'AnnotationsExported'
  AnnotJsonField = PDFViewerCOM.Parm1.GetValue()   ! store to memo/string field
  OrigB64        = PDFViewerCOM_Ctrl{'SourceBase64'} ! get original PDF as base64
  ST.SetValue(OrigB64)
  ST.DecodeBase64()
  ! Store ST binary content back to a blob field (original, unmodified PDF)
  PUT(PdfRecord)  ! or whatever your save mechanism is
```

#### Loading (in a Browse → Form open or similar)

```clarion
! In ViewerReady event:
OF 'ViewerReady'
  ST.SetValue(BlobField)   ! load from blob or wherever the original PDF is stored
  ST.EncodeBase64()
  PDFViewerCOM_Ctrl{'Base64Data'} = clip(ST.GetValue())
  PDFViewerCOM_Ctrl{'LoadBase64Data'}

! In DocumentLoaded event (annotations MUST be imported after the document loads):
OF 'DocumentLoaded'
  PageTotal = PDFViewerCOM.Parm1.GetLong()
  IF clip(AnnotJsonField)  ! only if there are saved annotations
    PDFViewerCOM_Ctrl{'AnnotationsData'} = clip(AnnotJsonField)
    PDFViewerCOM_Ctrl{'ImportAnnotationsData'}
  END
```

> **Why two events?** `ViewerReady` fires once when PDF.js initializes — load the PDF there. `DocumentLoaded` fires after each PDF loads — restore annotations there so they are applied to the correct document state.

---

### Recipe 6 — Programmatic search with result handling

```clarion
! Trigger search
PDFViewerCOM_Ctrl{'ExecuteScript'} = |
  'window.pdfViewer.search("' & clip(SearchText) & '", false)'

! In SearchCompleted event:
MatchCount   = PDFViewerCOM.Parm1.GetLong()
CurrentMatch = PDFViewerCOM.Parm2.GetLong()
IF MatchCount = 0
  MESSAGE('Text not found')
ELSE
  DO UpdateSearchStatus  ! display "3 of 12" etc.
END
```

---

### Recipe 7 — Open PDF via file dialog from a button

```clarion
! Button click handler (or any trigger)
IF FILEDIALOG('Select PDF','*.PDF','PDF Files|*.pdf',0)
  PDFViewerCOM_Ctrl{'FilePath'} = clip(FILEDIALOG())
  result = PDFViewerCOM_Ctrl{'LoadFilePath'}
END
```

---

### Recipe 8 — Page navigation buttons in your own UI

```clarion
! Custom "Previous" button
PDFViewerCOM_Ctrl{'PreviousPage'}

! Custom "Next" button
PDFViewerCOM_Ctrl{'NextPage'}

! Jump to specific page from an input field
PDFViewerCOM_Ctrl{'ExecuteScript'} = 'window.pdfViewer.goToPage(' & PageInput & ')'

! Sync page display when PageChanged event fires
PageDisplay = PDFViewerCOM.Parm1.GetLong() & ' / ' & PageTotal
```

---

## 9. Clarion Type Mappings

| COM / .NET type | Clarion type | Notes |
|----------------|-------------|-------|
| `bool` / `BYTE` | `BYTE` | 1 = true, 0 = false |
| `int` / `LONG` | `LONG` | Page numbers, counts |
| `double` / `REAL` | `REAL` | Zoom levels (1.0 = 100%) |
| `string` / `STRING` | `STRING` | File paths, JSON, Base64 |

When **reading** from an event parameter:
- `PDFViewerCOM.Parm1.GetValue()` → STRING
- `PDFViewerCOM.Parm1.GetLong()` → LONG
- `PDFViewerCOM.Parm1.GetReal()` → REAL

When **writing** a BYTE/LONG property:
```clarion
PDFViewerCOM_Ctrl{'AllowSaveAs'} = 0    ! 0 or 1
```

---

## 10. Critical Rules & Gotchas

### 1. Never call COM methods through the UltimateCOM variable

```clarion
! WRONG — calls UltimateCOM Clarion class, returns empty, no error
PDFViewerCOM{'About'}

! CORRECT — dispatches to the COM object
PDFViewerCOM_Ctrl{'About'}
```

### 2. Never include parentheses in the method name string

`IDispatch::GetIDsOfNames` receives the string literally. `'LoadFilePath()'` does not match the method named `'LoadFilePath'`.

```clarion
result = PDFViewerCOM_Ctrl{'LoadFilePath'}   ! correct
result = PDFViewerCOM_Ctrl{'LoadFilePath()'}  ! wrong — always returns empty
```

### 3. Wait for ViewerReady before loading documents — but not for viewer state

`ControlReady` fires when WebView2 is initialized, but PDF.js is not loaded yet — `window.pdfViewer` does not exist.
`ViewerReady` fires when PDF.js is ready. **Always load documents in `ViewerReady`.**

`SidebarVisible` and `AnnotationsEnabled` properties are exempt: they store the preference and auto-apply it at `ViewerReady`, so they can safely be called from `EVENT:OpenWindow` or earlier. Use these property names — not `SetSidebarVisible` / `SetAnnotationsEnabled`, which are void methods and cannot be called via Clarion's `= value` syntax.

### 4. Parameters cannot be passed directly via `{}` syntax

Clarion's late-binding `{}` cannot pass method parameters. Use either:
- The `FilePath` + `LoadFilePath` property+method pattern
- `ExecuteScript` to call JS methods directly with embedded parameters

### 5. ExecuteScript for methods that need parameters

Any method with parameters (GoToPage, SetZoom, Search, HighlightSelection, LoadBase64, etc.) must be called via:

```clarion
PDFViewerCOM_Ctrl{'ExecuteScript'} = 'window.pdfViewer.methodName(arg1, "arg2")'
```

String arguments must be quoted inside the JS expression. Be careful with apostrophes in string values — use QUOTE() or replace with double quotes.

### 6. StringTheory base64 encoding adds line breaks — use Base64Data/LoadBase64Data

StringTheory's `EncodeBase64()` produces MIME-formatted base64 with `\r\n` inserted every 76 characters. Embedding that in a JavaScript string literal (as `ExecuteScript` does) breaks the script syntax and the PDF silently fails to load.

**Always use the property+method pattern for blob loading:**

```clarion
ST.EncodeBase64()
PDFViewerCOM_Ctrl{'Base64Data'} = clip(ST.GetValue())
PDFViewerCOM_Ctrl{'LoadBase64Data'}   ! strips line breaks automatically
```

Do NOT use `ExecuteScript` directly with StringTheory base64 output.

### 7. Base64 string size limits

Clarion `STRING` variables have a compile-time maximum length. For large PDFs, declare the variable large enough or use StringTheory's dynamic allocation. A 10 MB PDF Base64-encodes to ~13.3 MB of text.

### 7. SaveAsBase64 is asynchronous

`SaveAsBase64()` returns immediately. The actual Base64 data arrives in the `SaveAsBase64Ready` event, which fires after `PrintToPdfAsync` completes (typically within 1–3 seconds depending on PDF complexity). Do not try to read results synchronously.

### 8. Flattened PDF output from SaveAsBase64 / Download

Both `SaveAsBase64` and the interactive Download button produce a **rasterized/flattened** PDF captured via WebView2's `PrintToPdfAsync`. Annotations, highlights, and drawings are baked into the page image — they cannot be re-edited after reloading the saved file. If you need editable annotations to survive round-trips, use `ExportAnnotations` / `ImportAnnotations` to save the annotation JSON separately and re-apply after loading.

### 9. Permission flags apply to UI only

`AllowHighlight`, `AllowNotes`, `AllowDrawing`, and `AllowSaveAs` hide toolbar buttons. They do not prevent programmatic annotation calls via `ExecuteScript`. For true access control, enforce permissions server-side.

### 10. Deployment — wwwroot must be alongside the application

The WebView2 virtual host maps `https://localapp.clarioncontrols/` to the `wwwroot` folder relative to the running application. If the PDF viewer shows blank or fails to load, verify that `wwwroot\controls\pdfviewercom\app.js`, `wwwroot\lib\pdfjs\pdf.min.js`, and `wwwroot\lib\pdfjs\pdf.worker.min.js` are present in the correct relative paths.

---

## GUIDs (do not change without updating the manifest)

| Component | GUID |
|-----------|------|
| Class | `{2193ddb6-df52-40bc-a41c-b0f0788963a7}` |
| Interface | `{fb694e21-68af-4a45-907e-88867de9fd93}` |
| Events | `{b5cd456b-4dda-4097-9880-57a41ac16ecf}` |
| TypeLib | `{98d6e5d5-ccd2-4f6d-811a-d97f2ca5bc4b}` |
