import { IOCParser } from './parser.js';
import { VTApi } from './vt-api.js';

// ---- Data Structures & State ----
let API_KEY = localStorage.getItem('vt_apikey') || '';
let currentQueue = []; // Items to process
let results = []; // Items processed
let isPaused = true;
let isProcessing = false;

// 15 seconds required between requests on Free Tier (4 per min)
const RATE_LIMIT_MS = 15000; 

// ---- DOM Elements ----
const UI = {
    apiKeyModal: document.getElementById('apiKeyModal'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
    closeApiModal: document.getElementById('closeApiModal'),
    settingsBtn: document.getElementById('apiKeySettingsBtn'),

    iocInput: document.getElementById('iocInput'),
    fileUpload: document.getElementById('fileUpload'),
    fileNameDisplay: document.getElementById('fileNameDisplay'),
    
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    clearBtn: document.getElementById('clearBtn'),

    statTotal: document.getElementById('statTotal'),
    statProcessed: document.getElementById('statProcessed'),
    statStatus: document.getElementById('statStatus'),

    progressContainer: document.getElementById('progressContainer'),
    progressText: document.getElementById('progressText'),
    timerText: document.getElementById('timerText'),
    progressBar: document.getElementById('progressBar'),

    resultsBody: document.getElementById('resultsBody'),
    verdictFilter: document.getElementById('verdictFilter'),
    searchInput: document.getElementById('searchInput'),

    exportBtn: document.getElementById('exportBtn'),
    exportMenu: document.getElementById('exportMenu'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    exportJsonBtn: document.getElementById('exportJsonBtn')
};

// ---- Initialization ----
document.addEventListener('DOMContentLoaded', () => {
    // If no API key, show modal by default
    if (!API_KEY) {
        UI.apiKeyModal.style.display = 'flex';
    }

    // Attach Event Listeners
    UI.settingsBtn.addEventListener('click', () => {
        UI.apiKeyInput.value = API_KEY;
        UI.apiKeyModal.style.display = 'flex';
    });
    
    UI.closeApiModal.addEventListener('click', () => UI.apiKeyModal.style.display = 'none');
    
    UI.saveApiKeyBtn.addEventListener('click', () => {
        const key = UI.apiKeyInput.value.trim();
        if (key) {
            API_KEY = key;
            localStorage.setItem('vt_apikey', key);
            UI.apiKeyModal.style.display = 'none';
        } else {
            alert('Please enter a valid API Key.');
        }
    });

    UI.fileUpload.addEventListener('change', handleFileUpload);
    UI.startBtn.addEventListener('click', startScan);
    UI.pauseBtn.addEventListener('click', pauseScan);
    UI.clearBtn.addEventListener('click', clearAll);

    UI.verdictFilter.addEventListener('change', renderTable);
    UI.searchInput.addEventListener('keyup', renderTable);

    // Export Dropdown
    UI.exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        UI.exportMenu.style.display = UI.exportMenu.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', () => UI.exportMenu.style.display = 'none');

    UI.exportCsvBtn.addEventListener('click', (e) => { e.preventDefault(); exportCSV(); });
    UI.exportJsonBtn.addEventListener('click', (e) => { e.preventDefault(); exportJSON(); });
});

// ---- Processing Logic ----

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    UI.fileNameDisplay.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (evt) => {
        UI.iocInput.value = evt.target.result;
    };
    reader.readAsText(file);
}

function startScan() {
    if (!API_KEY) {
        UI.apiKeyModal.style.display = 'flex';
        return;
    }

    const textInput = UI.iocInput.value.trim();
    if (!textInput && currentQueue.length === 0) {
        alert("Please provide IOCs via the text area or a file.");
        return;
    }

    // If starting fresh (not unpausing), parse rules
    if (currentQueue.length === 0 || isPaused) {
         if (textInput) {
             const parsed = IOCParser.parse(textInput);
             // Filter out anything already in results
             const newQueue = parsed.filter(p => !results.some(r => r.ioc === p.value));
             currentQueue = newQueue;
         }
         
         if (currentQueue.length === 0) {
             alert('No valid or unique IOCs found to process.');
             return;
         }
    }

    // Update UI State
    UI.iocInput.value = '';
    UI.fileNameDisplay.textContent = '';
    UI.fileUpload.value = '';
    
    isPaused = false;
    UI.startBtn.disabled = true;
    UI.pauseBtn.disabled = false;
    UI.progressContainer.style.display = 'block';

    updateStats();

    if (!isProcessing) {
        processQueueLoop();
    }
}

function pauseScan() {
    isPaused = true;
    UI.startBtn.disabled = false;
    UI.pauseBtn.disabled = true;
    setStatus('Paused', 'status-paused');
}

function clearAll() {
    isPaused = true;
    setTimeout(() => { // small delay allowing loop to exit
        currentQueue = [];
        results = [];
        UI.iocInput.value = '';
        UI.progressContainer.style.display = 'none';
        
        UI.startBtn.disabled = false;
        UI.pauseBtn.disabled = true;
        
        updateStats();
        renderTable();
        setStatus('Idle', 'status-idle');
    }, 100);
}

// Keep track of the active timeout so it can be cleared easily if needed
let timerTimeout = null;

async function processQueueLoop() {
    isProcessing = true;
    const vtApi = new VTApi(API_KEY);

    while (currentQueue.length > 0 && !isPaused) {
        setStatus('Running', 'status-running');
        
        const currentItem = currentQueue.shift(); // take first one
        
        try {
            // Update UI
            updateStats();
            UI.progressText.textContent = `Processing ${currentItem.value}...`;

            // Call API
            const rs = await vtApi.scanIoc(currentItem.value, currentItem.type);
            results.unshift(rs); // Add to beginning of results array
            
            // Re-render table dynamically
            renderTable();
            updateStats();

            // Wait 15 Seconds (if more items exist in queue)
            if (currentQueue.length > 0 && !isPaused) {
                await countdownTimer(RATE_LIMIT_MS);
            }

        } catch (error) {
            console.error(error);
            if (error.message === 'RATE_LIMIT' || error.message.includes('429')) {
                // Rate limited: PAUSE, wait, put it back
                currentQueue.unshift(currentItem);
                setStatus('Rate Limited! Waiting...', 'status-ratelimited');
                await countdownTimer(60000); // Backoff 60 seconds
            } else if (error.message === 'FORBIDDEN' || error.message.includes('403')) {
                alert("API Key is invalid or you don't have access.");
                pauseScan();
                currentQueue.unshift(currentItem);
                UI.apiKeyModal.style.display = 'flex';
                break;
            } else {
                // Unknown error (Failed to fetch, network issue etc)
                results.unshift({
                    ioc: currentItem.value,
                    type: currentItem.type,
                    verdict: 'UNKNOWN',
                    malicious: 0, suspicious: 0, harmless: 0,
                    country: 'Error', isp: 'Error', tags: ['Fetch Failed']
                });
                renderTable();
                updateStats();
            }
        }
    }

    if (currentQueue.length === 0) {
        isPaused = true;
        UI.startBtn.disabled = false;
        UI.pauseBtn.disabled = true;
        setStatus('Completed', 'status-completed');
        UI.progressText.textContent = `Completed!`;
        UI.timerText.textContent = '';
        if(timerTimeout) clearTimeout(timerTimeout);
    }

    isProcessing = false;
}

// Real-time countdown clock
function countdownTimer(ms) {
    return new Promise(resolve => {
        let remaining = ms;
        
        const tick = () => {
            if (isPaused) { // If user paused during wait, exit early
                resolve();
                return;
            }
            if (remaining <= 0) {
                UI.timerText.textContent = 'Ready...';
                resolve();
            } else {
                UI.timerText.textContent = `Next query in: ${Math.ceil(remaining/1000)}s`;
                remaining -= 1000;
                timerTimeout = setTimeout(tick, 1000);
            }
        };
        tick();
    });
}

// ---- UI Updating ----

function updateStats() {
    const total = results.length + currentQueue.length;
    UI.statTotal.textContent = total;
    UI.statProcessed.textContent = results.length;
    
    if (total > 0) {
        const percent = Math.floor((results.length / total) * 100);
        UI.progressBar.style.width = `${percent}%`;
    } else {
        UI.progressBar.style.width = `0%`;
    }
}

function setStatus(text, className) {
    UI.statStatus.textContent = text;
    UI.statStatus.className = className;
}

function renderTable() {
    // Collect filters
    const filterVerdict = UI.verdictFilter.value;
    const filterSearch = UI.searchInput.value.toLowerCase();

    // Clear Body
    UI.resultsBody.innerHTML = '';

    // Apply Search/Filters
    let filteredResults = results.filter(row => {
        let matchVerdict = filterVerdict === 'ALL' || row.verdict === filterVerdict;
        let matchSearch = !filterSearch || row.ioc.toLowerCase().includes(filterSearch);
        return matchVerdict && matchSearch;
    });

    if (filteredResults.length === 0) {
        let text = results.length === 0 ? "No results yet." : "No results match your filters.";
        UI.resultsBody.innerHTML = `
            <tr class="empty-state-row">
                <td colspan="9" class="empty-state">
                    <p>${text}</p>
                </td>
            </tr>`;
        return;
    }

    // Build Rows
    filteredResults.forEach(r => {
        let tr = document.createElement('tr');
        
        // Dynamic Badge mapping
        let badgeClass = 'badge-clean';
        if (r.verdict === 'MALICIOUS') badgeClass = 'badge-malicious';
        if (r.verdict === 'SUSPICIOUS') badgeClass = 'badge-suspicious';
        if (r.verdict === 'UNKNOWN') badgeClass = 'badge-unknown';

        let tagsHtml = ``;
        if (r.tags && r.tags.length > 0) {
            tagsHtml = `<div class="tag-container">${r.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`;
        }

        tr.innerHTML = `
            <td><strong>${r.ioc}</strong></td>
            <td><span class="badge" style="background: rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#94A3B8;">${r.type.toUpperCase()}</span></td>
            <td><span class="badge ${badgeClass}">${r.verdict}</span></td>
            <td style="color: var(--verdict-malicious);">${r.malicious}</td>
            <td style="color: var(--verdict-suspicious);">${r.suspicious}</td>
            <td style="color: var(--text-secondary);">${r.harmless}</td>
            <td><div style="font-size: 0.8rem;">${r.country}<br/><span style="color: var(--text-secondary);">${r.isp}</span></div></td>
            <td>${tagsHtml}</td>
            <td>
                <a href="https://www.virustotal.com/gui/${r.type === 'ip' ? 'ip-address' : 'domain'}/${r.ioc}" target="_blank" class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">VT Link</a>
            </td>
        `;

        UI.resultsBody.appendChild(tr);
    });
}

// ---- Exporters ----
function exportCSV() {
    if (results.length === 0) return alert("Nothing to export.");
    
    const headers = ["IOC", "Type", "Verdict", "Malicious", "Suspicious", "Harmless", "Country", "ISP", "Tags"];
    const rows = results.map(r => {
        return [
            r.ioc,
            r.type,
            r.verdict,
            r.malicious,
            r.suspicious,
            r.harmless,
            `"${r.country}"`,
            `"${r.isp}"`,
            `"${r.tags ? r.tags.join('; ') : ''}"`
        ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    downloadFile(encodedUri, "ioc_hunter_results.csv");
}

function exportJSON() {
    if (results.length === 0) return alert("Nothing to export.");
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(results, null, 2));
    downloadFile(dataStr, "ioc_hunter_results.json");
}

function downloadFile(uri, filename) {
    const link = document.createElement("a");
    link.setAttribute("href", uri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
