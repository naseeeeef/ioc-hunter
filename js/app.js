/**
 * app.js — IOC Hunter: Internal Exposure & Correlation Engine
 * Main orchestrator. Imports modular components.
 */
import { IOCParser }    from './parser.js?v=1.2';
import { VTClient }     from './vtClient.js?v=1.2';
import { UIRenderer }   from './uiRenderer.js?v=1.2';
import { FileProcessor } from './fileReader.js?v=1.2';
import { CleanFilter }   from './cleanFilter.js';

// ─── State ───────────────────────────────────────────────────────────────────
let API_KEY      = localStorage.getItem('vt_apikey') || '';
let PROXY_URL    = localStorage.getItem('vt_proxy')  || '';
let API_TIER     = localStorage.getItem('vt_tier')   || 'FREE';
let RATE_LIMIT_MS = 15000;

let currentQueue  = [];
let results       = [];
let companySet    = new Set();   // baseline IOC lookup
let isPaused      = true;
let isProcessing  = false;
let timerTimeout  = null;

// ─── Module instances ──────────────────────────────────────────────────────
let renderer = null; // instantiated inside DOMContentLoaded
let vtClient = null; // created fresh when API key is confirmed
let cleanFilter = null;

// ─── DOM refs — initialized inside DOMContentLoaded to avoid null ─────────
const $ = id => document.getElementById(id);
let UI = {};

