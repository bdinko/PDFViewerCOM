// PDFViewerCOM — app.js
// PDF.js loaded as regular script (not ES module) for WebView2 virtual host compatibility.

function sendInitError(msg) {
    if (typeof chrome !== 'undefined' && chrome.webview)
        chrome.webview.postMessage(JSON.stringify({ type: 'error', error: 'JS init failed: ' + msg }));
}

const pdfjsLib = window.pdfjsLib;
if (!pdfjsLib) {
    sendInitError('pdfjsLib not found');
    throw new Error('pdfjsLib not available');
}
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://localapp.clarioncontrols/lib/pdfjs/pdf.worker.min.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

// ─── PDFViewer class ─────────────────────────────────────────────────────────

class PDFViewer {
    constructor() {
        this.pdfDoc = null;
        this.currentPage = 1;
        this.pageCount = 0;
        this.scale = 1.0;
        this.rotation = 0;

        // Search
        this.searchText = '';
        this.searchMatches = [];   // [{page, overlays:[el]}]
        this.searchOverlays = [];  // all search overlay divs (for bulk removal)
        this.currentSearchIndex = 0;

        // Annotations
        this.annotations = [];     // [{id, type, page, ...}]

        // Notes
        this.noteModeActive = false;

        // Drawing
        this.drawingEnabled = false;
        this.drawMode = 'freehand';   // 'freehand' | 'rect' | 'circle'
        this.strokeColor = '#FF0000';
        this.fillColor = '';
        this.strokeWidth = 2;
        this.drawingBehindText = false;
        this.drawingHistory = {};     // {pageNum: [stroke]}
        this.isDrawing = false;
        this.drawStartX = 0;
        this.drawStartY = 0;
        this.lastX = 0;
        this.lastY = 0;
        this.currentStroke = null;
        this._drawingPageNum = null;
        this._rafPending = false;
        this._drawingToolbar = null;
        // Select/move state
        this.selectedPageNum = null;
        this.selectedStrokeIdx = -1;
        this.isDraggingStroke = false;
        this.dragLastX = 0;
        this.dragLastY = 0;

        // Permissions
        this._perms = { allowHighlight: true, allowNotes: true, allowDrawing: true, allowSaveAs: true };

        // Download
        this._pdfUrl = null;
        this._pdfBytes = null;
        this._pdfFilename = 'document.pdf';

        this.sidebarVisible = true;
        this.annotationsEnabled = true;

        this.initializeElements();
        this.bindEvents();
        this.sendMessage('ready', {});
    }

    initializeElements() {
        this.btnSidebar    = document.getElementById('btn-sidebar');
        this.btnFirst      = document.getElementById('btn-first');
        this.btnPrev       = document.getElementById('btn-prev');
        this.btnNext       = document.getElementById('btn-next');
        this.btnLast       = document.getElementById('btn-last');
        this.pageInput     = document.getElementById('page-input');
        this.pageCountEl   = document.getElementById('page-count');
        this.btnZoomIn     = document.getElementById('btn-zoom-in');
        this.btnZoomOut    = document.getElementById('btn-zoom-out');
        this.zoomSelect    = document.getElementById('zoom-select');
        this.btnRotateCW   = document.getElementById('btn-rotate-cw');
        this.btnRotateCCW  = document.getElementById('btn-rotate-ccw');
        this.searchInput   = document.getElementById('search-input');
        this.btnSearchPrev = document.getElementById('btn-search-prev');
        this.btnSearchNext = document.getElementById('btn-search-next');
        this.searchResults = document.getElementById('search-results');
        this.btnHighlight  = document.getElementById('btn-highlight');
        this.btnNote       = document.getElementById('btn-note');
        this.btnDraw       = document.getElementById('btn-draw');
        this.btnPrint      = document.getElementById('btn-print');
        this.btnDownload   = document.getElementById('btn-download');
        this.sidebar              = document.getElementById('sidebar');
        this.tabThumbnails        = document.getElementById('tab-thumbnails');
        this.tabBookmarks         = document.getElementById('tab-bookmarks');
        this.thumbnailsContainer  = document.getElementById('thumbnails-container');
        this.bookmarksContainer   = document.getElementById('bookmarks-container');
        this.viewerContainer  = document.getElementById('viewer-container');
        this.viewer           = document.getElementById('viewer');
        this.loadingOverlay   = document.getElementById('loading-overlay');
        this.errorContainer   = document.getElementById('error-container');
        this.errorMessage     = document.getElementById('error-message');
        this.welcomeMessage   = document.getElementById('welcome-message');
    }

