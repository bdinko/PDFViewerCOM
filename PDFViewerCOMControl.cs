using System;
using System.ComponentModel;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Newtonsoft.Json;

namespace PDFViewerCOM
{
    /// <summary>
    /// Host object for JavaScript to C# communication.
    /// Exposed to JavaScript via window.chrome.webview.hostObjects.PDFViewerCOMHost
    /// </summary>
    [ComVisible(true)]
    [ClassInterface(ClassInterfaceType.AutoDual)]
    public class PDFViewerCOMHostObject
    {
        private readonly PDFViewerCOMControl _control;

        public PDFViewerCOMHostObject(PDFViewerCOMControl control)
        {
            _control = control;
        }

        /// <summary>
        /// Receive messages from JavaScript
        /// </summary>
        public void SendMessage(string message)
        {
            try
            {
                _control.HandleHostObjectMessage(message);
            }
            catch (Exception ex)
            {
                _control.SetError($"SendMessage error: {ex.Message}");
            }
        }

        /// <summary>
        /// Get control data from C#
        /// </summary>
        public string GetData()
        {
            try
            {
                return _control.GetControlData();
            }
            catch (Exception ex)
            {
                _control.SetError($"GetData error: {ex.Message}");
                return string.Empty;
            }
        }
    }

    /// <summary>
    /// PDF Viewer COM Control for Clarion.
    /// Full-featured PDF viewer with annotations, search, thumbnails, bookmarks, and print support.
    /// Uses PDF.js (Mozilla) for rendering.
    /// </summary>
    [ComVisible(true)]
    [ClassInterface(ClassInterfaceType.None)]
    [Guid("2193ddb6-df52-40bc-a41c-b0f0788963a7")]
    [ComSourceInterfaces(typeof(IPDFViewerCOMControlEvents))]
    [ProgId("PDFViewerCOM.PDFViewerCOMControl")]
    public partial class PDFViewerCOMControl : UserControl, IPDFViewerCOMControl
    {
        #region Fields

        private WebView2 _webView;
        private PDFViewerCOMHostObject _hostObject;
        private bool _isReady;
        private string _lastError;
        private string _currentSource;
        private bool _isInitialized;

        // PDF-specific state
        private int _currentPage;
        private int _pageCount;
        private double _zoomLevel;
        private bool _sidebarVisible;
        private bool _annotationsEnabled;

        #endregion

        #region COM Event Delegates

        public delegate void ControlReadyDelegate();
        public delegate void ErrorOccurredDelegate(string errorMessage);
        public delegate void NavigationCompletedDelegate(string url, bool success);
        public delegate void NavigationStartingDelegate(string url);
        public delegate void DocumentLoadedDelegate(int pageCount, string title);
        public delegate void PageChangedDelegate(int pageNumber);
        public delegate void ZoomChangedDelegate(double zoomLevel);
        public delegate void SearchCompletedDelegate(int matchCount, int currentMatch);
        public delegate void AnnotationAddedDelegate(string annotationType, int pageNumber);
        public delegate void AnnotationSelectedDelegate(string annotationId, string annotationType);
        public delegate void BookmarkClickedDelegate(string title, int pageNumber);
        public delegate void ThumbnailClickedDelegate(int pageNumber);
        public delegate void TextSelectedDelegate(string selectedText, int pageNumber);
        public delegate void LinkClickedDelegate(string url, bool isInternal);
        public delegate void PrintCompletedDelegate(bool success);
        public delegate void ViewerReadyDelegate();

        #endregion

        #region COM Events

        public event ControlReadyDelegate ControlReady;
        public event ErrorOccurredDelegate ErrorOccurred;
        public event NavigationCompletedDelegate NavigationCompleted;
        public event NavigationStartingDelegate NavigationStarting;
        public event DocumentLoadedDelegate DocumentLoaded;
        public event PageChangedDelegate PageChanged;
        public event ZoomChangedDelegate ZoomChanged;
        public event SearchCompletedDelegate SearchCompleted;
        public event AnnotationAddedDelegate AnnotationAdded;
        public event AnnotationSelectedDelegate AnnotationSelected;
        public event BookmarkClickedDelegate BookmarkClicked;
        public event ThumbnailClickedDelegate ThumbnailClicked;
        public event TextSelectedDelegate TextSelected;
        public event LinkClickedDelegate LinkClicked;
        public event PrintCompletedDelegate PrintCompleted;
        public event ViewerReadyDelegate ViewerReady;