// ─── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Build UI map after DOM is ready
    UI = {
        // Modal
        apiKeyModal:    $('apiKeyModal'),
        apiKeyInput:    $('apiKeyInput'),
        proxyInput:     $('proxyInput'),
        saveApiKeyBtn:  $('saveApiKeyBtn'),
        closeApiModal:  $('closeApiModal'),
        settingsBtn:    $('apiKeySettingsBtn'),
        apiTierSelect:  $('apiTierSelect'),
        tierNotice:     $('tierNotice'),
        rateLimitText:  $('rateLimitText'),

        // Inputs
        iocInput:           $('iocInput'),
        iocFileInput:       $('iocFileInput'),
        iocFileName:        $('iocFileName'),
        companyFileInput:   $('companyFileInput'),
        companyFileName:    $('companyFileName'),
        companyStatus:      $('companyStatus'),
        removeCompanyBtn:   $('removeCompanyBtn'),

        // Controls
        startBtn:   $('startBtn'),
        pauseBtn:   $('pauseBtn'),
        clearBtn:   $('clearBtn'),

        // Stats
        statTotal:      $('statTotal'),
        statMatched:    $('statMatched'),
        statMalicious:  $('statMalicious'),
        statStatus:     $('statStatus'),

        // Progress
        progressContainer:  $('progressContainer'),
        progressText:       $('progressText'),
        timerText:          $('timerText'),
        progressBar:        $('progressBar'),

        // Results
        resultsBody:    $('resultsBody'),
        verdictFilter:  $('verdictFilter'),
        searchInput:    $('searchInput'),

        // Export
        exportBtn:         $('exportBtn'),
        exportMenu:        $('exportMenu'),
        exportCSVBtn:      $('exportCSVBtn'),
        exportJSONBtn:     $('exportJSONBtn'),
    };

    // Now safe to instantiate renderer (DOM is ready)
    renderer = new UIRenderer('resultsBody');

    if (!API_KEY) UI.apiKeyModal.style.display = 'flex';
    updateRateLimitUI();

    // API key modal
    UI.settingsBtn.addEventListener('click', () => {
        UI.apiKeyInput.value  = API_KEY;
        UI.proxyInput.value   = PROXY_URL;
        UI.apiTierSelect.value = API_TIER;
        updateRateLimitUI();
        UI.apiKeyModal.style.display = 'flex';
    });
    UI.closeApiModal.addEventListener('click', () => UI.apiKeyModal.style.display = 'none');
    UI.apiTierSelect.addEventListener('change', () => { API_TIER = UI.apiTierSelect.value; updateRateLimitUI(); });
    UI.saveApiKeyBtn.addEventListener('click', saveApiKey);

    // File uploads
    UI.iocFileInput.addEventListener('change', handleIocFileUpload);
    UI.companyFileInput.addEventListener('change', handleCompanyFileUpload);

    // Scan controls
    UI.startBtn.addEventListener('click', startScan);
    UI.pauseBtn.addEventListener('click', pauseScan);
    UI.clearBtn.addEventListener('click', clearAll);

    // Filter / search
    UI.verdictFilter.addEventListener('change', rerender);
    UI.searchInput.addEventListener('input', rerender);

    // Export dropdown
    UI.exportBtn.addEventListener('click', e => {
        e.stopPropagation();
        UI.exportMenu.style.display = UI.exportMenu.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', () => UI.exportMenu.style.display = 'none');
    UI.exportCSVBtn.addEventListener('click',  e => { e.preventDefault(); UIRenderer.exportCSV(results);  });
    UI.exportJSONBtn.addEventListener('click', e => { e.preventDefault(); UIRenderer.exportJSON(results); });

    // Drag-and-drop for both zones
    setupDropZone('iocDropZone',     UI.iocFileInput);
    setupDropZone('companyDropZone', UI.companyFileInput);

    // Baseline persistence
    UI.removeCompanyBtn.addEventListener('click', clearCompanyBaseline);
    loadCompanyBaselineFromStorage();

    // Clickable stats card filtering
    const cardMatched = $('cardMatched');
    if (cardMatched) {
        cardMatched.addEventListener('click', () => {
            UI.verdictFilter.value = 'ALL_MATCHES';
            rerender();
        });
    }

    // ─── Tabs Logic ────────────────────────────────────────────────────────
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            tabLinks.forEach(l => l.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            link.classList.add('active');
            document.getElementById('tab-' + link.dataset.tab).classList.add('active');
        });
    });

    // ─── Clean Filter Init ──────────────────────────────────────────────────
    cleanFilter = new CleanFilter(companySet);

    // Bind Clean Filter's company file input to reuse app.js logic
    const cleanCompanyFileInput = document.getElementById('cleanCompanyFileInput');
    if (cleanCompanyFileInput) {
        cleanCompanyFileInput.addEventListener('change', handleCompanyFileUpload);
    }
    const cleanRemoveCompanyBtn = document.getElementById('cleanRemoveCompanyBtn');
    if (cleanRemoveCompanyBtn) {
        cleanRemoveCompanyBtn.addEventListener('click', clearCompanyBaseline);
    }

    rerender();
});

function loadCompanyBaselineFromStorage() {
    try {
        const storedName = localStorage.getItem('ioc_baseline_name');
        const storedData = localStorage.getItem('ioc_baseline_data');
        if (storedData && storedName) {
            const arr = JSON.parse(storedData);
            if (Array.isArray(arr) && arr.length > 0) {
                // We must update the set IN PLACE so cleanFilter.js sees the updates via reference
                companySet.clear();
                arr.forEach(i => companySet.add(i));

                syncCompanyUIAcrossTabs(`✓ ${storedName}`, `${companySet.size} unique indicators in baseline`, 'ready', true);
            }
        }
    } catch (e) {
        console.error('Failed to load baseline from storage', e);
        localStorage.removeItem('ioc_baseline_data');
        localStorage.removeItem('ioc_baseline_name');
    }
}

function clearCompanyBaseline() {
    companySet.clear();
    localStorage.removeItem('ioc_baseline_data');
    localStorage.removeItem('ioc_baseline_name');
    if (UI.companyFileInput) UI.companyFileInput.value = '';
    const cleanCompanyFileInput = document.getElementById('cleanCompanyFileInput');
    if (cleanCompanyFileInput) cleanCompanyFileInput.value = '';

    syncCompanyUIAcrossTabs('— No file', '', '', false);
}

