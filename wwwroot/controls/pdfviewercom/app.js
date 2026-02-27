// PDFViewerCOM Control JavaScript
// Full-featured PDF viewer using PDF.js

const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs');

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';

class PDFViewer {
    constructor() {
        this.pdfDoc = null;
        this.currentPage = 1;
        this.pageCount = 0;
        this.scale = 1.0;
        this.rotation = 0;
        this.renderTask = null;
        this.searchMatches = [];
        this.currentSearchIndex = 0;
        this.searchText = '';
        this.sidebarVisible = true;
        this.annotationsEnabled = true;
        this.drawingEnabled = false;
        this.drawingColor = '#000000';
        this.drawingWidth = 2;
        this.annotations = [];

        this.initializeElements();
        this.bindEvents();
        this.sendMessage('ready', {});
    }

    initializeElements() {
        // Toolbar elements
        this.btnSidebar = document.getElementById('btn-sidebar');
        this.btnFirst = document.getElementById('btn-first');
        this.btnPrev = document.getElementById('btn-prev');
        this.btnNext = document.getElementById('btn-next');
        this.btnLast = document.getElementById('btn-last');
        this.pageInput = document.getElementById('page-input');
        this.pageCountEl = document.getElementById('page-count');
        this.btnZoomIn = document.getElementById('btn-zoom-in');
        this.btnZoomOut = document.getElementById('btn-zoom-out');
        this.zoomSelect = document.getElementById('zoom-select');
        this.btnRotateCW = document.getElementById('btn-rotate-cw');
        this.btnRotateCCW = document.getElementById('btn-rotate-ccw');
        this.searchInput = document.getElementById('search-input');
        this.btnSearchPrev = document.getElementById('btn-search-prev');
        this.btnSearchNext = document.getElementById('btn-search-next');
        this.searchResults = document.getElementById('search-results');
        this.btnHighlight = document.getElementById('btn-highlight');
        this.btnNote = document.getElementById('btn-note');
        this.btnDraw = document.getElementById('btn-draw');
        this.btnPrint = document.getElementById('btn-print');
        this.btnDownload = document.getElementById('btn-download');

        // Sidebar elements
        this.sidebar = document.getElementById('sidebar');
        this.tabThumbnails = document.getElementById('tab-thumbnails');
        this.tabBookmarks = document.getElementById('tab-bookmarks');
        this.thumbnailsContainer = document.getElementById('thumbnails-container');
        this.bookmarksContainer = document.getElementById('bookmarks-container');

        // Viewer elements
        this.viewerContainer = document.getElementById('viewer-container');
        this.viewer = document.getElementById('viewer');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.errorContainer = document.getElementById('error-container');
        this.errorMessage = document.getElementById('error-message');
        this.welcomeMessage = document.getElementById('welcome-message');
    }

