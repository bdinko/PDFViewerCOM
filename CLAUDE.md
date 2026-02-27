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
- **PDF.js**: Loaded from CDN (v4.0.379)

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

## Dependencies

- Microsoft.Web.WebView2 (1.0.3595.46)
- Newtonsoft.Json (13.0.3)
- WebView2 Runtime (Evergreen) on target machine