// ─── File handlers ─────────────────────────────────────────────────────────

async function handleIocFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    UI.iocFileName.textContent = `Reading ${file.name}...`;
    try {
        const text = await FileProcessor.readAsText(file);
        // Show preview (capped) in textarea, cache full text
        window._iocRawText = text;
        UI.iocInput.value = text.length > 40000
            ? text.substring(0, 40000) + '\n\n[Preview truncated — full data loaded in memory]'
            : text;
        UI.iocFileName.textContent = `✓ ${file.name}`;
    } catch (err) {
        UI.iocFileName.textContent = '✗ Read error';
        console.error(err);
    }
}

async function handleCompanyFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    UI.companyFileName.textContent = `Reading ${file.name}...`;
    UI.companyStatus.textContent   = '';
    setCompanyStatusClass('loading');

    try {
        const text = await FileProcessor.readAsText(file);
        await buildCompanyBaseline(text, file.name);
    } catch (err) {
        UI.companyFileName.textContent = '✗ Error reading file';
        UI.companyStatus.textContent   = err.message;
        console.error(err);
    }
}

/**
 * Parse company file text in non-blocking async chunks.
 * Updates UI with progress so the browser never freezes.
 */
async function buildCompanyBaseline(text, label = '') {
    companySet.clear();
    if (!text.trim()) {
        UI.companyFileName.textContent = '— No file';
        UI.companyStatus.textContent   = '';
        return;
    }

    const CHUNK = 300_000; // 300KB per tick
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
        IOCParser.parse(chunk).forEach(ioc => companySet.add(ioc.value.toLowerCase()));
        pos = end;

        const pct = Math.round((pos / text.length) * 100);
        UI.companyStatus.textContent = `Processing... ${pct}%`;

        // Yield so Chrome doesn't show "not responding"
        await new Promise(r => setTimeout(r, 0));
    }

    syncCompanyUIAcrossTabs(label ? `✓ ${label}` : '✓ Loaded', `${companySet.size} unique indicators in baseline`, 'ready', true);

    try {
        localStorage.setItem('ioc_baseline_data', JSON.stringify(Array.from(companySet)));
        localStorage.setItem('ioc_baseline_name', label || 'Loaded');
    } catch(e) {
        console.warn('Baseline too large to save to localStorage.', e);
    }

    console.debug('[IOC Hunter] Company baseline set:', [...companySet].slice(0, 20));
}

// ─── Scan lifecycle ────────────────────────────────────────────────────────

function startScan() {
    if (!API_KEY) { UI.apiKeyModal.style.display = 'flex'; return; }

    const rawText = (window._iocRawText || UI.iocInput.value).trim();
    window._iocRawText = null; // consume

    if (!rawText && currentQueue.length === 0) {
        console.warn('[IOC Hunter] No IOCs provided via input or file.');
        alert('Please paste IOCs or upload a threat file first.');
        return;
    }

    if (rawText) {
        let parsed = IOCParser.parse(rawText);
        // Filter out private IPs, localhost, and trusted corporate domains
        parsed = IOCParser.filterBenign(parsed);

        const unique = parsed.filter(p => !results.some(r => r.ioc === p.value) && !currentQueue.some(c => c.value === p.value));
        
        // ── Pre-tag: flag which items match baseline BEFORE VT lookup ──
        unique.forEach(item => {
            item.isMatched = companySet.has(item.value.toLowerCase());
        });
        
        currentQueue.push(...unique);
    }
    
    if (currentQueue.length === 0) {
        console.warn('[IOC Hunter] No valid, unique, or external IOCs found to process.');
        alert('No valid unique IOCs found to process. (Private IPs and benign domains are skipped).');
        return;
    }

    const baselineSize = companySet.size;
    const preMatched = currentQueue.filter(i => i.isMatched).length;
    if (baselineSize > 0) {
        setStatus(`Baseline: ${baselineSize} IOCs | Pre-matched queue: ${preMatched}`, 'status-running');
    }

    // Recreate client with latest key/proxy
    vtClient = new VTClient(API_KEY, PROXY_URL);

    // Clear input now that ingestion succeeded
    UI.iocInput.value          = '';
    UI.iocFileName.textContent = '';
    if (UI.iocFileInput) UI.iocFileInput.value = '';

    isPaused = false;
    UI.startBtn.disabled  = true;
    UI.pauseBtn.disabled  = false;
    UI.progressContainer.style.display = 'block';

    updateStats();
    if (!isProcessing) processQueue();
}

