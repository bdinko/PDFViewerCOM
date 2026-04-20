# PDFViewerCOM Testing — Sessions 01 & 02 Summary

## Current Status (end of Session 02)

**PDF loading is working.** After two sessions of debugging, `LoadFile` successfully reads a PDF, converts it to base64, and renders it in the WebView2 viewer via PDF.js.

---

## Solved Problems (cumulative)

### Session 01

| Problem | Root Cause | Fix |
|---------|-----------|-----|
| Build failed | VS18/VS2022 MSBuild lacks Microsoft.NET.Sdk | Use `"C:\Program Files\dotnet\dotnet.exe" msbuild` |
| Build failed | .NET Framework 4.8 targeting pack missing | Install .NET Framework 4.8 Developer Pack |
| Clarion compiler error "Expected {..." | Wrong COM calling syntax | See Session 02 findings |
| ViewerReady never fired | PDF.js loaded from CDN, inaccessible in WebView2 | Host PDF.js locally |
| ViewerReady never fired | `.mjs` MIME type rejected by WebView2 virtual host | Rename to `.js` |
| ViewerReady never fired | `dynamic import()` fails on WebView2 virtual host | Switch to `<script>` tag with PDF.js 3.x legacy (UMD) build |
| ViewerReady never fired | Wrong global name (`window['pdfjs-dist/build/pdf']`) | Changed to `window.pdfjsLib` |
| ViewerReady never fired | PDF.js files not in app's runtime wwwroot | User manually copied `lib/pdfjs/` to app wwwroot |

### Session 02

| Problem | Root Cause | Fix |
|---------|-----------|-----|
| All `{}` COM calls silently returned empty | `PDFViewerCOM` is a `UltimateCOM` class (event helper), not the COM dispatch target | Use `PDFViewerCOM_Ctrl{...}` for all COM method dispatch |
| `()` in method name caused dispatch failure | `IDispatch::GetIDsOfNames` receives the string literally — `'GetLastError()'` ≠ `'GetLastError'` | Drop `()` from member name strings |
| Cannot pass string parameters via `{}` | Clarion `{}` late-binding cannot pass parameters to COM methods | Added `FilePath` property (DispId 93) + `LoadFilePath()` method (DispId 94) |
| `LoadFilePath()` gave "Unusual type conversion" and didn't dispatch | Clarion `{}` requires a return value to dispatch a call as a function | Changed `LoadFilePath` return type from `void` to `string` |

---

## Key Architecture Findings

### Clarion COM Dispatch Pattern

```clarion
PDFViewerCOM      UltimateCOM   ! event helper class only — NOT for COM dispatch
PDFViewerCOM_Ctrl LONG          ! field number = the actual COM dispatch target
```

All COM method calls must use `PDFViewerCOM_Ctrl`:

```clarion
PDFViewerCOM_Ctrl{'About'}                            ! no-param method
result = PDFViewerCOM_Ctrl{'GetLastError'}             ! property/method get (no parens)
PDFViewerCOM_Ctrl{'FilePath'} = clip(PdfName)         ! property set
result = PDFViewerCOM_Ctrl{'LoadFilePath'}             ! triggers LoadFile using stored FilePath
```

### Loading a PDF from Clarion

```clarion
! Step 1: set the file path via property
PDFViewerCOM_Ctrl{'FilePath'} = clip(PdfName)

! Step 2: trigger load (returns the file path on success)
result = PDFViewerCOM_Ctrl{'LoadFilePath'}

! Step 3: check for errors
errMsg = PDFViewerCOM_Ctrl{'GetLastError'}
IF clip(errMsg) <> ''
  ! handle error
END
```

### Receiving Events

```clarion
UCProcessCOMEvents_PDFViewerCOM PROCEDURE()
  CODE
  IF ~PDFViewerCOM.GetEvent(); RETURN.
  CASE PDFViewerCOM.EventName
  OF 'ViewerReady'
    ! Safe to load documents now
    PDFViewerCOM_Ctrl{'FilePath'} = clip(PdfName)
    result = PDFViewerCOM_Ctrl{'LoadFilePath'}
  OF 'DocumentLoaded'
    pageCount = PDFViewerCOM.Parm1.GetValue()  ! page count
    title     = PDFViewerCOM.Parm2.GetValue()  ! document title
  OF 'ErrorOccurred'
    errMsg = PDFViewerCOM.Parm1.GetValue()
  END
```

### PDF.js Runtime Deployment

The build deploys PDF.js to `C:\Clarion12\accessory\resources\wwwroot\lib\pdfjs\`, but WebView2 maps the virtual host to the **Clarion app's own output folder**. After each build you must copy:

```
C:\Clarion12\accessory\resources\wwwroot\lib\pdfjs\pdf.min.js
C:\Clarion12\accessory\resources\wwwroot\lib\pdfjs\pdf.worker.min.js
```

into your app's `wwwroot\lib\pdfjs\` folder.

---

## Key Files

| File | Purpose |
|------|---------|
| `PDFViewerCOMControl.cs` | Main C# implementation — COM methods, WebView2, event raising |
| `IPDFViewerCOMControl.cs` | COM interface — all DispIds; `FilePath` (93), `LoadFilePath` (94) added in Session 02 |
| `wwwroot/controls/pdfviewercom/app.js` | JavaScript PDF viewer using PDF.js 3.x |
| `wwwroot/controls/pdfviewercom/index.html` | HTML — loads `lib/pdfjs/pdf.min.js` as regular `<script>`, then `app.js` as module |
| `wwwroot/lib/pdfjs/pdf.min.js` | PDF.js 3.11.174 UMD build (must be in app wwwroot at runtime) |
| `wwwroot/lib/pdfjs/pdf.worker.min.js` | PDF.js worker (must be in app wwwroot at runtime) |

---

## What Still Needs Testing

- [ ] Navigation controls (next/prev page, go to page)
- [ ] Zoom controls (zoom in/out, fit width, fit page)
- [ ] Sidebar (thumbnails, bookmarks)
- [ ] Search functionality
- [ ] `DocumentLoaded` event — verify pageCount and title arrive correctly
- [ ] `PageChanged` event — verify page number updates
- [ ] Annotations (highlight, notes, drawing)
- [ ] Print
- [ ] SaveAs
- [ ] Rotation
- [ ] Error handling — what happens with a corrupt/invalid PDF
- [ ] `LoadUrl` — loading a PDF from a URL (needs URL accessible from WebView2)
- [ ] `LoadBase64` — direct base64 loading from Clarion
- [ ] Resize behaviour (control resizes with window)
- [ ] Multiple open/close cycles — does the viewer recover cleanly
