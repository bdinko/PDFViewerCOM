using System;
using System.Runtime.InteropServices;

namespace PDFViewerCOM
{
    /// <summary>
    /// COM event interface for the PDFViewerCOM Control.
    /// This defines all events that can be fired to Clarion.
    /// </summary>
    [ComVisible(true)]
    [InterfaceType(ComInterfaceType.InterfaceIsIDispatch)]
    [Guid("b5cd456b-4dda-4097-9880-57a41ac16ecf")]
    public interface IPDFViewerCOMControlEvents
    {
        /// <summary>
        /// Fired when WebView2 is fully initialized and ready for use.
        /// </summary>
        [DispId(1)]
        void ControlReady();

        /// <summary>
        /// Fired when an error occurs.
        /// </summary>
        /// <param name="errorMessage">Description of the error</param>
        [DispId(2)]
        void ErrorOccurred(string errorMessage);

        /// <summary>
        /// Fired when navigation completes.
        /// </summary>
        /// <param name="url">The URL that was navigated to</param>
        /// <param name="success">Whether navigation succeeded</param>
        [DispId(3)]
        void NavigationCompleted(string url, bool success);

        /// <summary>
        /// Fired when navigation starts.
        /// </summary>
        /// <param name="url">The URL being navigated to</param>
        [DispId(4)]
        void NavigationStarting(string url);

        /// <summary>
        /// Fired when a PDF document is loaded successfully.
        /// </summary>
        /// <param name="pageCount">Total number of pages in the document</param>
        /// <param name="title">Document title (if available)</param>
        [DispId(5)]
        void DocumentLoaded(int pageCount, string title);

        /// <summary>
        /// Fired when the current page changes.
        /// </summary>
        /// <param name="pageNumber">The new current page number (1-based)</param>
        [DispId(6)]
        void PageChanged(int pageNumber);

        /// <summary>
        /// Fired when the zoom level changes.
        /// </summary>
        /// <param name="zoomLevel">The new zoom level (1.0 = 100%)</param>
        [DispId(7)]
        void ZoomChanged(double zoomLevel);

        /// <summary>
        /// Fired when a search completes.
        /// </summary>
        /// <param name="matchCount">Number of matches found</param>
        /// <param name="currentMatch">Current match index (1-based)</param>
        [DispId(8)]
        void SearchCompleted(int matchCount, int currentMatch);

        /// <summary>
        /// Fired when an annotation is added.
        /// </summary>
        /// <param name="annotationType">Type of annotation (highlight, note, drawing)</param>
        /// <param name="pageNumber">Page where annotation was added</param>
        [DispId(9)]
        void AnnotationAdded(string annotationType, int pageNumber);

        /// <summary>
        /// Fired when an annotation is selected.
        /// </summary>
        /// <param name="annotationId">ID of the selected annotation</param>
        /// <param name="annotationType">Type of annotation</param>
        [DispId(10)]
        void AnnotationSelected(string annotationId, string annotationType);

        /// <summary>
        /// Fired when a bookmark/outline item is clicked.
        /// </summary>
        /// <param name="title">Title of the bookmark</param>
        /// <param name="pageNumber">Destination page number</param>
        [DispId(11)]
        void BookmarkClicked(string title, int pageNumber);

        /// <summary>
        /// Fired when a thumbnail is clicked.
        /// </summary>
        /// <param name="pageNumber">Page number of the clicked thumbnail</param>
        [DispId(12)]
        void ThumbnailClicked(int pageNumber);

        /// <summary>
        /// Fired when text is selected in the PDF.
        /// </summary>
        /// <param name="selectedText">The selected text</param>
        /// <param name="pageNumber">Page where text was selected</param>
        [DispId(13)]
        void TextSelected(string selectedText, int pageNumber);

        /// <summary>
        /// Fired when a link in the PDF is clicked.
        /// </summary>
        /// <param name="url">The URL of the link</param>
        /// <param name="isInternal">True if link is internal to the document</param>
        [DispId(14)]
        void LinkClicked(string url, bool isInternal);

        /// <summary>
        /// Fired when print operation completes.
        /// </summary>
        /// <param name="success">Whether print was successful</param>
        [DispId(15)]
        void PrintCompleted(bool success);

        /// <summary>
        /// Fired when the PDF viewer JavaScript component is fully initialized and ready to load documents.
        /// Use this event instead of ControlReady to call LoadFile, LoadUrl, or LoadBase64.
        /// </summary>
        [DispId(16)]
        void ViewerReady();
    }
}