function pauseScan() {
    isPaused = true;
    UI.startBtn.disabled = false;
    UI.pauseBtn.disabled = true;
    setStatus('Paused', 'status-paused');
}

function clearAll() {
    isPaused = true;
    setTimeout(() => {
        currentQueue = [];
        results      = [];
        // Intentionally NOT clearing companySet so it persists across general scans
        window._iocRawText = null;
        UI.iocInput.value  = '';
        if (UI.iocFileInput)  UI.iocFileInput.value  = '';
        if (UI.iocFileName)   UI.iocFileName.textContent = '';
        
        UI.progressContainer.style.display = 'none';
        UI.startBtn.disabled = false;
        UI.pauseBtn.disabled = true;
        updateStats();
        rerender();
        setStatus('Idle', 'status-idle');
    }, 100);
}

// ─── Queue processing ──────────────────────────────────────────────────────

async function processQueue() {
    isProcessing = true;

    while (currentQueue.length > 0 && !isPaused) {
        setStatus('Running', 'status-running');
        const item = currentQueue.shift();
        // item.isMatched was pre-tagged in startScan
        const wasMatched = item.isMatched || companySet.has(item.value.toLowerCase());

        try {
            updateStats();
            UI.progressText.textContent = `Scanning ${item.value}...`;

            const vtResult = await vtClient.lookup(item.value, item.type);
            vtResult.isMatched = wasMatched; // apply pre-computed match
            results.unshift(vtResult);

            rerender();
            updateStats();

            if (currentQueue.length > 0 && !isPaused) {
                await countdown(RATE_LIMIT_MS);
            }
        } catch (err) {
            if (err.message === 'RATE_LIMIT' || err.message.includes('429')) {
                currentQueue.unshift(item);
                setStatus('Rate Limited — waiting...', 'status-ratelimited');
                await countdown(60_000);
            } else if (err.message === 'FORBIDDEN') {
                alert('Your API key is invalid or lacks permissions.');
                pauseScan();
                currentQueue.unshift(item);
                UI.apiKeyModal.style.display = 'flex';
                break;
            } else {
                // VT failed — still show the item with correct match status
                results.unshift({
                    ioc: item.value, type: item.type,
                    verdict: 'UNKNOWN', malicious: 0, suspicious: 0, harmless: 0,
                    country: '—', isp: 'VT Unreachable', tags: [],
                    isMatched: wasMatched   // ← correct even on VT error
                });
                rerender();
                updateStats();
            }
        }
    }

    if (currentQueue.length === 0) {
        isPaused = true;
        UI.startBtn.disabled = false;
        UI.pauseBtn.disabled = true;
        setStatus('Completed ✓', 'status-completed');
        UI.progressText.textContent = 'All IOCs processed!';
        UI.timerText.textContent    = '';
        if (timerTimeout) clearTimeout(timerTimeout);
    }

    isProcessing = false;
}

function countdown(ms) {
    return new Promise(resolve => {
        let remaining = ms;
        const tick = () => {
            if (isPaused) { resolve(); return; }
            if (remaining <= 0) { UI.timerText.textContent = 'Ready...'; resolve(); return; }
            UI.timerText.textContent = `Next query in: ${Math.ceil(remaining / 1000)}s`;
            remaining -= 1000;
            timerTimeout = setTimeout(tick, 1000);
        };
        tick();
    });
}