    bindEvents() {
        // Navigation
        this.btnFirst.addEventListener('click', () => this.firstPage());
        this.btnPrev.addEventListener('click', () => this.previousPage());
        this.btnNext.addEventListener('click', () => this.nextPage());
        this.btnLast.addEventListener('click', () => this.lastPage());
        this.pageInput.addEventListener('change', (e) => this.goToPage(parseInt(e.target.value)));
        this.pageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.goToPage(parseInt(e.target.value));
        });

        // Zoom
        this.btnZoomIn.addEventListener('click', () => this.zoomIn());
        this.btnZoomOut.addEventListener('click', () => this.zoomOut());
        this.zoomSelect.addEventListener('change', (e) => {
            const value = e.target.value;
            if (value === 'fit-width') this.fitWidth();
            else if (value === 'fit-page') this.fitPage();
            else this.setZoom(parseFloat(value));
        });

        // Rotation
        this.btnRotateCW.addEventListener('click', () => this.rotateClockwise());
        this.btnRotateCCW.addEventListener('click', () => this.rotateCounterClockwise());

        // Search
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.search(e.target.value, false);
        });
        this.btnSearchPrev.addEventListener('click', () => this.findPrevious());
        this.btnSearchNext.addEventListener('click', () => this.findNext());

        // Annotations
        this.btnHighlight.addEventListener('click', () => this.highlightSelection('#FFFF00'));
        this.btnNote.addEventListener('click', () => this.toggleNoteMode());
        this.btnDraw.addEventListener('click', () => this.toggleDrawingMode());

        // Print/Download
        this.btnPrint.addEventListener('click', () => this.print());
        this.btnDownload.addEventListener('click', () => this.download());

        // Sidebar
        this.btnSidebar.addEventListener('click', () => this.toggleSidebar());
        this.tabThumbnails.addEventListener('click', () => this.showThumbnails());
        this.tabBookmarks.addEventListener('click', () => this.showBookmarks());

        // Scroll event for page tracking
        this.viewerContainer.addEventListener('scroll', () => this.handleScroll());

        // WebView2 message listener
        if (typeof chrome !== 'undefined' && chrome.webview) {
            chrome.webview.addEventListener('message', (event) => {
                if (typeof event.data === 'string') {
                    this.handleCSharpMessage(event.data);
                }
            });
        }
    }

    // Send message to C#
    sendMessage(type, data) {
        const message = JSON.stringify({ type, ...data });
        if (typeof chrome !== 'undefined' && chrome.webview) {
            chrome.webview.postMessage(message);
        }
        console.log('Message to C#:', type, data);
    }

    // Handle messages from C#
    handleCSharpMessage(messageJson) {
        try {
            const message = JSON.parse(messageJson);
            console.log('Message from C#:', message);
        } catch (error) {
            console.error('Error handling C# message:', error);
        }
    }

    // Show loading overlay
    showLoading() {
        this.loadingOverlay.classList.remove('hidden');
        this.welcomeMessage.classList.add('hidden');
        this.errorContainer.classList.add('hidden');
    }

    // Hide loading overlay
    hideLoading() {
        this.loadingOverlay.classList.add('hidden');
    }

    // Show error
    showError(message) {
        this.hideLoading();
        this.errorMessage.textContent = message;
        this.errorContainer.classList.remove('hidden');
        this.sendMessage('error', { error: message });
    }

    // Load PDF from URL
    async loadUrl(url) {
        this.showLoading();
        try {
            const loadingTask = pdfjsLib.getDocument(url);
            this.pdfDoc = await loadingTask.promise;
            await this.documentLoaded();
        } catch (error) {
            this.showError(`Failed to load PDF: ${error.message}`);
        }
    }

    // Load PDF from Base64
    async loadBase64(base64Data) {
        this.showLoading();
        try {
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const loadingTask = pdfjsLib.getDocument({ data: bytes });
            this.pdfDoc = await loadingTask.promise;
            await this.documentLoaded();
        } catch (error) {
            this.showError(`Failed to load PDF: ${error.message}`);
        }
    }

    // Document loaded handler
    async documentLoaded() {
        this.hideLoading();
        this.welcomeMessage.classList.add('hidden');
        this.errorContainer.classList.add('hidden');

        this.pageCount = this.pdfDoc.numPages;
        this.currentPage = 1;
        this.pageCountEl.textContent = `/ ${this.pageCount}`;
        this.pageInput.value = '1';

        // Get document title from metadata
        let title = '';
        try {
            const metadata = await this.pdfDoc.getMetadata();
            title = metadata.info?.Title || '';
        } catch (e) {}

        this.sendMessage('documentLoaded', { pageCount: this.pageCount, title });

        // Render all pages
        await this.renderAllPages();

        // Generate thumbnails
        await this.generateThumbnails();

        // Load bookmarks
        await this.loadBookmarks();
    }

    // Render all pages
    async renderAllPages() {
        this.viewer.innerHTML = '';

        for (let pageNum = 1; pageNum <= this.pageCount; pageNum++) {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'page-container';
            pageDiv.id = `page-${pageNum}`;
            pageDiv.setAttribute('data-page', pageNum);

            const canvas = document.createElement('canvas');
            canvas.className = 'page-canvas';

            const textLayer = document.createElement('div');
            textLayer.className = 'text-layer';

            const annotationLayer = document.createElement('div');
            annotationLayer.className = 'annotation-layer';

            pageDiv.appendChild(canvas);
            pageDiv.appendChild(textLayer);
            pageDiv.appendChild(annotationLayer);
            this.viewer.appendChild(pageDiv);

            await this.renderPage(pageNum, canvas, textLayer);
        }
    }

    // Render a single page
    async renderPage(pageNum, canvas, textLayer) {
        const page = await this.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: this.scale, rotation: this.rotation });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: canvas.getContext('2d'),
            viewport: viewport
        };

        await page.render(renderContext).promise;

        // Render text layer for selection and search
        const textContent = await page.getTextContent();
        textLayer.innerHTML = '';
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;

        // Simple text layer rendering
        textContent.items.forEach(item => {
            const div = document.createElement('span');
            div.textContent = item.str;
            const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
            div.style.left = `${tx[4]}px`;
            div.style.top = `${tx[5] - item.height}px`;
            div.style.fontSize = `${item.height}px`;
            div.style.fontFamily = item.fontName || 'sans-serif';
            textLayer.appendChild(div);
        });
    }

    // Re-render all pages (after zoom/rotation change)
    async rerenderAllPages() {
        const pages = this.viewer.querySelectorAll('.page-container');
        for (const pageDiv of pages) {
            const pageNum = parseInt(pageDiv.getAttribute('data-page'));
            const canvas = pageDiv.querySelector('.page-canvas');
            const textLayer = pageDiv.querySelector('.text-layer');
            await this.renderPage(pageNum, canvas, textLayer);
        }
    }

    // Navigation methods
    goToPage(pageNumber) {
        if (!this.pdfDoc) return;
        if (pageNumber < 1) pageNumber = 1;
        if (pageNumber > this.pageCount) pageNumber = this.pageCount;

        this.currentPage = pageNumber;
        this.pageInput.value = pageNumber;

        const pageEl = document.getElementById(`page-${pageNumber}`);
        if (pageEl) {
            pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        this.sendMessage('pageChanged', { pageNumber });
        this.updateThumbnailSelection();
    }

    nextPage() {
        if (this.currentPage < this.pageCount) {
            this.goToPage(this.currentPage + 1);
        }
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.goToPage(this.currentPage - 1);
        }
    }

    firstPage() {
        this.goToPage(1);
    }

    lastPage() {
        this.goToPage(this.pageCount);
    }

    // Handle scroll to track current page
    handleScroll() {
        if (!this.pdfDoc) return;

        const pages = this.viewer.querySelectorAll('.page-container');
        const containerRect = this.viewerContainer.getBoundingClientRect();
        const containerCenter = containerRect.top + containerRect.height / 2;

        let closestPage = 1;
        let closestDistance = Infinity;

        pages.forEach(page => {
            const rect = page.getBoundingClientRect();
            const pageCenter = rect.top + rect.height / 2;
            const distance = Math.abs(pageCenter - containerCenter);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestPage = parseInt(page.getAttribute('data-page'));
            }
        });

        if (closestPage !== this.currentPage) {
            this.currentPage = closestPage;
            this.pageInput.value = closestPage;
            this.sendMessage('pageChanged', { pageNumber: closestPage });
            this.updateThumbnailSelection();
        }
    }

    // Zoom methods
    zoomIn() {
        this.setZoom(this.scale + 0.25);
    }

    zoomOut() {
        this.setZoom(this.scale - 0.25);
    }

    async setZoom(scale) {
        if (scale < 0.25) scale = 0.25;
        if (scale > 4) scale = 4;

        this.scale = scale;

        // Update select
        const option = Array.from(this.zoomSelect.options).find(o => parseFloat(o.value) === scale);
        if (option) {
            this.zoomSelect.value = scale.toString();
        } else {
            this.zoomSelect.value = scale.toString();
        }

        await this.rerenderAllPages();
        this.sendMessage('zoomChanged', { zoomLevel: scale });
    }

    async fitWidth() {
        if (!this.pdfDoc) return;
        const page = await this.pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 1, rotation: this.rotation });
        const containerWidth = this.viewerContainer.clientWidth - 40; // padding
        const scale = containerWidth / viewport.width;
        await this.setZoom(scale);
    }

    async fitPage() {
        if (!this.pdfDoc) return;
        const page = await this.pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 1, rotation: this.rotation });
        const containerWidth = this.viewerContainer.clientWidth - 40;
        const containerHeight = this.viewerContainer.clientHeight - 40;
        const scaleW = containerWidth / viewport.width;
        const scaleH = containerHeight / viewport.height;
        await this.setZoom(Math.min(scaleW, scaleH));
    }

    // Rotation methods
    async rotateClockwise() {
        this.rotation = (this.rotation + 90) % 360;
        await this.rerenderAllPages();
        await this.generateThumbnails();
    }

    async rotateCounterClockwise() {
        this.rotation = (this.rotation - 90 + 360) % 360;
        await this.rerenderAllPages();
        await this.generateThumbnails();
    }

    // Search methods
    async search(text, caseSensitive) {
        if (!this.pdfDoc || !text) return;

        this.searchText = text;
        this.searchMatches = [];
        this.currentSearchIndex = 0;

        // Clear previous highlights
        document.querySelectorAll('.search-highlight').forEach(el => el.remove());

        const searchRegex = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');

        for (let pageNum = 1; pageNum <= this.pageCount; pageNum++) {
            const page = await this.pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');

            let match;
            while ((match = searchRegex.exec(pageText)) !== null) {
                this.searchMatches.push({ page: pageNum, index: match.index });
            }
        }

        this.updateSearchResults();

        if (this.searchMatches.length > 0) {
            this.highlightCurrentMatch();
        }

        this.sendMessage('searchCompleted', {
            matchCount: this.searchMatches.length,
            currentMatch: this.searchMatches.length > 0 ? 1 : 0
        });
    }

    findNext() {
        if (this.searchMatches.length === 0) return;
        this.currentSearchIndex = (this.currentSearchIndex + 1) % this.searchMatches.length;
        this.highlightCurrentMatch();
        this.updateSearchResults();
    }

    findPrevious() {
        if (this.searchMatches.length === 0) return;
        this.currentSearchIndex = (this.currentSearchIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
        this.highlightCurrentMatch();
        this.updateSearchResults();
    }

    highlightCurrentMatch() {
        if (this.searchMatches.length === 0) return;
        const match = this.searchMatches[this.currentSearchIndex];
        this.goToPage(match.page);
    }

    updateSearchResults() {
        if (this.searchMatches.length === 0) {
            this.searchResults.textContent = 'No matches';
        } else {
            this.searchResults.textContent = `${this.currentSearchIndex + 1} of ${this.searchMatches.length}`;
        }
    }

    clearSearch() {
        this.searchText = '';
        this.searchMatches = [];
        this.currentSearchIndex = 0;
        this.searchInput.value = '';
        this.searchResults.textContent = '';
        document.querySelectorAll('.search-highlight').forEach(el => el.remove());
    }

    // Sidebar methods
    toggleSidebar() {
        this.sidebarVisible = !this.sidebarVisible;
        this.sidebar.classList.toggle('hidden', !this.sidebarVisible);
        this.btnSidebar.classList.toggle('active', this.sidebarVisible);
    }

    setSidebarVisible(visible) {
        this.sidebarVisible = visible;
        this.sidebar.classList.toggle('hidden', !visible);
        this.btnSidebar.classList.toggle('active', visible);
    }

    showThumbnails() {
        this.tabThumbnails.classList.add('active');
        this.tabBookmarks.classList.remove('active');
        this.thumbnailsContainer.classList.add('active');
        this.bookmarksContainer.classList.remove('active');
    }

    showBookmarks() {
        this.tabThumbnails.classList.remove('active');
        this.tabBookmarks.classList.add('active');
        this.thumbnailsContainer.classList.remove('active');
        this.bookmarksContainer.classList.add('active');
    }

    async generateThumbnails() {
        if (!this.pdfDoc) return;

        this.thumbnailsContainer.innerHTML = '';
        const thumbnailScale = 0.2;

        for (let pageNum = 1; pageNum <= this.pageCount; pageNum++) {
            const page = await this.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: thumbnailScale, rotation: this.rotation });

            const thumbDiv = document.createElement('div');
            thumbDiv.className = 'thumbnail';
            thumbDiv.setAttribute('data-page', pageNum);
            if (pageNum === this.currentPage) thumbDiv.classList.add('selected');

            const canvas = document.createElement('canvas');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const context = canvas.getContext('2d');
            await page.render({ canvasContext: context, viewport }).promise;

            const label = document.createElement('div');
            label.className = 'thumbnail-label';
            label.textContent = pageNum;

            thumbDiv.appendChild(canvas);
            thumbDiv.appendChild(label);
            thumbDiv.addEventListener('click', () => {
                this.goToPage(pageNum);
                this.sendMessage('thumbnailClicked', { pageNumber: pageNum });
            });

            this.thumbnailsContainer.appendChild(thumbDiv);
        }
    }

    updateThumbnailSelection() {
        document.querySelectorAll('.thumbnail').forEach(thumb => {
            const page = parseInt(thumb.getAttribute('data-page'));
            thumb.classList.toggle('selected', page === this.currentPage);
        });

        // Scroll thumbnail into view
        const selectedThumb = document.querySelector('.thumbnail.selected');
        if (selectedThumb) {
            selectedThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    async loadBookmarks() {
        if (!this.pdfDoc) return;

        this.bookmarksContainer.innerHTML = '';

        try {
            const outline = await this.pdfDoc.getOutline();
            if (outline && outline.length > 0) {
                this.renderBookmarks(outline, this.bookmarksContainer, 0);
            } else {
                this.bookmarksContainer.innerHTML = '<div class="no-bookmarks">No bookmarks available</div>';
            }
        } catch (error) {
            this.bookmarksContainer.innerHTML = '<div class="no-bookmarks">Could not load bookmarks</div>';
        }
    }

    renderBookmarks(items, container, level) {
        items.forEach(item => {
            const bookmarkDiv = document.createElement('div');
            bookmarkDiv.className = 'bookmark-item';
            bookmarkDiv.style.paddingLeft = `${level * 16 + 8}px`;

            const title = document.createElement('span');
            title.className = 'bookmark-title';
            title.textContent = item.title;

            bookmarkDiv.appendChild(title);
            bookmarkDiv.addEventListener('click', async () => {
                if (item.dest) {
                    let pageIndex;
                    if (typeof item.dest === 'string') {
                        const dest = await this.pdfDoc.getDestination(item.dest);
                        const ref = dest[0];
                        pageIndex = await this.pdfDoc.getPageIndex(ref);
                    } else {
                        const ref = item.dest[0];
                        pageIndex = await this.pdfDoc.getPageIndex(ref);
                    }
                    this.goToPage(pageIndex + 1);
                    this.sendMessage('bookmarkClicked', { title: item.title, pageNumber: pageIndex + 1 });
                }
            });

            container.appendChild(bookmarkDiv);

            if (item.items && item.items.length > 0) {
                this.renderBookmarks(item.items, container, level + 1);
            }
        });
    }

    // Annotation methods
    highlightSelection(color) {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        // For now, just notify C#
        this.sendMessage('annotationAdded', { annotationType: 'highlight', pageNumber: this.currentPage });
    }

    toggleNoteMode() {
        this.btnNote.classList.toggle('active');
        // TODO: Implement note mode
    }

    addNote(pageNumber, x, y, text) {
        // TODO: Implement note creation
        this.sendMessage('annotationAdded', { annotationType: 'note', pageNumber });
    }

    toggleDrawingMode() {
        this.drawingEnabled = !this.drawingEnabled;
        this.btnDraw.classList.toggle('active', this.drawingEnabled);
    }

    enableDrawing(color, width) {
        this.drawingEnabled = true;
        this.drawingColor = color;
        this.drawingWidth = width;
        this.btnDraw.classList.add('active');
    }

    disableDrawing() {
        this.drawingEnabled = false;
        this.btnDraw.classList.remove('active');
    }

    clearAnnotations() {
        this.annotations = [];
        // TODO: Clear visual annotations
    }

    setAnnotationsEnabled(enabled) {
        this.annotationsEnabled = enabled;
    }

    exportAnnotations() {
        return JSON.stringify(this.annotations);
    }

    importAnnotations(json) {
        try {
            this.annotations = JSON.parse(json);
            // TODO: Render annotations
        } catch (e) {
            console.error('Failed to import annotations:', e);
        }
    }

    // Print and download
    print() {
        window.print();
        this.sendMessage('printCompleted', { success: true });
    }

    download(filename) {
        // For now, just trigger print which allows save as PDF
        // A full implementation would use pdf-lib to export
        window.print();
    }

    // Close document
    closeDocument() {
        this.pdfDoc = null;
        this.pageCount = 0;
        this.currentPage = 1;
        this.viewer.innerHTML = '';
        this.thumbnailsContainer.innerHTML = '';
        this.bookmarksContainer.innerHTML = '';
        this.pageCountEl.textContent = '/ 0';
        this.pageInput.value = '1';
        this.welcomeMessage.classList.remove('hidden');
    }
}

// Create global instance
window.pdfViewer = new PDFViewer();

// Expose methods for C# calls
window.pdfViewer.loadUrl = window.pdfViewer.loadUrl.bind(window.pdfViewer);
window.pdfViewer.loadBase64 = window.pdfViewer.loadBase64.bind(window.pdfViewer);
window.pdfViewer.goToPage = window.pdfViewer.goToPage.bind(window.pdfViewer);
window.pdfViewer.nextPage = window.pdfViewer.nextPage.bind(window.pdfViewer);
window.pdfViewer.previousPage = window.pdfViewer.previousPage.bind(window.pdfViewer);
window.pdfViewer.firstPage = window.pdfViewer.firstPage.bind(window.pdfViewer);
window.pdfViewer.lastPage = window.pdfViewer.lastPage.bind(window.pdfViewer);
window.pdfViewer.zoomIn = window.pdfViewer.zoomIn.bind(window.pdfViewer);
window.pdfViewer.zoomOut = window.pdfViewer.zoomOut.bind(window.pdfViewer);
window.pdfViewer.setZoom = window.pdfViewer.setZoom.bind(window.pdfViewer);
window.pdfViewer.fitWidth = window.pdfViewer.fitWidth.bind(window.pdfViewer);
window.pdfViewer.fitPage = window.pdfViewer.fitPage.bind(window.pdfViewer);
window.pdfViewer.rotateClockwise = window.pdfViewer.rotateClockwise.bind(window.pdfViewer);
window.pdfViewer.rotateCounterClockwise = window.pdfViewer.rotateCounterClockwise.bind(window.pdfViewer);
window.pdfViewer.search = window.pdfViewer.search.bind(window.pdfViewer);
window.pdfViewer.findNext = window.pdfViewer.findNext.bind(window.pdfViewer);
window.pdfViewer.findPrevious = window.pdfViewer.findPrevious.bind(window.pdfViewer);
window.pdfViewer.clearSearch = window.pdfViewer.clearSearch.bind(window.pdfViewer);
window.pdfViewer.highlightSelection = window.pdfViewer.highlightSelection.bind(window.pdfViewer);
window.pdfViewer.addNote = window.pdfViewer.addNote.bind(window.pdfViewer);
window.pdfViewer.enableDrawing = window.pdfViewer.enableDrawing.bind(window.pdfViewer);
window.pdfViewer.disableDrawing = window.pdfViewer.disableDrawing.bind(window.pdfViewer);
window.pdfViewer.clearAnnotations = window.pdfViewer.clearAnnotations.bind(window.pdfViewer);
window.pdfViewer.exportAnnotations = window.pdfViewer.exportAnnotations.bind(window.pdfViewer);
window.pdfViewer.importAnnotations = window.pdfViewer.importAnnotations.bind(window.pdfViewer);
window.pdfViewer.print = window.pdfViewer.print.bind(window.pdfViewer);
window.pdfViewer.download = window.pdfViewer.download.bind(window.pdfViewer);
window.pdfViewer.toggleSidebar = window.pdfViewer.toggleSidebar.bind(window.pdfViewer);
window.pdfViewer.setSidebarVisible = window.pdfViewer.setSidebarVisible.bind(window.pdfViewer);
window.pdfViewer.showThumbnails = window.pdfViewer.showThumbnails.bind(window.pdfViewer);
window.pdfViewer.showBookmarks = window.pdfViewer.showBookmarks.bind(window.pdfViewer);
window.pdfViewer.closeDocument = window.pdfViewer.closeDocument.bind(window.pdfViewer);
window.pdfViewer.setAnnotationsEnabled = window.pdfViewer.setAnnotationsEnabled.bind(window.pdfViewer);
