import { IOCParser } from './parser.js?v=1.2';
import { FileProcessor } from './fileReader.js?v=1.2';

export class CleanFilter {
    constructor() {
        this.companySet = new Set();

        this.UI = {
            iocFileInput: document.getElementById('cleanIocFileInput'),
            iocDropZone: document.getElementById('cleanIocDropZone'),
            iocFileName: document.getElementById('cleanIocFileName'),
            iocInput: document.getElementById('cleanIocInput'),

            companyFileInput: document.getElementById('cleanCompanyFileInput'),
            companyDropZone: document.getElementById('cleanCompanyDropZone'),
            companyFileName: document.getElementById('cleanCompanyFileName'),
            companyStatus: document.getElementById('cleanCompanyStatus'),
            removeCompanyBtn: document.getElementById('cleanRemoveCompanyBtn'),

            startBtn: document.getElementById('startCleanBtn'),
            clearBtn: document.getElementById('clearCleanBtn'),
            copyCleanBtn: document.getElementById('copyCleanBtn'),
            copyRemovedBtn: document.getElementById('copyRemovedBtn'),

            statTotal: document.getElementById('statCleanTotal'),
            statMatched: document.getElementById('statCleanMatched'),
            statFinal: document.getElementById('statCleanFinal'),
            statStatus: document.getElementById('statCleanStatus'),

            outputClean: document.getElementById('cleanOutputData'),
            outputRemoved: document.getElementById('removedOutputData'),

            // Export Buttons - Clean
            cleanExportBtnClean: document.querySelector('.cleanExportBtn_clean'),
            cleanExportMenuClean: document.querySelector('.cleanExportMenu_clean'),
            exportTxtClean: document.querySelector('.exportTxt_clean'),
            exportCsvClean: document.querySelector('.exportCsv_clean'),

            // Export Buttons - Removed
            cleanExportBtnRemoved: document.querySelector('.cleanExportBtn_removed'),
            cleanExportMenuRemoved: document.querySelector('.cleanExportMenu_removed'),
            exportTxtRemoved: document.querySelector('.exportTxt_removed'),
            exportCsvRemoved: document.querySelector('.exportCsv_removed'),
        };

        this.cleanResults = [];
        this.removedResults = [];
        this.isProcessing = false;

        this.bindEvents();
    }