    bindEvents() {
        this.btnFirst.addEventListener('click', () => this.firstPage());
        this.btnPrev.addEventListener('click', () => this.previousPage());
        this.btnNext.addEventListener('click', () => this.nextPage());
        this.btnLast.addEventListener('click', () => this.lastPage());
        this.pageInput.addEventListener('change', (e) => this.goToPage(parseInt(e.target.value)));
        this.pageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.goToPage(parseInt(e.target.value)); });

        this.btnZoomIn.addEventListener('click', () => this.zoomIn());
        this.btnZoomOut.addEventListener('click', () => this.zoomOut());
        this.zoomSelect.addEventListener('change', (e) => {
            const v = e.target.value;
            if (v === 'fit-width') this.fitWidth();
            else if (v === 'fit-page') this.fitPage();
            else this.setZoom(parseFloat(v));
        });

        this.btnRotateCW.addEventListener('click', () => this.rotateClockwise());
        this.btnRotateCCW.addEventListener('click', () => this.rotateCounterClockwise());

        this.searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.search(e.target.value, false); });
        this.searchInput.addEventListener('input', (e) => { if (!e.target.value) this.clearSearch(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.clearSearch(); });
        this.btnSearchPrev.addEventListener('click', () => this.findPrevious());
        this.btnSearchNext.addEventListener('click', () => this.findNext());

        this.btnHighlight.addEventListener('click', () => this.highlightSelection('#FFFF00'));
        this.btnNote.addEventListener('click', () => this.toggleNoteMode());
        this.btnDraw.addEventListener('click', () => this.toggleDrawingMode());

        this.btnPrint.addEventListener('click', () => this.print());
        this.btnDownload.addEventListener('click', () => this.download());

        this.btnSidebar.addEventListener('click', () => this.toggleSidebar());
        this.tabThumbnails.addEventListener('click', () => this.showThumbnails());
        this.tabBookmarks.addEventListener('click', () => this.showBookmarks());

        this.viewerContainer.addEventListener('scroll', () => this.handleScroll());
        this.viewer.addEventListener('click', (e) => this.handleViewerClick(e));

        if (typeof chrome !== 'undefined' && chrome.webview) {
            chrome.webview.addEventListener('message', (ev) => {
                if (typeof ev.data === 'string') this.handleCSharpMessage(ev.data);
            });
        }
    }

    sendMessage(type, data) {
        const msg = JSON.stringify({ type, ...data });
        if (typeof chrome !== 'undefined' && chrome.webview) chrome.webview.postMessage(msg);
        console.log('→C#:', type, data);
    }

    handleCSharpMessage(json) {
        try { console.log('←C#:', JSON.parse(json)); } catch {}
    }

    // ── Loading / Error ────────────────────────────────────────────────────

    showLoading() {
        this.loadingOverlay.classList.remove('hidden');
        this.welcomeMessage.classList.add('hidden');
        this.errorContainer.classList.add('hidden');
    }
    hideLoading() { this.loadingOverlay.classList.add('hidden'); }
    showError(msg) {
        this.hideLoading();
        this.errorMessage.textContent = msg;
        this.errorContainer.classList.remove('hidden');
        this.sendMessage('error', { error: msg });
    }

    // ── Load ──────────────────────────────────────────────────────────────

    async loadUrl(url) {
        this.showLoading();
        this._pdfUrl = url;
        this._pdfBytes = null;
        const name = url.split('/').pop().split('?')[0] || 'document.pdf';
        this._pdfFilename = name.toLowerCase().endsWith('.pdf') ? name : name + '.pdf';
        try {
            this.pdfDoc = await pdfjsLib.getDocument(url).promise;
            await this.documentLoaded();
        } catch (e) { this.showError('Failed to load PDF: ' + e.message); }
    }

    async loadBase64(b64) {
        this.showLoading();
        this._pdfUrl = null;
        this._pdfFilename = 'document.pdf';
        try {
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            this._pdfBytes = bytes;
            this.pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
            await this.documentLoaded();
        } catch (e) { this.showError('Failed to load PDF: ' + e.message); }
    }

    async documentLoaded() {
        this.hideLoading();
        this.welcomeMessage.classList.add('hidden');
        this.errorContainer.classList.add('hidden');
        this.pageCount = this.pdfDoc.numPages;
        this.currentPage = 1;
        this.pageCountEl.textContent = `/ ${this.pageCount}`;
        this.pageInput.value = '1';

        let title = '';
        try {
            const meta = await this.pdfDoc.getMetadata();
            title = meta.info?.Title || '';
            if (title && this._pdfFilename === 'document.pdf')
                this._pdfFilename = title.replace(/[<>:"/\\|?*]/g, '_') + '.pdf';
        } catch {}

        this.sendMessage('documentLoaded', { pageCount: this.pageCount, title });
        await this.renderAllPages();
        await this.generateThumbnails();
        await this.loadBookmarks();
    }

    // ── Render ────────────────────────────────────────────────────────────

    async renderAllPages() {
        this.viewer.innerHTML = '';
        for (let n = 1; n <= this.pageCount; n++) {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'page-container';
            pageDiv.id = `page-${n}`;
            pageDiv.setAttribute('data-page', n);

            const canvas = document.createElement('canvas');
            canvas.className = 'page-canvas';
            const textLayer = document.createElement('div');
            textLayer.className = 'text-layer';
            const annotLayer = document.createElement('div');
            annotLayer.className = 'annotation-layer';
            const drawCanvas = document.createElement('canvas');
            drawCanvas.className = 'drawing-canvas';
            drawCanvas.style.pointerEvents = 'none';

            pageDiv.appendChild(canvas);
            pageDiv.appendChild(textLayer);
            pageDiv.appendChild(annotLayer);
            pageDiv.appendChild(drawCanvas);
            this.viewer.appendChild(pageDiv);

            await this.renderPage(n, canvas, textLayer);
            drawCanvas.width = canvas.width;
            drawCanvas.height = canvas.height;

            drawCanvas.addEventListener('mousedown', (e) => this.startDrawing(e, drawCanvas));
            drawCanvas.addEventListener('mousemove', (e) => this.continueDrawing(e, drawCanvas));
            drawCanvas.addEventListener('mouseup',   () => this.stopDrawing(drawCanvas));
            drawCanvas.addEventListener('mouseleave',() => this.stopDrawing(drawCanvas));
        }
    }

    async renderPage(pageNum, canvas, textLayer) {
        const page = await this.pdfDoc.getPage(pageNum);
        const vp = page.getViewport({ scale: this.scale, rotation: this.rotation });
        canvas.width = vp.width;
        canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

        const tc = await page.getTextContent();
        textLayer.innerHTML = '';
        textLayer.style.width  = `${vp.width}px`;
        textLayer.style.height = `${vp.height}px`;
        tc.items.forEach(item => {
            const span = document.createElement('span');
            span.textContent = item.str;
            const tx = pdfjsLib.Util.transform(vp.transform, item.transform);
            span.style.left       = `${tx[4]}px`;
            span.style.top        = `${tx[5] - item.height}px`;
            span.style.fontSize   = `${item.height}px`;
            span.style.fontFamily = item.fontName || 'sans-serif';
            textLayer.appendChild(span);
        });
    }

    async rerenderAllPages() {
        const pages = this.viewer.querySelectorAll('.page-container');
        for (const pageDiv of pages) {
            const n = parseInt(pageDiv.getAttribute('data-page'));
            const canvas     = pageDiv.querySelector('.page-canvas');
            const textLayer  = pageDiv.querySelector('.text-layer');
            const drawCanvas = pageDiv.querySelector('.drawing-canvas');
            await this.renderPage(n, canvas, textLayer);
            if (drawCanvas) {
                drawCanvas.width  = canvas.width;
                drawCanvas.height = canvas.height;
                // Re-draw history for this page
                this.redrawPageCanvas(n, drawCanvas);
            }
        }
        // Re-apply user highlights (positions stored as fractions of page size)
        this.reapplyHighlights();
        // Re-run search (text layer was rebuilt)
        if (this.searchText) await this.search(this.searchText, false);
    }

    // ── Navigation ────────────────────────────────────────────────────────

    goToPage(n) {
        if (!this.pdfDoc) return;
        n = Math.max(1, Math.min(n, this.pageCount));
        this.currentPage = n;
        this.pageInput.value = n;
        const el = document.getElementById(`page-${n}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        this.sendMessage('pageChanged', { pageNumber: n });
        this.updateThumbnailSelection();
    }
    nextPage()     { if (this.currentPage < this.pageCount) this.goToPage(this.currentPage + 1); }
    previousPage() { if (this.currentPage > 1)              this.goToPage(this.currentPage - 1); }
    firstPage()    { this.goToPage(1); }
    lastPage()     { this.goToPage(this.pageCount); }

    handleScroll() {
        if (!this.pdfDoc) return;
        const cr = this.viewerContainer.getBoundingClientRect();
        const cc = cr.top + cr.height / 2;
        let closest = 1, minDist = Infinity;
        this.viewer.querySelectorAll('.page-container').forEach(p => {
            const r = p.getBoundingClientRect();
            const d = Math.abs(r.top + r.height / 2 - cc);
            if (d < minDist) { minDist = d; closest = parseInt(p.getAttribute('data-page')); }
        });
        if (closest !== this.currentPage) {
            this.currentPage = closest;
            this.pageInput.value = closest;
            this.sendMessage('pageChanged', { pageNumber: closest });
            this.updateThumbnailSelection();
        }
    }

    // ── Zoom ──────────────────────────────────────────────────────────────

    zoomIn()  { this.setZoom(this.scale + 0.25); }
    zoomOut() { this.setZoom(this.scale - 0.25); }

    async setZoom(scale) {
        this.scale = Math.max(0.25, Math.min(4, scale));
        this.zoomSelect.value = this.scale.toString();
        await this.rerenderAllPages();
        this.sendMessage('zoomChanged', { zoomLevel: this.scale });
    }
    async fitWidth() {
        if (!this.pdfDoc) return;
        const vp = (await this.pdfDoc.getPage(1)).getViewport({ scale: 1, rotation: this.rotation });
        await this.setZoom((this.viewerContainer.clientWidth - 40) / vp.width);
    }
    async fitPage() {
        if (!this.pdfDoc) return;
        const vp = (await this.pdfDoc.getPage(1)).getViewport({ scale: 1, rotation: this.rotation });
        await this.setZoom(Math.min((this.viewerContainer.clientWidth - 40) / vp.width,
                                   (this.viewerContainer.clientHeight - 40) / vp.height));
    }

    // ── Rotation ──────────────────────────────────────────────────────────

    async rotateClockwise()        { this.rotation = (this.rotation + 90) % 360; await this.rerenderAllPages(); await this.generateThumbnails(); }
    async rotateCounterClockwise() { this.rotation = (this.rotation - 90 + 360) % 360; await this.rerenderAllPages(); await this.generateThumbnails(); }

    // ── Search (overlay-based — highlights only the matched characters) ────

    async search(text, caseSensitive) {
        if (!this.pdfDoc || !text) return;

        this.clearSearch();   // remove previous overlays
        this.searchText = text;

        const flags   = caseSensitive ? 'g' : 'gi';
        const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        for (let pageNum = 1; pageNum <= this.pageCount; pageNum++) {
            const textLayer = document.querySelector(`#page-${pageNum} .text-layer`);
            const pageEl    = document.getElementById(`page-${pageNum}`);
            if (!textLayer || !pageEl) continue;
            const pageRect = pageEl.getBoundingClientRect();

            for (const span of textLayer.querySelectorAll('span')) {
                const regex = new RegExp(escaped, flags);
                let match;
                const tn = span.firstChild;
                if (!tn || tn.nodeType !== Node.TEXT_NODE) continue;

                while ((match = regex.exec(span.textContent)) !== null) {
                    try {
                        const range = document.createRange();
                        range.setStart(tn, match.index);
                        range.setEnd(tn, match.index + match[0].length);

                        const matchOverlays = [];
                        for (const rect of range.getClientRects()) {
                            if (rect.width === 0) continue;
                            const ov = this._makeOverlay('search-overlay',
                                rect.left - pageRect.left, rect.top - pageRect.top,
                                rect.width, rect.height);
                            pageEl.appendChild(ov);
                            matchOverlays.push(ov);
                            this.searchOverlays.push(ov);
                        }
                        if (matchOverlays.length > 0)
                            this.searchMatches.push({ page: pageNum, overlays: matchOverlays });
                    } catch {}
                }
            }
        }

        this.updateSearchResults();
        if (this.searchMatches.length > 0) this.highlightCurrentMatch();

        this.sendMessage('searchCompleted', {
            matchCount: this.searchMatches.length,
            currentMatch: this.searchMatches.length > 0 ? 1 : 0
        });
    }

    _makeOverlay(cls, left, top, width, height) {
        const div = document.createElement('div');
        div.className = cls;
        div.style.left   = `${left}px`;
        div.style.top    = `${top}px`;
        div.style.width  = `${width}px`;
        div.style.height = `${height}px`;
        return div;
    }

    findNext() {
        if (!this.searchMatches.length) return;
        this.currentSearchIndex = (this.currentSearchIndex + 1) % this.searchMatches.length;
        this.highlightCurrentMatch();
        this.updateSearchResults();
    }
    findPrevious() {
        if (!this.searchMatches.length) return;
        this.currentSearchIndex = (this.currentSearchIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
        this.highlightCurrentMatch();
        this.updateSearchResults();
    }

    highlightCurrentMatch() {
        this.searchOverlays.forEach(o => o.classList.remove('search-overlay-current'));
        const m = this.searchMatches[this.currentSearchIndex];
        if (!m) return;
        m.overlays.forEach(o => o.classList.add('search-overlay-current'));
        this.goToPage(m.page);
        setTimeout(() => m.overlays[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }

    updateSearchResults() {
        this.searchResults.textContent = this.searchMatches.length === 0
            ? 'No matches'
            : `${this.currentSearchIndex + 1} of ${this.searchMatches.length}`;
    }

    clearSearch() {
        this.searchText = '';
        this.searchMatches = [];
        this.currentSearchIndex = 0;
        if (this.searchInput) this.searchInput.value = '';
        if (this.searchResults) this.searchResults.textContent = '';
        this.searchOverlays.forEach(o => o.remove());
        this.searchOverlays = [];
    }

    // ── Sidebar / Thumbnails / Bookmarks ─────────────────────────────────

    toggleSidebar() {
        this.sidebarVisible = !this.sidebarVisible;
        this.sidebar.classList.toggle('hidden', !this.sidebarVisible);
        this.btnSidebar.classList.toggle('active', this.sidebarVisible);
    }
    setSidebarVisible(v) {
        this.sidebarVisible = v;
        this.sidebar.classList.toggle('hidden', !v);
        this.btnSidebar.classList.toggle('active', v);
    }
    showThumbnails() {
        this.tabThumbnails.classList.add('active');    this.tabBookmarks.classList.remove('active');
        this.thumbnailsContainer.classList.add('active'); this.bookmarksContainer.classList.remove('active');
    }
    showBookmarks() {
        this.tabThumbnails.classList.remove('active'); this.tabBookmarks.classList.add('active');
        this.thumbnailsContainer.classList.remove('active'); this.bookmarksContainer.classList.add('active');
    }

    async generateThumbnails() {
        if (!this.pdfDoc) return;
        this.thumbnailsContainer.innerHTML = '';
        for (let n = 1; n <= this.pageCount; n++) {
            const page = await this.pdfDoc.getPage(n);
            const vp = page.getViewport({ scale: 0.2, rotation: this.rotation });
            const div = document.createElement('div');
            div.className = 'thumbnail' + (n === this.currentPage ? ' selected' : '');
            div.setAttribute('data-page', n);
            const cv = document.createElement('canvas');
            cv.width = vp.width; cv.height = vp.height;
            await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
            const lbl = document.createElement('div');
            lbl.className = 'thumbnail-label'; lbl.textContent = n;
            div.appendChild(cv); div.appendChild(lbl);
            div.addEventListener('click', () => { this.goToPage(n); this.sendMessage('thumbnailClicked', { pageNumber: n }); });
            this.thumbnailsContainer.appendChild(div);
        }
    }

    updateThumbnailSelection() {
        document.querySelectorAll('.thumbnail').forEach(t => {
            t.classList.toggle('selected', parseInt(t.getAttribute('data-page')) === this.currentPage);
        });
        document.querySelector('.thumbnail.selected')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    async loadBookmarks() {
        if (!this.pdfDoc) return;
        this.bookmarksContainer.innerHTML = '';
        try {
            const outline = await this.pdfDoc.getOutline();
            if (outline?.length) this.renderBookmarks(outline, this.bookmarksContainer, 0);
            else this.bookmarksContainer.innerHTML = '<div class="no-bookmarks">No bookmarks</div>';
        } catch { this.bookmarksContainer.innerHTML = '<div class="no-bookmarks">Could not load bookmarks</div>'; }
    }

    renderBookmarks(items, container, level) {
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'bookmark-item';
            div.style.paddingLeft = `${level * 16 + 8}px`;
            const sp = document.createElement('span');
            sp.className = 'bookmark-title'; sp.textContent = item.title;
            div.appendChild(sp);
            div.addEventListener('click', async () => {
                if (!item.dest) return;
                let idx;
                if (typeof item.dest === 'string') {
                    const d = await this.pdfDoc.getDestination(item.dest);
                    idx = await this.pdfDoc.getPageIndex(d[0]);
                } else {
                    idx = await this.pdfDoc.getPageIndex(item.dest[0]);
                }
                this.goToPage(idx + 1);
                this.sendMessage('bookmarkClicked', { title: item.title, pageNumber: idx + 1 });
            });
            container.appendChild(div);
            if (item.items?.length) this.renderBookmarks(item.items, container, level + 1);
        });
    }

    // ── Annotation: Highlight ─────────────────────────────────────────────
    // Select text, then click Highlight. Overlays cover only the exact chars.
    // Right-click any highlight to remove the whole group.

    highlightSelection(color) {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);

        const node = range.commonAncestorContainer;
        const pageEl = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)
                       ?.closest('.page-container');
        if (!pageEl) return;

        const pageRect = pageEl.getBoundingClientRect();
        const id       = 'hl-' + Date.now();
        const hlColor  = color || '#FFFF00';
        const rects    = [];

        for (const rect of range.getClientRects()) {
            if (rect.width === 0) continue;
            const left   = rect.left - pageRect.left;
            const top    = rect.top  - pageRect.top;
            const width  = rect.width;
            const height = rect.height;
            rects.push({
                lf: left / pageEl.offsetWidth,
                tp: top  / pageEl.offsetHeight,
                wd: width  / pageEl.offsetWidth,
                ht: height / pageEl.offsetHeight
            });
            const ov = document.createElement('div');
            ov.className = 'highlight-overlay';
            ov.dataset.annotationId = id;
            ov.style.left            = `${left}px`;
            ov.style.top             = `${top}px`;
            ov.style.width           = `${width}px`;
            ov.style.height          = `${height}px`;
            ov.style.backgroundColor = hexToRgba(hlColor, 0.4);
            ov.title = 'Right-click to remove';
            ov.addEventListener('contextmenu', (e) => {
                e.preventDefault(); e.stopPropagation();
                document.querySelectorAll(`[data-annotation-id="${id}"]`).forEach(el => el.remove());
                this.annotations = this.annotations.filter(a => a.id !== id);
            });
            pageEl.appendChild(ov);
        }

        sel.removeAllRanges();
        const pageNum = parseInt(pageEl.getAttribute('data-page'));
        this.annotations.push({ id, type: 'highlight', color: hlColor, page: pageNum, rects });
        this.sendMessage('annotationAdded', { annotationType: 'highlight', pageNumber: pageNum });
    }

    // Re-apply highlight overlays after zoom/rotation change
    reapplyHighlights() {
        document.querySelectorAll('.highlight-overlay').forEach(el => el.remove());
        this.annotations.filter(a => a.type === 'highlight').forEach(ann => {
            const pageEl = document.getElementById(`page-${ann.page}`);
            if (!pageEl) return;
            const pw = pageEl.offsetWidth, ph = pageEl.offsetHeight;
            ann.rects.forEach(r => {
                const ov = document.createElement('div');
                ov.className = 'highlight-overlay';
                ov.dataset.annotationId = ann.id;
                ov.style.left            = `${r.lf * pw}px`;
                ov.style.top             = `${r.tp * ph}px`;
                ov.style.width           = `${r.wd * pw}px`;
                ov.style.height          = `${r.ht * ph}px`;
                ov.style.backgroundColor = hexToRgba(ann.color, 0.4);
                ov.title = 'Right-click to remove';
                ov.addEventListener('contextmenu', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    document.querySelectorAll(`[data-annotation-id="${ann.id}"]`).forEach(el2 => el2.remove());
                    this.annotations = this.annotations.filter(a => a.id !== ann.id);
                });
                pageEl.appendChild(ov);
            });
        });
    }

    // ── Annotation: Notes ─────────────────────────────────────────────────
    // Click Note button → crosshair mode. Click on page to place note.
    // Click note icon to show/hide text. Right-click to delete. Drag to move.

    toggleNoteMode() {
        this.noteModeActive = !this.noteModeActive;
        this.btnNote.classList.toggle('active', this.noteModeActive);
        this.viewer.style.cursor = this.noteModeActive ? 'crosshair' : '';
    }

    handleViewerClick(e) {
        if (!this.noteModeActive) return;
        const pageEl = e.target.closest('.page-container');
        if (!pageEl) return;
        const pageNum = parseInt(pageEl.getAttribute('data-page'));
        const r = pageEl.getBoundingClientRect();
        this.showNoteInput(pageNum, e.clientX - r.left, e.clientY - r.top);
        e.stopPropagation();
    }

    showNoteInput(pageNum, x, y) {
        document.getElementById('note-popup')?.remove();
        const popup = document.createElement('div');
        popup.id = 'note-popup';
        popup.className = 'note-popup';
        popup.style.left = `${x}px`;
        popup.style.top  = `${y}px`;

        const ta = document.createElement('textarea');
        ta.placeholder = 'Type your note...';
        ta.rows = 3;

        const btns = document.createElement('div');
        btns.className = 'note-popup-buttons';

        const ok = document.createElement('button');
        ok.textContent = 'Add';
        ok.onclick = () => { const t = ta.value.trim(); if (t) this.placeNote(pageNum, x, y, t); popup.remove(); };

        const cancel = document.createElement('button');
        cancel.textContent = 'Cancel';
        cancel.onclick = () => popup.remove();

        btns.appendChild(ok); btns.appendChild(cancel);
        popup.appendChild(ta); popup.appendChild(btns);
        document.getElementById(`page-${pageNum}`).appendChild(popup);
        ta.focus();
    }

    placeNote(pageNum, x, y, text) {
        const pageEl = document.getElementById(`page-${pageNum}`);
        if (!pageEl) return;

        const noteEl = document.createElement('div');
        noteEl.className = 'note-annotation';
        noteEl.style.left = `${x}px`;
        noteEl.style.top  = `${y - 12}px`;
        noteEl.innerHTML  = `<svg viewBox="0 0 24 24" width="24" height="24"><path fill="#FFD700" stroke="#CC9900" stroke-width="1" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;

        const tooltip = document.createElement('div');
        tooltip.className = 'note-tooltip';
        tooltip.textContent = text;
        noteEl.appendChild(tooltip);

        // Click → toggle tooltip
        let wasDragged = false;
        noteEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (wasDragged) { wasDragged = false; return; }
            tooltip.classList.toggle('visible');
        });

        // Right-click → delete
        noteEl.addEventListener('contextmenu', (e) => {
            e.preventDefault(); e.stopPropagation();
            noteEl.remove();
            this.annotations = this.annotations.filter(a => !(a.type === 'note' && a._el === noteEl));
        });

        // Drag to reposition
        noteEl.style.cursor = 'grab';
        let dragActive = false, origLeft = 0, origTop = 0, startMX = 0, startMY = 0;
        noteEl.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            dragActive = true; wasDragged = false;
            origLeft = parseFloat(noteEl.style.left); origTop = parseFloat(noteEl.style.top);
            startMX = e.clientX; startMY = e.clientY;
            noteEl.style.cursor = 'grabbing';
            e.stopPropagation(); e.preventDefault();
        });
        const onMove = (e) => {
            if (!dragActive) return;
            const dx = e.clientX - startMX, dy = e.clientY - startMY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDragged = true;
            noteEl.style.left = `${origLeft + dx}px`;
            noteEl.style.top  = `${origTop  + dy}px`;
        };
        const onUp = () => { dragActive = false; noteEl.style.cursor = 'grab'; };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);

        pageEl.appendChild(noteEl);
        const annot = { type: 'note', page: pageNum, x, y, text, _el: noteEl };
        this.annotations.push(annot);
        this.sendMessage('annotationAdded', { annotationType: 'note', pageNumber: pageNum, text });
    }

    addNote(pageNumber, x, y, text) { this.placeNote(pageNumber, x, y, text); }

    // ── Annotation: Drawing ───────────────────────────────────────────────
    // Toggle draw mode. Drawing toolbar appears with shape, color, width controls.
    // Right-click drawing canvas → context menu (Undo / Clear Page).
    // Drawings are behind or in front of text depending on z-order toggle.

    toggleDrawingMode() { this.drawingEnabled ? this.disableDrawing() : this.enableDrawing(this.strokeColor, this.strokeWidth); }

    enableDrawing(color, width) {
        this.drawingEnabled  = true;
        this.strokeColor     = color || '#FF0000';
        this.strokeWidth     = width || 2;
        this.btnDraw.classList.add('active');
        document.querySelectorAll('.drawing-canvas').forEach(c => { c.style.pointerEvents = 'all'; });
        this.viewer.style.cursor = 'crosshair';
        this._getOrCreateDrawingToolbar().classList.remove('hidden');
    }

    disableDrawing() {
        this.clearDrawingSelection();
        this.drawingEnabled = false;
        this.isDrawing = false;
        this.btnDraw.classList.remove('active');
        document.querySelectorAll('.drawing-canvas').forEach(c => { c.style.pointerEvents = 'none'; });
        this.viewer.style.cursor = '';
        this._drawingToolbar?.classList.add('hidden');
    }

    _getOrCreateDrawingToolbar() {
        if (this._drawingToolbar) return this._drawingToolbar;

        const bar = document.createElement('div');
        bar.id = 'drawing-toolbar';
        bar.className = 'drawing-toolbar hidden';

        // ── Mode buttons
        const modes = [['select','Select'],['freehand','Free'],['rect','Rect'],['circle','Ellipse']];
        const modeDiv = this._tbSection('Mode');
        modes.forEach(([mode, label]) => {
            const btn = document.createElement('button');
            btn.className = 'draw-tool-btn' + (mode === this.drawMode ? ' active' : '');
            btn.textContent = label;
            btn.addEventListener('click', () => {
                this.drawMode = mode;
                modeDiv.querySelectorAll('.draw-tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Update canvas cursor for select mode
                document.querySelectorAll('.drawing-canvas').forEach(c => {
                    c.style.cursor = (mode === 'select') ? 'default' : 'crosshair';
                });
            });
            modeDiv.appendChild(btn);
        });
        bar.appendChild(modeDiv);

        // ── Stroke colors
        const strokeColors = ['#000000','#FF0000','#0000FF','#008000','#FF8C00','#800080'];
        const scDiv = this._tbSection('Color');
        strokeColors.forEach(c => {
            const btn = this._colorSwatch(c, false);
            if (c === this.strokeColor) btn.classList.add('active');
            btn.addEventListener('click', () => {
                this.strokeColor = c;
                scDiv.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
            scDiv.appendChild(btn);
        });
        bar.appendChild(scDiv);

        // ── Fill colors (for shapes)
        const fillColors = ['','#FFFF00','#FF6666','#6699FF','#66CC66','#FFFFFF'];
        const fcDiv = this._tbSection('Fill');
        fillColors.forEach(c => {
            const btn = this._colorSwatch(c, true);
            if (c === this.fillColor) btn.classList.add('active');
            btn.addEventListener('click', () => {
                this.fillColor = c;
                fcDiv.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
            fcDiv.appendChild(btn);
        });
        bar.appendChild(fcDiv);

        // ── Width
        const widths = [[2,'Thin'],[4,'Med'],[8,'Thick']];
        const wDiv = this._tbSection('Width');
        widths.forEach(([w, label]) => {
            const btn = document.createElement('button');
            btn.className = 'draw-tool-btn' + (w === this.strokeWidth ? ' active' : '');
            btn.textContent = label;
            btn.addEventListener('click', () => {
                this.strokeWidth = w;
                wDiv.querySelectorAll('.draw-tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
            wDiv.appendChild(btn);
        });
        bar.appendChild(wDiv);

        // ── Actions
        const aDiv = this._tbSection('');
        const mkBtn = (label, fn) => {
            const b = document.createElement('button');
            b.className = 'draw-action-btn'; b.textContent = label;
            b.addEventListener('click', fn); aDiv.appendChild(b);
        };
        mkBtn('Undo',  () => this.undoDrawing());
        mkBtn('Clear', () => this.clearPageDrawing());
        bar.appendChild(aDiv);

        document.getElementById('toolbar').after(bar);
        this._drawingToolbar = bar;
        return bar;
    }

    _tbSection(label) {
        const div = document.createElement('div');
        div.className = 'draw-section';
        if (label) {
            const sp = document.createElement('span');
            sp.className = 'draw-section-label';
            sp.textContent = label + ':';
            div.appendChild(sp);
        }
        return div;
    }

    _colorSwatch(color, isFill) {
        const btn = document.createElement('button');
        btn.className = 'color-swatch';
        if (color) {
            btn.style.backgroundColor = color;
            btn.title = color;
        } else {
            btn.classList.add('no-fill');
            btn.textContent = isFill ? 'None' : '';
            btn.title = 'No fill';
        }
        return btn;
    }

    // ── Drawing canvas per-page logic ─────────────────────────────────────

    _getCanvasPos(e, canvas) {
        const r = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - r.left) * (canvas.width  / r.width),
            y: (e.clientY - r.top)  * (canvas.height / r.height)
        };
    }

    startDrawing(e, canvas) {
        if (!this.drawingEnabled) return;
        const { x, y } = this._getCanvasPos(e, canvas);
        const pageNum = parseInt(canvas.closest('.page-container').getAttribute('data-page'));

        if (this.drawMode === 'select') {
            const history = this.drawingHistory[pageNum] || [];
            let foundIdx = -1;
            for (let i = history.length - 1; i >= 0; i--) {
                if (this._hitTestStroke(history[i], x, y)) { foundIdx = i; break; }
            }
            // If selection was on a different page, clear it there first
            if (this.selectedPageNum !== null && this.selectedPageNum !== pageNum) {
                const prevPage = this.selectedPageNum;
                this.selectedPageNum = null;
                this.selectedStrokeIdx = -1;
                this.redrawPageCanvas(prevPage, null);
            }
            if (foundIdx >= 0) {
                this.selectedPageNum = pageNum;
                this.selectedStrokeIdx = foundIdx;
                this.isDraggingStroke = true;
                this.dragLastX = x;
                this.dragLastY = y;
            } else {
                this.selectedPageNum = null;
                this.selectedStrokeIdx = -1;
                this.isDraggingStroke = false;
            }
            this.redrawPageCanvas(pageNum, canvas);
            return;
        }

        this.isDrawing = true;
        this.drawStartX = x; this.drawStartY = y;
        this.lastX = x; this.lastY = y;
        this._drawingPageNum = pageNum;

        if (this.drawMode === 'freehand') {
            this.currentStroke = { type: 'freehand', strokeColor: this.strokeColor, width: this.strokeWidth, points: [{ x, y }] };
        } else {
            this.currentStroke = { type: this.drawMode, strokeColor: this.strokeColor, fillColor: this.fillColor, width: this.strokeWidth, x1: x, y1: y, x2: x, y2: y };
        }
    }

    continueDrawing(e, canvas) {
        if (!this.drawingEnabled) return;

        // Select/drag mode
        if (this.drawMode === 'select') {
            if (!this.isDraggingStroke || this.selectedStrokeIdx < 0) return;
            const { x, y } = this._getCanvasPos(e, canvas);
            const dx = x - this.dragLastX, dy = y - this.dragLastY;
            this.dragLastX = x; this.dragLastY = y;
            const history = this.drawingHistory[this.selectedPageNum];
            if (history && history[this.selectedStrokeIdx]) {
                this._moveStroke(history[this.selectedStrokeIdx], dx, dy);
                this.redrawPageCanvas(this.selectedPageNum, canvas);
            }
            return;
        }

        if (!this.isDrawing || !this.currentStroke) return;
        const { x, y } = this._getCanvasPos(e, canvas);

        if (this.drawMode === 'freehand') {
            const ctx = canvas.getContext('2d');
            ctx.beginPath();
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth   = this.strokeWidth;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.moveTo(this.lastX, this.lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
            this.currentStroke.points.push({ x, y });
            this.lastX = x; this.lastY = y;
        } else {
            this.currentStroke.x2 = x;
            this.currentStroke.y2 = y;
            if (!this._rafPending) {
                this._rafPending = true;
                requestAnimationFrame(() => {
                    this._rafPending = false;
                    if (!this.isDrawing || !this.currentStroke) return;
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    (this.drawingHistory[this._drawingPageNum] || []).forEach(s => this._renderStroke(ctx, s));
                    this._renderStroke(ctx, this.currentStroke);
                });
            }
        }
    }

    stopDrawing(canvas) {
        if (this.drawMode === 'select') {
            this.isDraggingStroke = false;
            return;
        }
        if (!this.isDrawing || !this.currentStroke) { this.isDrawing = false; return; }
        this.isDrawing = false;
        const pageNum = this._drawingPageNum;
        if (!this.drawingHistory[pageNum]) this.drawingHistory[pageNum] = [];
        this.drawingHistory[pageNum].push({ ...this.currentStroke });
        this.currentStroke = null;
        // Re-render cleanly (ensures shape is final)
        this.redrawPageCanvas(pageNum, canvas);
        this.annotations.push({ type: 'drawing', page: pageNum });
        this.sendMessage('annotationAdded', { annotationType: 'drawing', pageNumber: pageNum });
    }

    _renderStroke(ctx, stroke) {
        ctx.save();
        ctx.strokeStyle = stroke.strokeColor || stroke.color || '#000';
        ctx.lineWidth   = stroke.width || 2;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';

        if (stroke.type === 'freehand') {
            if (!stroke.points?.length) { ctx.restore(); return; }
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            stroke.points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.stroke();
        } else if (stroke.type === 'rect') {
            const x = Math.min(stroke.x1, stroke.x2), y = Math.min(stroke.y1, stroke.y2);
            const w = Math.abs(stroke.x2 - stroke.x1), h = Math.abs(stroke.y2 - stroke.y1);
            if (stroke.fillColor) { ctx.fillStyle = hexToRgba(stroke.fillColor, 0.45); ctx.fillRect(x, y, w, h); }
            ctx.strokeRect(x, y, w, h);
        } else if (stroke.type === 'circle') {
            const cx = (stroke.x1 + stroke.x2) / 2, cy = (stroke.y1 + stroke.y2) / 2;
            const rx = Math.abs(stroke.x2 - stroke.x1) / 2, ry = Math.abs(stroke.y2 - stroke.y1) / 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            if (stroke.fillColor) { ctx.fillStyle = hexToRgba(stroke.fillColor, 0.45); ctx.fill(); }
            ctx.stroke();
        }
        ctx.restore();
    }

    redrawPageCanvas(pageNum, canvas) {
        const c = canvas || document.querySelector(`#page-${pageNum} .drawing-canvas`);
        if (!c) return;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        (this.drawingHistory[pageNum] || []).forEach((s, idx) => {
            this._renderStroke(ctx, s);
            if (pageNum === this.selectedPageNum && idx === this.selectedStrokeIdx) {
                this._drawSelectionBox(ctx, s);
            }
        });
    }

    _hitTestStroke(stroke, x, y) {
        const pad = Math.max(8, (stroke.width || 2) / 2 + 4);
        if (stroke.type === 'freehand') {
            for (const p of stroke.points || []) {
                if (Math.abs(p.x - x) <= pad && Math.abs(p.y - y) <= pad) return true;
            }
            return false;
        }
        // rect / circle — test bounding box
        const minX = Math.min(stroke.x1, stroke.x2) - pad;
        const maxX = Math.max(stroke.x1, stroke.x2) + pad;
        const minY = Math.min(stroke.y1, stroke.y2) - pad;
        const maxY = Math.max(stroke.y1, stroke.y2) + pad;
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }

    _moveStroke(stroke, dx, dy) {
        if (stroke.type === 'freehand') {
            stroke.points.forEach(p => { p.x += dx; p.y += dy; });
        } else {
            stroke.x1 += dx; stroke.y1 += dy;
            stroke.x2 += dx; stroke.y2 += dy;
        }
    }

    _drawSelectionBox(ctx, stroke) {
        let minX, minY, maxX, maxY;
        if (stroke.type === 'freehand') {
            minX = Math.min(...stroke.points.map(p => p.x));
            minY = Math.min(...stroke.points.map(p => p.y));
            maxX = Math.max(...stroke.points.map(p => p.x));
            maxY = Math.max(...stroke.points.map(p => p.y));
        } else {
            minX = Math.min(stroke.x1, stroke.x2);
            minY = Math.min(stroke.y1, stroke.y2);
            maxX = Math.max(stroke.x1, stroke.x2);
            maxY = Math.max(stroke.y1, stroke.y2);
        }
        const pad = 6;
        ctx.save();
        ctx.strokeStyle = '#0078d4';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
        ctx.restore();
    }

    undoDrawing() {
        const history = this.drawingHistory[this.currentPage];
        if (!history?.length) return;
        history.pop();
        this.redrawPageCanvas(this.currentPage, null);
    }

    clearPageDrawing() {
        this.drawingHistory[this.currentPage] = [];
        this.redrawPageCanvas(this.currentPage, null);
    }

    clearDrawingSelection() {
        if (this.selectedPageNum === null) return;
        const pageNum = this.selectedPageNum;
        this.selectedPageNum = null;
        this.selectedStrokeIdx = -1;
        this.isDraggingStroke = false;
        this.redrawPageCanvas(pageNum, null);
    }

    // ── clearAnnotations (all types) ──────────────────────────────────────

    clearAnnotations() {
        this.annotations = [];
        document.querySelectorAll('.highlight-overlay').forEach(el => el.remove());
        document.querySelectorAll('.note-annotation').forEach(el => el.remove());
        this.drawingHistory = {};
        document.querySelectorAll('.drawing-canvas').forEach(c => c.getContext('2d').clearRect(0, 0, c.width, c.height));
    }

    setAnnotationsEnabled(v) { this.annotationsEnabled = v; }

    setPermissions({ allowHighlight = true, allowNotes = true, allowDrawing = true, allowSaveAs = true } = {}) {
        this._perms = { allowHighlight, allowNotes, allowDrawing, allowSaveAs };

        this.btnHighlight.style.display = allowHighlight ? '' : 'none';
        this.btnNote.style.display      = allowNotes     ? '' : 'none';
        this.btnDraw.style.display      = allowDrawing   ? '' : 'none';
        this.btnDownload.style.display  = allowSaveAs    ? '' : 'none';

        // Hide entire annotation toolbar-section if all three annotation buttons are gone
        const annotSection = this.btnHighlight.closest('.toolbar-section');
        annotSection.style.display = (allowHighlight || allowNotes || allowDrawing) ? '' : 'none';

        // Deactivate features that are now disallowed
        if (!allowDrawing && this.drawingEnabled) this.disableDrawing();
        if (!allowNotes && this.noteModeActive) {
            this.noteModeActive = false;
            this.viewer.style.cursor = '';
            this.btnNote.classList.remove('active');
        }
    }

    exportAnnotations() {
        // Exclude _el (DOM reference) before serializing
        const annotations = this.annotations.map(a => {
            const { _el, ...rest } = a;
            return rest;
        });
        const json = JSON.stringify({ annotations, drawingHistory: this.drawingHistory });
        // Send result back to C# via postMessage — fires AnnotationsExported COM event
        this.sendMessage('annotationsExported', { data: json });
        return json;
    }

    importAnnotations(json) {
        try {
            const parsed = JSON.parse(json);
            // Support both old flat array format and new combined { annotations, drawingHistory }
            const annotations  = Array.isArray(parsed) ? parsed : (parsed.annotations  ?? []);
            const drawingHistory = Array.isArray(parsed) ? {}    : (parsed.drawingHistory ?? {});

            // Restore highlights — push into annotations array, reapplyHighlights handles DOM
            const highlights = annotations.filter(a => a.type === 'highlight');
            highlights.forEach(a => this.annotations.push({ ...a }));
            if (highlights.length) this.reapplyHighlights();

            // Restore notes
            annotations.filter(a => a.type === 'note').forEach(a => {
                this.placeNote(a.page, a.x, a.y, a.text);
            });

            // Restore drawings — merge into drawingHistory and redraw each affected page
            Object.entries(drawingHistory).forEach(([pageNum, strokes]) => {
                const pn = parseInt(pageNum);
                this.drawingHistory[pn] = [...(this.drawingHistory[pn] || []), ...strokes];
                this.redrawPageCanvas(pn, null);
            });
        } catch (e) { console.error('importAnnotations:', e); }
    }

    // ── Print / Download ──────────────────────────────────────────────────

    print() {
        window.print();
        this.sendMessage('printCompleted', { success: true });
    }

    download() {
        // Clear any selection highlight before printing so the dashed box is not baked in
        this.clearDrawingSelection();
        // Send to C# — WebView2 cannot reliably download blob URLs as files
        this.sendMessage('downloadRequested', {});
    }

    // ── Close ─────────────────────────────────────────────────────────────

    closeDocument() {
        this.pdfDoc = null; this.pageCount = 0; this.currentPage = 1;
        this._pdfUrl = null; this._pdfBytes = null; this._pdfFilename = 'document.pdf';
        this.viewer.innerHTML = '';
        this.thumbnailsContainer.innerHTML = '';
        this.bookmarksContainer.innerHTML = '';
        this.pageCountEl.textContent = '/ 0';
        this.pageInput.value = '1';
        this.welcomeMessage.classList.remove('hidden');
        this.clearSearch();
        this.clearAnnotations();
    }
}

// ─── Instantiate ─────────────────────────────────────────────────────────────

try {
    window.pdfViewer = new PDFViewer();
} catch (e) {
    sendInitError('PDFViewer constructor failed: ' + (e.message || e));
    throw e;
}

// Bind for C# ExecuteScript calls
[
    'loadUrl','loadBase64','goToPage','nextPage','previousPage','firstPage','lastPage',
    'zoomIn','zoomOut','setZoom','fitWidth','fitPage',
    'rotateClockwise','rotateCounterClockwise',
    'search','findNext','findPrevious','clearSearch',
    'highlightSelection','addNote','enableDrawing','disableDrawing',
    'clearAnnotations','clearDrawingSelection','exportAnnotations','importAnnotations',
    'print','download',
    'toggleSidebar','setSidebarVisible','showThumbnails','showBookmarks',
    'closeDocument','setAnnotationsEnabled','setPermissions'
].forEach(m => { window.pdfViewer[m] = window.pdfViewer[m].bind(window.pdfViewer); });
