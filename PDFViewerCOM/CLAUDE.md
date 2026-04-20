# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PDFViewerCOM is a Registration-Free COM control for Clarion applications that provides a full-featured PDF viewer using WebView2 and Mozilla's PDF.js. Built with the ClarionCOM framework.

## Build Commands

```bash
# Build Release (x86 required for 32-bit Clarion)
"C:\Program Files\dotnet\dotnet.exe" msbuild PDFViewerCOM.csproj -p:Configuration=Release -p:Platform=x86

# Build Debug
"C:\Program Files\dotnet\dotnet.exe" msbuild PDFViewerCOM.csproj -p:Configuration=Debug -p:Platform=x86
```

**Note:** Use `dotnet msbuild` (not standalone MSBuild). A NuGet restore is required on first build:
```bash
"C:\Program Files\dotnet\dotnet.exe" restore PDFViewerCOM.csproj
```

The build automatically:
1. Deploys DLLs to `../Clarion/accessory/bin/`
2. Deploys manifest and metadata to `../Clarion/accessory/resources/`
3. Copies wwwroot to `../Clarion/accessory/resources/wwwroot/`
4. Generates Clarion metadata files (.header, .details, .events, .methods)
5. Auto-deploys to Clarion installation if configured via ClarionCOMHome scripts

## Architecture

### COM Layer (C#)
- **IPDFViewerCOMControl.cs** - COM interface defining all methods callable from Clarion (DispId-tagged)
- **IPDFViewerCOMControlEvents.cs** - COM events interface (16 events fired to Clarion)
- **PDFViewerCOMControl.cs** - UserControl implementation that hosts WebView2 and bridges COM to JavaScript

### JavaScript Layer
- **wwwroot/controls/pdfviewercom/app.js** - PDFViewer class using PDF.js for rendering
- **wwwroot/controls/pdfviewercom/index.html** - Viewer UI with toolbar, sidebar, and PDF canvas

### Communication Pattern
```
Clarion -> COM Methods -> C# ExecuteScript() -> window.pdfViewer.method()
JavaScript -> chrome.webview.postMessage() -> C# WebMessageReceived -> COM Events -> Clarion
```

The C# control exposes `window.chrome.webview.hostObjects.PDFViewerCOMHost` for synchronous JS-to-C# calls.

## Key Technical Details

- **Target Framework**: .NET Framework 4.8 (net48 — included in Windows 10/11)
- **Platform**: x86 only (32-bit Clarion requirement)
- **COM Activation**: Registration-free via manifest (no regasm)
- **WebView2**: Virtual host mapping at `https://localapp.clarioncontrols/`
- **PDF.js**: Hosted locally at `wwwroot/lib/pdfjs/` (v3.11.174 legacy/UMD build — NOT the ES module version)

### GUIDs (do not change without updating manifest)
| Component | GUID |
|-----------|------|
| Class | `2193ddb6-df52-40bc-a41c-b0f0788963a7` |
| Interface | `fb694e21-68af-4a45-907e-88867de9fd93` |
| Events | `b5cd456b-4dda-4097-9880-57a41ac16ecf` |
| TypeLib | `98d6e5d5-ccd2-4f6d-811a-d97f2ca5bc4b` |

## Event Sequence

1. `ControlReady` - WebView2 initialized
2. `ViewerReady` - PDF.js ready (safe to call LoadFile/LoadUrl/LoadBase64)
3. `DocumentLoaded` - PDF loaded with pageCount and title

**Important**: Always wait for `ViewerReady` before loading documents.

## Adding New Features

When adding COM methods:
1. Add method signature to `IPDFViewerCOMControl.cs` with unique `[DispId(n)]`
2. Implement in `PDFViewerCOMControl.cs` with `[ComVisible(true)]`
3. Add JavaScript implementation in `app.js` and bind to `window.pdfViewer`

When adding COM events:
1. Add to `IPDFViewerCOMControlEvents.cs` with unique `[DispId(n)]`
2. Add delegate and event in `PDFViewerCOMControl.cs`
3. Create `RaiseEventName()` helper method
4. Call from `HandleWebMessage()` when receiving JS messages

## Clarion Integration — Calling COM Methods

### How ClarionCOM Wires Up the Control

ClarionCOM generates Clarion code with this pattern:

```clarion
PDFViewerCOM      UltimateCOM          ! Event-routing helper class (NOT the COM dispatch target)
PDFViewerCOM_Ctrl LONG                 ! Field number of the OLE control — USE THIS for dispatch
PDFViewerCOM_Event EQUATE(Event:User + 2000 + ?UltimateCOM)

! At EVENT:OpenWindow:
PDFViewerCOM_Ctrl = ?UltimateCOM
PDFViewerCOM_Ctrl{PROP:Create} = 'PDFViewerCOM.PDFViewerCOMControl'
PDFViewerCOM.SetUCPostEvent(PDFViewerCOM_Event)
PDFViewerCOM.RegisterEventFunc(PDFViewerCOM_Ctrl)
```

### CRITICAL: Use PDFViewerCOM_Ctrl for COM Dispatch

`PDFViewerCOM` is a `UltimateCOM` Clarion class — it handles events only. Using `PDFViewerCOM{...}` calls the Clarion class operator, NOT the COM object. All COM method calls MUST go through `PDFViewerCOM_Ctrl`:

```clarion
! CORRECT — dispatches to the COM object
PDFViewerCOM_Ctrl{'About'}
result = PDFViewerCOM_Ctrl{'GetLastError'}

! WRONG — dispatches to the UltimateCOM Clarion class, silently returns empty
PDFViewerCOM{'About'}
result = PDFViewerCOM{'GetLastError'}
```

### Calling Syntax Rules

```clarion
PDFViewerCOM_Ctrl{'MethodName'}           ! no-param method (do NOT include parentheses)
result = PDFViewerCOM_Ctrl{'PropertyName'} ! property get
PDFViewerCOM_Ctrl{'PropertyName'} = value  ! property set
```

**Do NOT include `()` in the member name string.** `IDispatch::GetIDsOfNames` receives the string literally — `'GetLastError()'` does not match the method named `'GetLastError'`.

### Passing String Parameters from Clarion

Clarion's `{}` late-binding cannot pass parameters directly to COM methods. Use the property+method pattern:

```clarion
! Load a PDF file:
PDFViewerCOM_Ctrl{'FilePath'} = clip(PdfName)   ! set path via property (DispId 93)
result = PDFViewerCOM_Ctrl{'LoadFilePath'}        ! trigger load — returns the path (DispId 94)
```

### Receiving Events

Events arrive via `UCProcessCOMEvents_PDFViewerCOM`. Use `PDFViewerCOM.GetEvent()`, `PDFViewerCOM.EventName`, and `PDFViewerCOM.Parm1..6.GetValue()` to read event data — these DO use the `UltimateCOM` class methods directly.

### PDF.js Deployment

PDF.js files (`pdf.min.js`, `pdf.worker.min.js`) are deployed to `C:\Clarion12\accessory\resources\wwwroot\lib\pdfjs\` by the build, but WebView2 maps the virtual host to the **Clarion application's output folder**. You must copy `lib\pdfjs\` into your app's `wwwroot\` folder manually (or via a build step).

## Dependencies

- Microsoft.Web.WebView2 (1.0.3595.46)
- Newtonsoft.Json (13.0.3)
- WebView2 Runtime (Evergreen) on target machine
