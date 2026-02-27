using System;
using System.Runtime.InteropServices;

namespace PDFViewerCOM
{
    /// <summary>
    /// Main COM interface for the PDFViewerCOM Control.
    /// Full-featured PDF viewer with annotations, search, thumbnails, bookmarks, and print support.
    /// This defines all properties and methods that Clarion can call.
    /// </summary>
    [ComVisible(true)]
    [Guid("fb694e21-68af-4a45-907e-88867de9fd93")]
    [InterfaceType(ComInterfaceType.InterfaceIsDual)]
    public interface IPDFViewerCOMControl
    {
        #region State Accessor Methods

        /// <summary>
        /// Gets whether WebView2 is fully initialized and ready.
        /// </summary>
        /// <returns>True if WebView2 is ready</returns>
        [DispId(1)]
        bool GetIsReady();

        /// <summary>
        /// Gets the last error message.
        /// </summary>
        /// <returns>The last error message or empty string</returns>
        [DispId(2)]
        string GetLastError();

        /// <summary>
        /// Gets the current source URL or file path.
        /// </summary>
        /// <returns>The current source URL or file path</returns>
        [DispId(3)]
        string GetSource();

        /// <summary>
        /// Gets the current page number (1-based).
        /// </summary>
        /// <returns>The current page number</returns>
        [DispId(4)]
        int GetCurrentPage();

        /// <summary>
        /// Gets the total number of pages in the PDF.
        /// </summary>
        /// <returns>The total page count</returns>
        [DispId(5)]
        int GetPageCount();

        /// <summary>
        /// Gets the zoom level (1.0 = 100%).
        /// </summary>
        /// <returns>The current zoom level</returns>
        [DispId(6)]
        double GetZoomLevel();

        /// <summary>
        /// Sets the zoom level (1.0 = 100%).
        /// </summary>
        /// <param name="value">The zoom level to set</param>
        [DispId(90)]
        void SetZoomLevel(double value);

        /// <summary>
        /// Gets whether the sidebar (thumbnails/bookmarks) is visible.
        /// </summary>
        /// <returns>True if sidebar is visible</returns>
        [DispId(7)]
        bool GetSidebarVisible();

        /// <summary>
        /// Sets whether the sidebar (thumbnails/bookmarks) is visible.
        /// </summary>
        /// <param name="value">True to show sidebar, false to hide</param>
        [DispId(91)]
        void SetSidebarVisible(bool value);

        /// <summary>
        /// Gets whether annotations are enabled.
        /// </summary>
        /// <returns>True if annotations are enabled</returns>
        [DispId(8)]
        bool GetAnnotationsEnabled();

        /// <summary>
        /// Sets whether annotations are enabled.
        /// </summary>
        /// <param name="value">True to enable annotations, false to disable</param>
        [DispId(92)]
        void SetAnnotationsEnabled(bool value);

        #endregion

        #region Document Operations

        /// <summary>
        /// Load a PDF file from a file path.
        /// </summary>
        /// <param name="filePath">Full path to the PDF file</param>
        [DispId(10)]
        void LoadFile(string filePath);

        /// <summary>
        /// Load a PDF from a URL.
        /// </summary>
        /// <param name="url">URL to the PDF document</param>
        [DispId(11)]
        void LoadUrl(string url);

        /// <summary>
        /// Load a PDF from Base64-encoded data.
        /// </summary>
        /// <param name="base64Data">Base64-encoded PDF data</param>
        [DispId(12)]
        void LoadBase64(string base64Data);

        /// <summary>
        /// Close the current PDF document.
        /// </summary>
        [DispId(13)]
        void CloseDocument();

        #endregion

        #region Navigation

        /// <summary>
        /// Navigate to a specific page.
        /// </summary>
        /// <param name="pageNumber">Page number (1-based)</param>
        [DispId(20)]
        void GoToPage(int pageNumber);

        /// <summary>
        /// Navigate to the next page.
        /// </summary>
        [DispId(21)]
        void NextPage();

        /// <summary>
        /// Navigate to the previous page.
        /// </summary>
        [DispId(22)]
        void PreviousPage();

        /// <summary>
        /// Navigate to the first page.
        /// </summary>
        [DispId(23)]
        void FirstPage();

        /// <summary>
        /// Navigate to the last page.
        /// </summary>
        [DispId(24)]
        void LastPage();

        #endregion

        #region Zoom Operations

        /// <summary>
        /// Zoom in by a standard increment.
        /// </summary>
        [DispId(30)]
        void ZoomIn();

        /// <summary>
        /// Zoom out by a standard increment.
        /// </summary>
        [DispId(31)]
        void ZoomOut();

        /// <summary>
        /// Set zoom level to a specific percentage.
        /// </summary>
        /// <param name="percentage">Zoom percentage (e.g., 100 for 100%)</param>
        [DispId(32)]
        void SetZoom(double percentage);