        #endregion

        #region Constructor

        /// <summary>
        /// Constructor must be parameterless for COM.
        /// CRITICAL: DO NOT create child controls in constructor.
        /// </summary>
        public PDFViewerCOMControl()
        {
            _isReady = false;
            _lastError = string.Empty;
            _currentSource = string.Empty;
            _isInitialized = false;
            _currentPage = 0;
            _pageCount = 0;
            _zoomLevel = 1.0;
            _sidebarVisible = true;
            _annotationsEnabled = true;

            Size = new Size(800, 600);
            DoubleBuffered = true;
        }

        /// <summary>
        /// Override OnHandleCreated to create WebView2 control.
        /// This is the ONLY safe place for Controls.Add() in COM controls.
        /// </summary>
        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);

            if (!DesignMode && !_isInitialized)
            {
                BackColor = Color.White;
                InitializeWebView2Async();
            }
        }

        #endregion

        #region WebView2 Initialization

        private async void InitializeWebView2Async()
        {
            try
            {
                if (_isInitialized)
                    return;

                _isInitialized = true;

                _webView = new WebView2
                {
                    Dock = DockStyle.Fill
                };

                var env = await CoreWebView2Environment.CreateAsync(null, null, null);
                await _webView.EnsureCoreWebView2Async(env);

                _webView.CoreWebView2.Settings.IsScriptEnabled = true;
                _webView.CoreWebView2.Settings.AreDefaultScriptDialogsEnabled = true;
                _webView.CoreWebView2.Settings.IsWebMessageEnabled = true;
                _webView.CoreWebView2.Settings.AreDevToolsEnabled = true;

                // Set up virtual host mapping for local content
                _webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "localapp.clarioncontrols",
                    Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot"),
                    CoreWebView2HostResourceAccessKind.Allow);

                // Create and register host object for JS->C# calls
                _hostObject = new PDFViewerCOMHostObject(this);
                _webView.CoreWebView2.AddHostObjectToScript("PDFViewerCOMHost", _hostObject);

                // Wire up navigation events
                _webView.CoreWebView2.NavigationStarting += CoreWebView2_NavigationStarting;
                _webView.CoreWebView2.NavigationCompleted += CoreWebView2_NavigationCompleted;
                _webView.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;

                Controls.Add(_webView);

                _isReady = true;
                RaiseControlReady();

                // Navigate to PDF viewer page
                Navigate("https://localapp.clarioncontrols/controls/pdfviewercom/index.html");
            }
            catch (Exception ex)
            {
                _lastError = $"WebView2 initialization failed: {ex.Message}";
                RaiseErrorOccurred(_lastError);
            }
        }

        #endregion

        #region WebView2 Event Handlers

        private void CoreWebView2_NavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs e)
        {
            try
            {
                RaiseNavigationStarting(e.Uri ?? string.Empty);
            }
            catch { }
        }

        private void CoreWebView2_NavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            try
            {
                _currentSource = _webView.Source?.ToString() ?? string.Empty;
                RaiseNavigationCompleted(_currentSource, e.IsSuccess);

                if (!e.IsSuccess)
                {
                    _lastError = $"Navigation failed with status: {e.WebErrorStatus}";
                    RaiseErrorOccurred(_lastError);
                }
            }
            catch { }
        }

        private void CoreWebView2_WebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                string message = e.TryGetWebMessageAsString();
                HandleWebMessage(message);
            }
            catch (Exception ex)
            {
                SetError($"WebMessage error: {ex.Message}");
            }
        }

        #endregion

        #region Message Handling

        private class WebMessage
        {
            public string type { get; set; }
            public string error { get; set; }
            public string data { get; set; }
            public int pageNumber { get; set; }
            public int pageCount { get; set; }
            public string title { get; set; }
            public double zoomLevel { get; set; }
            public int matchCount { get; set; }
            public int currentMatch { get; set; }
            public string annotationType { get; set; }
            public string annotationId { get; set; }
            public string selectedText { get; set; }
            public string url { get; set; }
            public bool isInternal { get; set; }
            public bool success { get; set; }
        }

        internal void HandleWebMessage(string message)
        {
            try
            {
                if (string.IsNullOrEmpty(message))
                    return;

                var msg = JsonConvert.DeserializeObject<WebMessage>(message);
                if (msg == null) return;

                switch (msg.type ?? string.Empty)
                {
                    case "ready":
                        // PDF.js viewer is ready - safe to load documents now
                        RaiseViewerReady();
                        break;

                    case "documentLoaded":
                        _pageCount = msg.pageCount;
                        _currentPage = 1;
                        RaiseDocumentLoaded(msg.pageCount, msg.title ?? string.Empty);
                        break;

                    case "pageChanged":
                        _currentPage = msg.pageNumber;
                        RaisePageChanged(msg.pageNumber);
                        break;

                    case "zoomChanged":
                        _zoomLevel = msg.zoomLevel;
                        RaiseZoomChanged(msg.zoomLevel);
                        break;

                    case "searchCompleted":
                        RaiseSearchCompleted(msg.matchCount, msg.currentMatch);
                        break;

                    case "annotationAdded":
                        RaiseAnnotationAdded(msg.annotationType ?? string.Empty, msg.pageNumber);
                        break;

                    case "annotationSelected":
                        RaiseAnnotationSelected(msg.annotationId ?? string.Empty, msg.annotationType ?? string.Empty);
                        break;

                    case "bookmarkClicked":
                        RaiseBookmarkClicked(msg.title ?? string.Empty, msg.pageNumber);
                        break;

                    case "thumbnailClicked":
                        RaiseThumbnailClicked(msg.pageNumber);
                        break;

                    case "textSelected":
                        RaiseTextSelected(msg.selectedText ?? string.Empty, msg.pageNumber);
                        break;

                    case "linkClicked":
                        RaiseLinkClicked(msg.url ?? string.Empty, msg.isInternal);
                        break;

                    case "printCompleted":
                        RaisePrintCompleted(msg.success);
                        break;

                    case "error":
                        SetError(msg.error ?? "Unknown error");
                        break;

                    default:
                        break;
                }
            }
            catch (Exception ex)
            {
                SetError($"Message parse error: {ex.Message}");
            }
        }

        internal void HandleHostObjectMessage(string message)
        {
            try
            {
                HandleWebMessage(message);
            }
            catch (Exception ex)
            {
                SetError($"Host object message error: {ex.Message}");
            }
        }

        internal string GetControlData()
        {
            try
            {
                var data = new
                {
                    isReady = _isReady,
                    source = _currentSource,
                    currentPage = _currentPage,
                    pageCount = _pageCount,
                    zoomLevel = _zoomLevel,
                    timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                };

                return JsonConvert.SerializeObject(data);
            }
            catch (Exception ex)
            {
                SetError($"GetControlData error: {ex.Message}");
                return "{}";
            }
        }

        #endregion

        #region IPDFViewerCOMControl State Accessor Methods

        [ComVisible(true)]
        [Description("Gets whether WebView2 is ready")]
        public bool GetIsReady()
        {
            return _isReady;
        }

        [ComVisible(true)]
        [Description("Gets the last error message")]
        public string GetLastError()
        {
            return _lastError ?? string.Empty;
        }

        [ComVisible(true)]
        [Description("Gets the current source URL")]
        public string GetSource()
        {
            return _currentSource ?? string.Empty;
        }

        [ComVisible(true)]
        [Description("Gets the current page number (1-based)")]
        public int GetCurrentPage()
        {
            return _currentPage;
        }

        [ComVisible(true)]
        [Description("Gets the total number of pages")]
        public int GetPageCount()
        {
            return _pageCount;
        }

        [ComVisible(true)]
        [Description("Gets the zoom level (1.0 = 100%)")]
        public double GetZoomLevel()
        {
            return _zoomLevel;
        }

        [ComVisible(true)]
        [Description("Sets the zoom level (1.0 = 100%)")]
        public void SetZoomLevel(double value)
        {
            _zoomLevel = value;
            ExecuteScript($"window.pdfViewer.setZoom({value});");
        }

        [ComVisible(true)]
        [Description("Gets whether the sidebar is visible")]
        public bool GetSidebarVisible()
        {
            return _sidebarVisible;
        }

        [ComVisible(true)]
        [Description("Sets whether the sidebar is visible")]
        public void SetSidebarVisible(bool value)
        {
            _sidebarVisible = value;
            ExecuteScript($"window.pdfViewer.setSidebarVisible({value.ToString().ToLower()});");
        }

        [ComVisible(true)]
        [Description("Gets whether annotations are enabled")]
        public bool GetAnnotationsEnabled()
        {
            return _annotationsEnabled;
        }

        [ComVisible(true)]
        [Description("Sets whether annotations are enabled")]
        public void SetAnnotationsEnabled(bool value)
        {
            _annotationsEnabled = value;
            ExecuteScript($"window.pdfViewer.setAnnotationsEnabled({value.ToString().ToLower()});");
        }

        #endregion

        #region Document Operations

        [ComVisible(true)]
        [Description("Load a PDF file from a file path")]
        public void LoadFile(string filePath)
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                if (string.IsNullOrEmpty(filePath))
                {
                    SetError("File path cannot be empty");
                    return;
                }

                if (!File.Exists(filePath))
                {
                    SetError($"File not found: {filePath}");
                    return;
                }

                // Read file and convert to Base64
                byte[] fileBytes = File.ReadAllBytes(filePath);
                string base64 = Convert.ToBase64String(fileBytes);

                ExecuteScript($"window.pdfViewer.loadBase64('{base64}');");
            }
            catch (Exception ex)
            {
                SetError($"LoadFile error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Load a PDF from a URL")]
        public void LoadUrl(string url)
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                if (string.IsNullOrEmpty(url))
                {
                    SetError("URL cannot be empty");
                    return;
                }

                string escapedUrl = JsonConvert.SerializeObject(url);
                ExecuteScript($"window.pdfViewer.loadUrl({escapedUrl});");
            }
            catch (Exception ex)
            {
                SetError($"LoadUrl error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Load a PDF from Base64-encoded data")]
        public void LoadBase64(string base64Data)
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                if (string.IsNullOrEmpty(base64Data))
                {
                    SetError("Base64 data cannot be empty");
                    return;
                }

                ExecuteScript($"window.pdfViewer.loadBase64('{base64Data}');");
            }
            catch (Exception ex)
            {
                SetError($"LoadBase64 error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Close the current PDF document")]
        public void CloseDocument()
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                ExecuteScript("window.pdfViewer.closeDocument();");
                _currentPage = 0;
                _pageCount = 0;
            }
            catch (Exception ex)
            {
                SetError($"CloseDocument error: {ex.Message}");
            }
        }

        #endregion

        #region Navigation

        [ComVisible(true)]
        [Description("Navigate to a specific page")]
        public void GoToPage(int pageNumber)
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                ExecuteScript($"window.pdfViewer.goToPage({pageNumber});");
            }
            catch (Exception ex)
            {
                SetError($"GoToPage error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Navigate to the next page")]
        public void NextPage()
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                ExecuteScript("window.pdfViewer.nextPage();");
            }
            catch (Exception ex)
            {
                SetError($"NextPage error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Navigate to the previous page")]
        public void PreviousPage()
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                ExecuteScript("window.pdfViewer.previousPage();");
            }
            catch (Exception ex)
            {
                SetError($"PreviousPage error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Navigate to the first page")]
        public void FirstPage()
        {
            GoToPage(1);
        }

        [ComVisible(true)]
        [Description("Navigate to the last page")]
        public void LastPage()
        {
            GoToPage(_pageCount);
        }

        #endregion

        #region Zoom Operations

        [ComVisible(true)]
        [Description("Zoom in")]
        public void ZoomIn()
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                ExecuteScript("window.pdfViewer.zoomIn();");
            }
            catch (Exception ex)
            {
                SetError($"ZoomIn error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Zoom out")]
        public void ZoomOut()
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                ExecuteScript("window.pdfViewer.zoomOut();");
            }
            catch (Exception ex)
            {
                SetError($"ZoomOut error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Set zoom to a specific percentage")]
        public void SetZoom(double percentage)
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                double zoomLevel = percentage / 100.0;
                ExecuteScript($"window.pdfViewer.setZoom({zoomLevel});");
            }
            catch (Exception ex)
            {
                SetError($"SetZoom error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Fit page width to viewer")]
        public void FitWidth()
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                ExecuteScript("window.pdfViewer.fitWidth();");
            }
            catch (Exception ex)
            {
                SetError($"FitWidth error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Fit entire page in viewer")]
        public void FitPage()
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                ExecuteScript("window.pdfViewer.fitPage();");
            }
            catch (Exception ex)
            {
                SetError($"FitPage error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Reset zoom to 100%")]
        public void ActualSize()
        {
            SetZoom(100);
        }

        #endregion

        #region Search

        [ComVisible(true)]
        [Description("Search for text in the document")]
        public void Search(string searchText, bool caseSensitive)
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                string escapedText = JsonConvert.SerializeObject(searchText);
                ExecuteScript($"window.pdfViewer.search({escapedText}, {caseSensitive.ToString().ToLower()});");
            }
            catch (Exception ex)
            {
                SetError($"Search error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Find the next occurrence")]
        public void FindNext()
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                ExecuteScript("window.pdfViewer.findNext();");
            }
            catch (Exception ex)
            {
                SetError($"FindNext error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Find the previous occurrence")]
        public void FindPrevious()
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                ExecuteScript("window.pdfViewer.findPrevious();");
            }
            catch (Exception ex)
            {
                SetError($"FindPrevious error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Clear search highlighting")]
        public void ClearSearch()
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                ExecuteScript("window.pdfViewer.clearSearch();");
            }
            catch (Exception ex)
            {
                SetError($"ClearSearch error: {ex.Message}");
            }
        }

        #endregion

        #region Annotations

        [ComVisible(true)]
        [Description("Highlight the current selection")]
        public void HighlightSelection(string color)
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                string escapedColor = JsonConvert.SerializeObject(color ?? "#FFFF00");
                ExecuteScript($"window.pdfViewer.highlightSelection({escapedColor});");
            }
            catch (Exception ex)
            {
                SetError($"HighlightSelection error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Add a text note annotation")]
        public void AddNote(int pageNumber, double x, double y, string text)
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                string escapedText = JsonConvert.SerializeObject(text ?? string.Empty);
                ExecuteScript($"window.pdfViewer.addNote({pageNumber}, {x}, {y}, {escapedText});");
            }
            catch (Exception ex)
            {
                SetError($"AddNote error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Enable drawing mode")]
        public void EnableDrawing(string color, int width)
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                string escapedColor = JsonConvert.SerializeObject(color ?? "#000000");
                ExecuteScript($"window.pdfViewer.enableDrawing({escapedColor}, {width});");
            }
            catch (Exception ex)
            {
                SetError($"EnableDrawing error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Disable drawing mode")]
        public void DisableDrawing()
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                ExecuteScript("window.pdfViewer.disableDrawing();");
            }
            catch (Exception ex)
            {
                SetError($"DisableDrawing error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Clear all annotations on current page")]
        public void ClearAnnotations()
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                ExecuteScript("window.pdfViewer.clearAnnotations();");
            }
            catch (Exception ex)
            {
                SetError($"ClearAnnotations error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Export annotations as JSON")]
        public string ExportAnnotations()
        {
            try
            {
                // This returns synchronously - for now return empty
                // Real implementation would need async/await pattern
                return "[]";
            }
            catch (Exception ex)
            {
                SetError($"ExportAnnotations error: {ex.Message}");
                return "[]";
            }
        }

        [ComVisible(true)]
        [Description("Import annotations from JSON")]
        public void ImportAnnotations(string annotationsJson)
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                string escaped = JsonConvert.SerializeObject(annotationsJson ?? "[]");
                ExecuteScript($"window.pdfViewer.importAnnotations({escaped});");
            }
            catch (Exception ex)
            {
                SetError($"ImportAnnotations error: {ex.Message}");
            }
        }

        #endregion

        #region Print and Export

        [ComVisible(true)]
        [Description("Print the document")]
        public void Print()
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                ExecuteScript("window.pdfViewer.print();");
            }
            catch (Exception ex)
            {
                SetError($"Print error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Save the PDF to a file")]
        public void SaveAs(string filePath)
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                // Trigger download in JavaScript
                string escapedPath = JsonConvert.SerializeObject(filePath ?? string.Empty);
                ExecuteScript($"window.pdfViewer.download({escapedPath});");
            }
            catch (Exception ex)
            {
                SetError($"SaveAs error: {ex.Message}");
            }
        }

        #endregion

        #region View Options

        [ComVisible(true)]
        [Description("Toggle sidebar visibility")]
        public void ToggleSidebar()
        {
            SetSidebarVisible(!_sidebarVisible);
        }

        [ComVisible(true)]
        [Description("Show thumbnails panel")]
        public void ShowThumbnails()
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                _sidebarVisible = true;
                ExecuteScript("window.pdfViewer.showThumbnails();");
            }
            catch (Exception ex)
            {
                SetError($"ShowThumbnails error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Show bookmarks panel")]
        public void ShowBookmarks()
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                _sidebarVisible = true;
                ExecuteScript("window.pdfViewer.showBookmarks();");
            }
            catch (Exception ex)
            {
                SetError($"ShowBookmarks error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Rotate clockwise")]
        public void RotateClockwise()
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                ExecuteScript("window.pdfViewer.rotateClockwise();");
            }
            catch (Exception ex)
            {
                SetError($"RotateClockwise error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Rotate counter-clockwise")]
        public void RotateCounterClockwise()
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                ExecuteScript("window.pdfViewer.rotateCounterClockwise();");
            }
            catch (Exception ex)
            {
                SetError($"RotateCounterClockwise error: {ex.Message}");
            }
        }

        #endregion

        #region Standard WebView2 Methods

        [ComVisible(true)]
        [Description("Navigate to a URL")]
        public void Navigate(string url)
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                if (string.IsNullOrEmpty(url))
                {
                    SetError("URL cannot be empty");
                    return;
                }

                _webView.CoreWebView2.Navigate(url);
            }
            catch (Exception ex)
            {
                SetError($"Navigate error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Refresh the current page")]
        public new void Refresh()
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                _webView.CoreWebView2.Reload();
            }
            catch (Exception ex)
            {
                SetError($"Refresh error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Execute JavaScript code")]
        public async void ExecuteScript(string script)
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                if (string.IsNullOrEmpty(script))
                {
                    SetError("Script cannot be empty");
                    return;
                }

                await _webView.CoreWebView2.ExecuteScriptAsync(script);
            }
            catch (Exception ex)
            {
                SetError($"ExecuteScript error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Post a message to JavaScript")]
        public void PostMessage(string message)
        {
            try
            {
                if (!_isReady || _webView == null)
                {
                    SetError("WebView2 not ready");
                    return;
                }

                if (string.IsNullOrEmpty(message))
                {
                    SetError("Message cannot be empty");
                    return;
                }

                _webView.CoreWebView2.PostWebMessageAsString(message);
            }
            catch (Exception ex)
            {
                SetError($"PostMessage error: {ex.Message}");
            }
        }

        [ComVisible(true)]
        [Description("Shows control name and version information")]
        public void About()
        {
            try
            {
                var assembly = System.Reflection.Assembly.GetExecutingAssembly();
                var name = assembly.GetName().Name;
                var version = assembly.GetName().Version;
                var versionStr = $"{version.Major}.{version.Minor}.{version.Build}";

                MessageBox.Show(
                    $"{name}\nVersion: {versionStr}\n\nFull-featured PDF viewer with:\n- Zoom and Navigation\n- Search\n- Annotations\n- Thumbnails and Bookmarks\n- Print Support\n\nPowered by PDF.js (Mozilla)\nWebView2 Runtime: {CoreWebView2Environment.GetAvailableBrowserVersionString()}",
                    "About",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
            }
            catch { }
        }

        #endregion

        #region Helper Methods

        internal void SetError(string error)
        {
            _lastError = error ?? string.Empty;
            RaiseErrorOccurred(_lastError);
        }

        #endregion

        #region Event Raising Methods

        private void RaiseControlReady()
        {
            if (ControlReady != null)
            {
                try { ControlReady(); }
                catch { }
            }
        }

        private void RaiseErrorOccurred(string errorMessage)
        {
            if (ErrorOccurred != null)
            {
                try { ErrorOccurred(errorMessage ?? string.Empty); }
                catch { }
            }
        }

        private void RaiseNavigationCompleted(string url, bool success)
        {
            if (NavigationCompleted != null)
            {
                try { NavigationCompleted(url ?? string.Empty, success); }
                catch { }
            }
        }

        private void RaiseNavigationStarting(string url)
        {
            if (NavigationStarting != null)
            {
                try { NavigationStarting(url ?? string.Empty); }
                catch { }
            }
        }

        private void RaiseDocumentLoaded(int pageCount, string title)
        {
            if (DocumentLoaded != null)
            {
                try { DocumentLoaded(pageCount, title ?? string.Empty); }
                catch { }
            }
        }

        private void RaisePageChanged(int pageNumber)
        {
            if (PageChanged != null)
            {
                try { PageChanged(pageNumber); }
                catch { }
            }
        }

        private void RaiseZoomChanged(double zoomLevel)
        {
            if (ZoomChanged != null)
            {
                try { ZoomChanged(zoomLevel); }
                catch { }
            }
        }

        private void RaiseSearchCompleted(int matchCount, int currentMatch)
        {
            if (SearchCompleted != null)
            {
                try { SearchCompleted(matchCount, currentMatch); }
                catch { }
            }
        }

        private void RaiseAnnotationAdded(string annotationType, int pageNumber)
        {
            if (AnnotationAdded != null)
            {
                try { AnnotationAdded(annotationType ?? string.Empty, pageNumber); }
                catch { }
            }
        }

        private void RaiseAnnotationSelected(string annotationId, string annotationType)
        {
            if (AnnotationSelected != null)
            {
                try { AnnotationSelected(annotationId ?? string.Empty, annotationType ?? string.Empty); }
                catch { }
            }
        }

        private void RaiseBookmarkClicked(string title, int pageNumber)
        {
            if (BookmarkClicked != null)
            {
                try { BookmarkClicked(title ?? string.Empty, pageNumber); }
                catch { }
            }
        }

        private void RaiseThumbnailClicked(int pageNumber)
        {
            if (ThumbnailClicked != null)
            {
                try { ThumbnailClicked(pageNumber); }
                catch { }
            }
        }

        private void RaiseTextSelected(string selectedText, int pageNumber)
        {
            if (TextSelected != null)
            {
                try { TextSelected(selectedText ?? string.Empty, pageNumber); }
                catch { }
            }
        }

        private void RaiseLinkClicked(string url, bool isInternal)
        {
            if (LinkClicked != null)
            {
                try { LinkClicked(url ?? string.Empty, isInternal); }
                catch { }
            }
        }

        private void RaisePrintCompleted(bool success)
        {
            if (PrintCompleted != null)
            {
                try { PrintCompleted(success); }
                catch { }
            }
        }

        private void RaiseViewerReady()
        {
            if (ViewerReady != null)
            {
                try { ViewerReady(); }
                catch { }
            }
        }

        #endregion

        #region Cleanup

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                if (_webView != null)
                {
                    _webView.Dispose();
                    _webView = null;
                }
            }

            base.Dispose(disposing);
        }

        #endregion
    }
}