// ─── UI helpers ────────────────────────────────────────────────────────────

function rerender() {
    renderer.render(results, {
        filter: UI.verdictFilter.value,
        search: UI.searchInput.value
    });
}

function updateStats() {
    const total    = results.length + currentQueue.length;
    const matched  = results.filter(r => r.isMatched).length;
    const malicious = results.filter(r => r.isMatched && r.verdict === 'MALICIOUS').length;

    UI.statTotal.textContent    = total > 0 ? `${results.length} / ${total}` : '0 / 0';
    UI.statMatched.textContent  = matched;
    UI.statMalicious.textContent = malicious;

    if (total > 0) {
        UI.progressBar.style.width = `${Math.floor((results.length / total) * 100)}%`;
    } else {
        UI.progressBar.style.width = '0%';
    }
}

function setStatus(text, cls) {
    UI.statStatus.textContent = text;
    UI.statStatus.className   = cls;
}

function setCompanyStatusClass(state) {
    [UI.companyStatus, document.getElementById('cleanCompanyStatus')].forEach(el => {
        if (!el) return;
        el.className = '';
        if (state === 'loading') el.style.color = 'var(--verdict-suspicious)';
        if (state === 'ready')   el.style.color = 'var(--verdict-clean)';
    });
}

function syncCompanyUIAcrossTabs(nameText, statusText, state, showRemove) {
    UI.companyFileName.textContent = nameText;
    UI.companyStatus.textContent = statusText;
    UI.removeCompanyBtn.style.display = showRemove ? 'block' : 'none';

    const cleanName = document.getElementById('cleanCompanyFileName');
    const cleanStatus = document.getElementById('cleanCompanyStatus');
    const cleanRemove = document.getElementById('cleanRemoveCompanyBtn');

    if (cleanName) cleanName.textContent = nameText;
    if (cleanStatus) cleanStatus.textContent = statusText;
    if (cleanRemove) cleanRemove.style.display = showRemove ? 'block' : 'none';

    setCompanyStatusClass(state);
}

function updateRateLimitUI() {
    const map = {
        FREE:     { ms: 15000, notice: '<strong>Free Tier:</strong> 4 req/min · 500/day',            text: 'Free Tier: 15s delay' },
        STANDARD: { ms:  4000, notice: '<strong>Standard Tier:</strong> 15 req/min',                  text: 'Standard: 4s delay' },
        PREMIUM:  { ms:   500, notice: '<strong>Premium Tier:</strong> Burst mode — watch your quota', text: 'Premium: 0.5s delay' },
    };
    const cfg = map[API_TIER] || map.FREE;
    RATE_LIMIT_MS = cfg.ms;
    UI.tierNotice.innerHTML    = cfg.notice;
    UI.rateLimitText.textContent = cfg.text;
}

function saveApiKey() {
    const key   = UI.apiKeyInput.value.trim();
    const proxy = UI.proxyInput.value.trim();
    if (!key) { alert('Please enter a valid API Key.'); return; }
    API_KEY    = key;
    PROXY_URL  = proxy;
    API_TIER   = UI.apiTierSelect.value;
    localStorage.setItem('vt_apikey', key);
    localStorage.setItem('vt_proxy',  proxy);
    localStorage.setItem('vt_tier',   API_TIER);
    updateRateLimitUI();
    UI.apiKeyModal.style.display = 'none';
}

// ─── Drag & Drop helper ────────────────────────────────────────────────────

function setupDropZone(zoneId, inputEl) {
    const zone = document.getElementById(zoneId);
    if (!zone || !inputEl) return;

    // Click anywhere on the zone → open file picker
    zone.addEventListener('click', () => inputEl.click());

    // Drag and drop
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