    bindEvents() {
        // Dropzones
        this.setupDropZone('cleanIocDropZone', this.UI.iocFileInput);
        this.setupDropZone('cleanCompanyDropZone', this.UI.companyFileInput);

        // File Inputs
        this.UI.iocFileInput.addEventListener('change', (e) => this.handleIocUpload(e));
        
        // Company Baseline
        this.UI.companyFileInput.addEventListener('change', (e) => this.handleCompanyFileUpload(e));
        this.UI.removeCompanyBtn.addEventListener('click', () => this.clearCompanyBaseline());
        this.loadCompanyBaselineFromStorage();

        // Action Buttons
        this.UI.startBtn.addEventListener('click', () => this.startCleaning());
        this.UI.clearBtn.addEventListener('click', () => this.clearAll());
        this.UI.copyCleanBtn.addEventListener('click', () => this.copyToClipboard(this.UI.outputClean.value, this.UI.copyCleanBtn));
        this.UI.copyRemovedBtn.addEventListener('click', () => this.copyToClipboard(this.UI.outputRemoved.value, this.UI.copyRemovedBtn));

        // Export Dropdowns logic
        this.UI.cleanExportBtnClean.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = this.UI.cleanExportMenuClean.style.display === 'block';
            this.UI.cleanExportMenuClean.style.display  = isOpen ? 'none' : 'block';
            this.UI.cleanExportMenuRemoved.style.display = 'none';
        });

        this.UI.cleanExportBtnRemoved.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = this.UI.cleanExportMenuRemoved.style.display === 'block';
            this.UI.cleanExportMenuRemoved.style.display = isOpen ? 'none' : 'block';
            this.UI.cleanExportMenuClean.style.display   = 'none';
        });

        // Stop clicks inside menus from bubbling to document (which would close them)
        this.UI.cleanExportMenuClean.addEventListener('click',   e => e.stopPropagation());
        this.UI.cleanExportMenuRemoved.addEventListener('click', e => e.stopPropagation());

        document.addEventListener('click', () => {
            if (this.UI.cleanExportMenuClean)   this.UI.cleanExportMenuClean.style.display   = 'none';
            if (this.UI.cleanExportMenuRemoved) this.UI.cleanExportMenuRemoved.style.display = 'none';
        });

        // Export actions — close menu after firing
        this.UI.exportTxtClean.addEventListener('click',    (e) => { e.preventDefault(); this.exportTxt(this.cleanResults,   'clean');   this.UI.cleanExportMenuClean.style.display = 'none'; });
        this.UI.exportCsvClean.addEventListener('click',    (e) => { e.preventDefault(); this.exportCsv(this.cleanResults,   'clean');   this.UI.cleanExportMenuClean.style.display = 'none'; });
        this.UI.exportTxtRemoved.addEventListener('click',  (e) => { e.preventDefault(); this.exportTxt(this.removedResults, 'removed'); this.UI.cleanExportMenuRemoved.style.display = 'none'; });
        this.UI.exportCsvRemoved.addEventListener('click',  (e) => { e.preventDefault(); this.exportCsv(this.removedResults, 'removed'); this.UI.cleanExportMenuRemoved.style.display = 'none'; });
    }

    setupDropZone(zoneId, inputEl) {
        const zone = document.getElementById(zoneId);
        if (!zone || !inputEl) return;

        zone.addEventListener('click', () => inputEl.click());
        ['dragover', 'dragenter'].forEach(ev => zone.addEventListener(ev, e => {
            e.preventDefault();
            zone.classList.add('drag-over');
        }));
        ['dragleave', 'dragend'].forEach(ev => zone.addEventListener(ev, () => zone.classList.remove('drag-over')));
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            if (e.dataTransfer.files?.length) {
                inputEl.files = e.dataTransfer.files;
                inputEl.dispatchEvent(new Event('change'));
            }
        });
    }

    async handleIocUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        this.UI.iocFileName.textContent = `Reading ${file.name}...`;
        try {
            const text = await FileProcessor.readAsText(file);
            window._cleanIocRawText = text;
            this.UI.iocInput.value = text.length > 40000
                ? text.substring(0, 40000) + '\n\n[Preview truncated — full data loaded in memory]'
                : text;
            this.UI.iocFileName.textContent = `✓ ${file.name}`;
        } catch (err) {
            this.UI.iocFileName.textContent = '✗ Read error';
            console.error(err);
        }
    }

    async handleCompanyFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        this.UI.companyFileName.textContent = `Reading ${file.name}...`;
        this.UI.companyStatus.textContent = '';
        this.setCompanyStatusClass('loading');

        try {
            const text = await FileProcessor.readAsText(file);
            await this.buildCompanyBaseline(text, file.name);
        } catch (err) {
            this.UI.companyFileName.textContent = '✗ Error reading file';
            this.UI.companyStatus.textContent = err.message;
            console.error(err);
        }
    }

    async buildCompanyBaseline(text, label = '') {
        this.companySet.clear();
        if (!text.trim()) {
            this.syncCompanyUI('— No file', '', '', false);
            return;
        }

        const CHUNK = 300_000;
        let pos = 0;

        while (pos < text.length) {
            let end = pos + CHUNK;
            if (end < text.length) {
                const nl = text.indexOf('\n', end);
                if (nl !== -1 && nl - end < 5000) end = nl;
            } else {
                end = text.length;
            }

            const chunk = text.substring(pos, end);
            IOCParser.parse(chunk).forEach(ioc => this.companySet.add(ioc.value.toLowerCase()));
            pos = end;

            const pct = Math.round((pos / text.length) * 100);
            this.UI.companyStatus.textContent = `Processing... ${pct}%`;
            await new Promise(r => setTimeout(r, 0));
        }

        this.syncCompanyUI(label ? `✓ ${label}` : '✓ Loaded', `${this.companySet.size} unique indicators in baseline`, 'ready', true);

        try {
            localStorage.setItem('clean_ioc_baseline_data', JSON.stringify(Array.from(this.companySet)));
            localStorage.setItem('clean_ioc_baseline_name', label || 'Loaded');
        } catch(e) {
            console.warn('Baseline too large to save to localStorage.', e);
        }
    }

    clearCompanyBaseline() {
        this.companySet.clear();
        localStorage.removeItem('clean_ioc_baseline_data');
        localStorage.removeItem('clean_ioc_baseline_name');
        if (this.UI.companyFileInput) this.UI.companyFileInput.value = '';
        this.syncCompanyUI('— No file', '', '', false);
    }

    loadCompanyBaselineFromStorage() {
        try {
            const storedName = localStorage.getItem('clean_ioc_baseline_name');
            const storedData = localStorage.getItem('clean_ioc_baseline_data');
            if (storedData && storedName) {
                const arr = JSON.parse(storedData);
                if (Array.isArray(arr) && arr.length > 0) {
                    this.companySet.clear();
                    arr.forEach(i => this.companySet.add(i));
                    this.syncCompanyUI(`✓ ${storedName}`, `${this.companySet.size} unique indicators in baseline`, 'ready', true);
                }
            }
        } catch (e) {
            console.error('Failed to load clean baseline from storage', e);
            localStorage.removeItem('clean_ioc_baseline_data');
            localStorage.removeItem('clean_ioc_baseline_name');
        }
    }

    syncCompanyUI(nameText, statusText, state, showRemove) {
        this.UI.companyFileName.textContent = nameText;
        this.UI.companyStatus.textContent = statusText;
        this.UI.removeCompanyBtn.style.display = showRemove ? 'block' : 'none';
        
        this.setCompanyStatusClass(state);
    }

    setCompanyStatusClass(state) {
        this.UI.companyStatus.className = '';
        if (state === 'loading') this.UI.companyStatus.style.color = 'var(--verdict-suspicious)';
        if (state === 'ready')   this.UI.companyStatus.style.color = 'var(--verdict-clean)';
    }

    async startCleaning() {
        // Prevent double click
        if (this.isProcessing) return;
        
        const rawText = (window._cleanIocRawText || this.UI.iocInput.value).trim();
        if (!rawText) {
            alert('Please paste IOCs or upload a threat file first.');
            return;
        }

        this.isProcessing = true;
        this.setStatus('Processing...', 'status-running');
        this.UI.statTotal.textContent = '...';
        this.UI.statFinal.textContent = '...';

        // Allow UI to update
        await new Promise(r => setTimeout(r, 50));

        try {
            const CHUNK = 250_000; // process 250kb at a time to prevent UI freezing
            let pos = 0;
            const globalParsedSet = new Map(); // value -> type

            while (pos < rawText.length) {
                let end = pos + CHUNK;
                if (end < rawText.length) {
                    const nl = rawText.indexOf('\n', end);
                    if (nl !== -1 && nl - end < 5000) end = nl;
                } else {
                    end = rawText.length;
                }

                const chunk = rawText.substring(pos, end);
                const chunkParsed = IOCParser.parse(chunk);
                
                // Keep only unique elements across all chunks
                for (let ioc of chunkParsed) {
                    if (!globalParsedSet.has(ioc.value)) {
                        globalParsedSet.set(ioc.value, ioc.type);
                    }
                }

                pos = end;
                const pct = Math.round((pos / rawText.length) * 100);
                this.setStatus(`Reading & Parsing... ${pct}%`, 'status-running');
                
                // Yield to allow browser repaint
                await new Promise(r => setTimeout(r, 0));
            }

            this.setStatus('Filtering Data...', 'status-running');
            await new Promise(r => setTimeout(r, 0));

            // Convert map back to array format
            let parsed = Array.from(globalParsedSet.entries()).map(([v, t]) => ({ value: v, type: t }));
            
            // Clean specific filtering (removes google.com etc)
            parsed = IOCParser.filterBenign(parsed);

            this.UI.statTotal.textContent = parsed.length;

            const cleanArr = [];
            const removedArr = [];

            // 2. Cross Check against Company baseline
            for (let i = 0; i < parsed.length; i++) {
                const item = parsed[i];
                if (this.companySet.has(item.value.toLowerCase())) {
                    removedArr.push(item);
                } else {
                    cleanArr.push(item);
                }
                
                // Yield occasionally during heavy list processing
                if (i % 20000 === 0) {
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            this.cleanResults = cleanArr;
            this.removedResults = removedArr;

            this.updateStats();
            this.renderOutput();

            this.setStatus('Completed ✓', 'status-completed');
            
            // Enable export + copy buttons (only if there is data)
            this.UI.cleanExportBtnClean.disabled   = cleanArr.length === 0;
            this.UI.cleanExportBtnRemoved.disabled  = removedArr.length === 0;
            this.UI.copyCleanBtn.disabled           = cleanArr.length === 0;
            this.UI.copyRemovedBtn.disabled         = removedArr.length === 0;

        } catch (e) {
            console.error(e);
            this.setStatus('Error occurred', 'status-ratelimited');
        } finally {
            this.isProcessing = false;
        }
    }

    updateStats() {
        this.UI.statFinal.textContent = this.cleanResults.length;
        this.UI.statMatched.textContent = this.removedResults.length;
    }

    renderOutput() {
        this.UI.outputClean.value = this.cleanResults.map(i => i.value).join('\n');
        this.UI.outputRemoved.value = this.removedResults.map(i => i.value).join('\n');
    }

    async copyToClipboard(text, btn) {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            btn.style.color = 'var(--text-primary)';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.color = '';
            }, 1000);
        } catch (err) {
            console.error('Failed to copy!', err);
            alert('Clipboard copy failed. Please select and copy manually.');
        }
    }

    clearAll() {
        window._cleanIocRawText = null;
        this.UI.iocInput.value = '';
        if (this.UI.iocFileInput) this.UI.iocFileInput.value = '';
        this.UI.iocFileName.textContent = '';
        
        this.cleanResults = [];
        this.removedResults = [];
        
        this.UI.outputClean.value = '';
        this.UI.outputRemoved.value = '';
        
        this.UI.statTotal.textContent = '0';
        this.UI.statMatched.textContent = '0';
        this.UI.statFinal.textContent = '0';
        
        this.setStatus('Idle', 'status-idle');
        
        this.UI.cleanExportBtnClean.disabled = true;
        this.UI.cleanExportBtnRemoved.disabled = true;
        this.UI.copyCleanBtn.disabled = true;
        this.UI.copyRemovedBtn.disabled = true;
    }

    setStatus(text, cls) {
        this.UI.statStatus.textContent = text;
        this.UI.statStatus.className = cls;
    }

    // Export formaters
    exportTxt(items, type) {
        if (!items || items.length === 0) return;
        const text = items.map(i => i.value).join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ioc_filter_${type}_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    exportCsv(items, type) {
        if (!items || items.length === 0) return;
        let csvContent = 'Indicator,Type\n';
        items.forEach(i => {
            csvContent += `"${i.value}","${i.type}"\n`;
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ioc_filter_${type}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