        /// <summary>
        /// Fit the page width to the viewer width.
        /// </summary>
        [DispId(33)]
        void FitWidth();

        /// <summary>
        /// Fit the entire page in the viewer.
        /// </summary>
        [DispId(34)]
        void FitPage();

        /// <summary>
        /// Reset zoom to 100%.
        /// </summary>
        [DispId(35)]
        void ActualSize();

        #endregion

        #region Search

        /// <summary>
        /// Search for text in the document.
        /// </summary>
        /// <param name="searchText">Text to search for</param>
        /// <param name="caseSensitive">Whether search is case-sensitive</param>
        [DispId(40)]
        void Search(string searchText, bool caseSensitive);

        /// <summary>
        /// Find the next occurrence of the search text.
        /// </summary>
        [DispId(41)]
        void FindNext();

        /// <summary>
        /// Find the previous occurrence of the search text.
        /// </summary>
        [DispId(42)]
        void FindPrevious();

        /// <summary>
        /// Clear search highlighting.
        /// </summary>
        [DispId(43)]
        void ClearSearch();

        #endregion

        #region Annotations

        /// <summary>
        /// Add a highlight annotation to the current selection.
        /// </summary>
        /// <param name="color">Highlight color (e.g., "#FFFF00" for yellow)</param>
        [DispId(50)]
        void HighlightSelection(string color);

        /// <summary>
        /// Add a text note annotation at the specified position.
        /// </summary>
        /// <param name="pageNumber">Page number (1-based)</param>
        /// <param name="x">X coordinate</param>
        /// <param name="y">Y coordinate</param>
        /// <param name="text">Note text content</param>
        [DispId(51)]
        void AddNote(int pageNumber, double x, double y, string text);

        /// <summary>
        /// Enable drawing mode for freehand annotations.
        /// </summary>
        /// <param name="color">Stroke color</param>
        /// <param name="width">Stroke width in pixels</param>
        [DispId(52)]
        void EnableDrawing(string color, int width);

        /// <summary>
        /// Disable drawing mode.
        /// </summary>
        [DispId(53)]
        void DisableDrawing();

        /// <summary>
        /// Delete all annotations on the current page.
        /// </summary>
        [DispId(54)]
        void ClearAnnotations();

        /// <summary>
        /// Export annotations as JSON.
        /// </summary>
        /// <returns>JSON string containing all annotations</returns>
        [DispId(55)]
        string ExportAnnotations();

        /// <summary>
        /// Import annotations from JSON.
        /// </summary>
        /// <param name="annotationsJson">JSON string containing annotations</param>
        [DispId(56)]
        void ImportAnnotations(string annotationsJson);

        #endregion

        #region Print and Export

        /// <summary>
        /// Print the document using the system print dialog.
        /// </summary>
        [DispId(60)]
        void Print();

        /// <summary>
        /// Download/save the current PDF (including annotations if any).
        /// </summary>
        /// <param name="filePath">Destination file path</param>
        [DispId(61)]
        void SaveAs(string filePath);

        #endregion

        #region View Options

        /// <summary>
        /// Toggle the sidebar visibility (thumbnails/bookmarks panel).
        /// </summary>
        [DispId(70)]
        void ToggleSidebar();

        /// <summary>
        /// Show the thumbnails panel in the sidebar.
        /// </summary>
        [DispId(71)]
        void ShowThumbnails();

        /// <summary>
        /// Show the bookmarks/outline panel in the sidebar.
        /// </summary>
        [DispId(72)]
        void ShowBookmarks();

        /// <summary>
        /// Rotate the current page clockwise by 90 degrees.
        /// </summary>
        [DispId(73)]
        void RotateClockwise();

        /// <summary>
        /// Rotate the current page counter-clockwise by 90 degrees.
        /// </summary>
        [DispId(74)]
        void RotateCounterClockwise();

        #endregion

        #region Standard Methods

        /// <summary>
        /// Navigate to a URL (base WebView2 functionality).
        /// </summary>
        /// <param name="url">The URL to navigate to</param>
        [DispId(80)]
        void Navigate(string url);

        /// <summary>
        /// Refresh the current page.
        /// </summary>
        [DispId(81)]
        void Refresh();

        /// <summary>
        /// Execute JavaScript code in the current page.
        /// </summary>
        /// <param name="script">The JavaScript code to execute</param>
        [DispId(82)]
        void ExecuteScript(string script);

        /// <summary>
        /// Post a message to JavaScript.
        /// JavaScript can receive via: window.chrome.webview.addEventListener('message', handler)
        /// </summary>
        /// <param name="message">The message to send (string or JSON)</param>
        [DispId(83)]
        void PostMessage(string message);

        /// <summary>
        /// Displays control name and version information in a MessageBox.
        /// </summary>
        [DispId(84)]
        void About();

        #endregion
    }
}
