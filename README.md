# 🎯 IOC Hunter — Internal Exposure & Correlation Engine

> A fully client-side, privacy-first web application for SOC analysts, threat hunters, and security researchers to bulk-scan Indicators of Compromise (IPs & Domains) against the **VirusTotal v3 API** and correlate them against internal company assets — all without ever transmitting sensitive data to any third-party server.

**🌐 Live Demo:** [https://naseeeeef.github.io/ioc-hunter/](https://naseeeeef.github.io/ioc-hunter/)

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [Architecture Overview](#-architecture-overview)
- [Project Structure](#-project-structure)
- [Module Documentation](#-module-documentation)
  - [app.js — Main Orchestrator](#appjs--main-orchestrator)
  - [parser.js — IOC Extraction Engine](#parserjs--ioc-extraction-engine)
  - [normalizer.js — Refanging & Normalization](#normalizerjs--refanging--normalization)
  - [vtClient.js — VirusTotal API Client](#vtclientjs--virustotal-api-client)
  - [vt-api.js — Legacy VT API Module](#vt-apijs--legacy-vt-api-module)
  - [correlator.js — Baseline Correlation](#correlatorjs--baseline-correlation)
  - [fileReader.js — File Processor](#filereaderjs--file-processor)
  - [uiRenderer.js — Results Renderer & Exporter](#uirendererjs--results-renderer--exporter)
  - [cleanFilter.js — IOC Clean Filter Tab](#cleanfilterjs--ioc-clean-filter-tab)
  - [app-worker.js — Web Worker for Background Parsing](#app-workerjs--web-worker-for-background-parsing)
  - [worker.js — Cloudflare CORS Proxy](#workerjs--cloudflare-cors-proxy)
- [Getting Started](#-getting-started)
- [Corporate Proxy Setup](#-corporate-proxy-setup)
- [Privacy & Security](#-privacy--security)
- [Tech Stack](#-tech-stack)
- [License](#-license)

---

## 🚀 Key Features

### Tab 1: VT Scan — Threat Intelligence Scanner
| Feature | Description |
|---|---|
| **Smart IOC Parsing** | Extracts IPv4, IPv6, and domains from any raw text, ignoring timestamps, hashes, emails, and noise |
| **Automatic Refanging** | Converts obfuscated indicators (`8.8[.]8[.]8`, `hxxps://evil[.]com`) back to scannable format |
| **Benign Filtering** | Automatically drops private RFC1918 IPs (`10.x`, `192.168.x`), localhost, and trusted domains (`google.com`, `.local`) |
| **Multi-Format Upload** | Accepts `.txt`, `.csv`, `.xlsx`, `.xls`, `.log` files via drag-and-drop or file picker |
| **Company Baseline Correlation** | Upload your internal asset list to flag any threat IOC that matches your infrastructure as **⚠ Exposed** |
| **Async Queue Processing** | Non-blocking scan queue with live progress bar, pause/resume, and dynamic IOC injection mid-scan |
| **Configurable Rate Limiting** | Free (15s), Standard (4s), and Premium (0.5s) API speed tiers |
| **CORS Proxy Fallbacks** | Custom proxy → `corsproxy.io` → direct connection cascade |
| **In-Memory Caching** | Avoids duplicate API calls for already-scanned IOCs |
| **Advanced Filtering** | Filter results by: All, Matched Internal Only, Matched Risky, External Risky, Clean Only |
| **Export** | CSV and JSON export for all results or matched-only, plus real-time search |

### Tab 2: Clean Filter — Offline Deduplication
| Feature | Description |
|---|---|
| **Cross-List Deduplication** | Compares threat IOC list against company baseline to separate clean vs. matched indicators |
| **No API Required** | Runs entirely offline — no VirusTotal key needed |
| **Chunked Processing** | Handles 50,000+ entries without freezing the browser |
| **Dual Output Panes** | Side-by-side view: Final Clean IOCs (left) and Removed IOCs (right) |
| **Copy to Clipboard** | One-click copy for both clean and removed lists |
| **Export** | Export results as TXT or CSV with timestamped filenames |
| **Independent Baseline** | Separate baseline storage from the VT Scan tab |

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                      index.html                          │
│            (Dual-tab UI: VT Scan │ Clean Filter)         │
├──────────────────────────────────────────────────────────┤
│                       app.js                             │
│              Main Orchestrator (ES Module)                │
│    ┌────────────┬────────────┬────────────┐              │
│    │ parser.js  │ vtClient.js│ fileReader  │              │
│    │ normalizer │ correlator │ uiRenderer  │              │
│    └────────────┴────────────┴────────────┘              │
│                   cleanFilter.js                         │
│           (Self-contained Tab 2 controller)              │
├──────────────────────────────────────────────────────────┤
│  localStorage: API Key, Proxy URL, Tier, Baselines       │
│  External CDN: SheetJS (xlsx.full.min.js)                │
│  External API: VirusTotal v3 REST (via CORS proxy)       │
└──────────────────────────────────────────────────────────┘
```

**Data Flow (VT Scan):**
1. User uploads/pastes IOC data → `FileProcessor.readAsText()` → raw text
2. `IOCParser.parse()` extracts IOCs using `Normalizer.refang()` + regex
3. `IOCParser.filterBenign()` removes private/trusted indicators
4. Each IOC is pre-tagged via `companySet.has()` for baseline match status
5. `VTClient.lookup()` queries VirusTotal → result cached in memory
6. `UIRenderer.render()` displays results with filtering and search
7. Export via `UIRenderer.exportCSV()` / `UIRenderer.exportJSON()`

---

## 📁 Project Structure

```
ioc-hunter/
├── index.html              # Main HTML — dual-tab layout with glassmorphism UI
├── favicon.svg             # SVG crosshair favicon
├── worker.js               # Cloudflare Workers CORS proxy script
├── PROXY-SETUP.md          # Step-by-step corporate proxy deployment guide
├── README.md               # This file
├── .gitignore              # node_modules exclusion
│
├── css/
│   └── style.css           # Full design system — glassmorphism, tokens, responsive
│
└── js/
    ├── app.js              # Main orchestrator — state, events, scan lifecycle
    ├── parser.js           # IOC extraction (IPv4, IPv6, domain) with dedup
    ├── normalizer.js       # Refanging and text normalization
    ├── vtClient.js         # VirusTotal v3 API client with caching & proxy fallback
    ├── vt-api.js           # Legacy/alternative VT API client
    ├── correlator.js       # Company baseline builder and matcher
    ├── fileReader.js       # File reader (.txt, .csv, .xlsx/.xls via SheetJS)
    ├── uiRenderer.js       # Results table renderer and CSV/JSON exporter
    ├── cleanFilter.js      # Clean Filter tab — self-contained controller
    └── app-worker.js       # Web Worker for background file parsing
```

---

## 📖 Module Documentation

### `app.js` — Main Orchestrator

The central controller. Manages global state, initializes all modules, wires up all event listeners, and controls the scan lifecycle.

#### State Variables
| Variable | Type | Description |
|---|---|---|
| `API_KEY` | `string` | VirusTotal API key (persisted in `localStorage`) |
| `PROXY_URL` | `string` | Custom CORS proxy URL (persisted in `localStorage`) |
| `API_TIER` | `string` | Rate limit tier: `FREE`, `STANDARD`, or `PREMIUM` |
| `RATE_LIMIT_MS` | `number` | Delay between API requests in milliseconds |
| `currentQueue` | `Array` | Pending IOCs awaiting VT lookup |
| `results` | `Array` | Completed scan results |
| `companySet` | `Set<string>` | In-memory hash set of baseline company IOCs |
| `isPaused` | `boolean` | Whether the scan engine is paused |
| `isProcessing` | `boolean` | Whether the queue processor is actively running |

#### Functions

| Function | Description |
|---|---|
| `loadCompanyBaselineFromStorage()` | Restores the company baseline `Set` from `localStorage` on page load |
| `clearCompanyBaseline()` | Clears the baseline from memory and `localStorage`, resets UI |
| `handleIocFileUpload(e)` | Reads uploaded threat IOC file via `FileProcessor.readAsText()`, populates textarea |
| `handleCompanyFileUpload(e)` | Reads uploaded company asset file, triggers `buildCompanyBaseline()` |
| `buildCompanyBaseline(text, label)` | Parses company file in async 300KB chunks, builds `companySet`, persists to `localStorage` |
| `startScan()` | Validates input, parses IOCs, filters benign, pre-tags baseline matches, starts queue |
| `pauseScan()` | Pauses the scan queue, updates UI state |
| `clearAll()` | Resets all state (queue, results, UI) — does **not** clear the company baseline |
| `processQueue()` | Async loop: dequeues IOC → `VTClient.lookup()` → stores result → countdown → repeat |
| `countdown(ms)` | Returns a `Promise` that resolves after `ms` with a live UI countdown timer |
| `rerender()` | Calls `UIRenderer.render()` with current filter and search values |
| `updateStats()` | Updates the dashboard stat cards (Processed/Total, Matched, Malicious) |
| `setStatus(text, cls)` | Sets the Engine Status badge text and CSS class |
| `setCompanyStatusClass(state)` | Applies color styling to the company status indicator |
| `syncCompanyUI(nameText, statusText, state, showRemove)` | Updates all company baseline UI elements at once |
| `updateRateLimitUI()` | Applies the rate limit configuration based on selected API tier |
| `saveApiKey()` | Saves API key, proxy URL, and tier to `localStorage` |
| `setupDropZone(zoneId, inputEl)` | Wires up drag-and-drop + click-to-upload behavior on a drop zone |

---

### `parser.js` — IOC Extraction Engine

Extracts and deduplicates valid IPv4, IPv6, and domain indicators from arbitrary text. Ignores timestamps, hashes, emails, file extensions, and URL paths.

#### Class: `IOCParser`

| Method | Signature | Description |
|---|---|---|
| `parse` | `static parse(text: string): Array<{value, type}>` | Refangs text via `Normalizer`, then extracts IPv4 (`ip`), IPv6 (`ipv6`), and domains using regex. Deduplicates results. Skips noise file extensions (`.png`, `.exe`, `.json`, etc.), email fragments, and hash-like strings. |
| `filterBenign` | `static filterBenign(iocs: Array): Array` | Removes private IPs (RFC1918: `10.x`, `192.168.x`, `172.16-31.x`, `127.x`, `169.254.x`), trusted domains (`google.com`, `microsoft.com`, etc.), and internal suffixes (`.local`, `.internal`, `.lan`, `.corp`, `.home`). |

#### Regex Patterns
| Pattern | Target |
|---|---|
| `IPV4_RE` | Strict IPv4 with octet boundary validation (0-255) |
| `IPV6_RE` | Full and compressed IPv6 forms |
| `DOMAIN_RE` | `label.tld` pattern with 2-24 char alpha TLD |
| `HASH_RE` | MD5/SHA1/SHA256 hex strings (32-64 chars) — **excluded** |
| `EMAIL_RE` | Strings containing `@` — **excluded** |
| `NOISE_EXTENSIONS` | 30+ file extensions treated as non-IOC noise — **excluded** |

---

### `normalizer.js` — Refanging & Normalization

Converts obfuscated/defanged IOC text back into scannable format.

#### Class: `Normalizer`

| Method | Signature | Description |
|---|---|---|
| `refang` | `static refang(raw: string): string` | Replaces `[.]` → `.`, `(dot)` → `.`, `[:]` → `:`, `hxxp` → `http`, `[at]` → `@`, removes zero-width spaces and BOM chars |
| `normalizeDomain` | `static normalizeDomain(domain: string): string` | Lowercases, strips `www.` prefix and trailing dots |
| `normalizeIP` | `static normalizeIP(ip: string): string` | Trims whitespace from extracted IPs |

---

### `vtClient.js` — VirusTotal API Client

Handles all VirusTotal v3 API communication with CORS proxy fallback chain and in-memory caching.

#### Class: `VTClient`

| Method | Signature | Description |
|---|---|---|
| `constructor` | `new VTClient(apiKey, proxyUrl?)` | Initializes client with API key, optional proxy, and an empty `Map` cache |
| `lookup` | `async lookup(value, type): Promise<VTResult>` | Looks up an IOC. Returns cached result if available. Tries proxy chain; throws `RATE_LIMIT` or `FORBIDDEN` for 429/403 status. Returns empty result for 404. |
| `_buildEndpoints` | `_buildEndpoints(targetUrl): string[]` | Builds ordered endpoint list: custom proxy → `corsproxy.io` → direct URL |
| `_format` | `_format(value, type, json): VTResult` | Extracts `last_analysis_stats`, determines verdict (`MALICIOUS` / `SUSPICIOUS` / `CLEAN`), extracts country, ISP/registrar, and tags |
| `_empty` | `_empty(value, type): VTResult` | Returns a clean default result for 404 or missing data |

#### VTResult Object Shape
```javascript
{
  ioc: string,         // The indicator value
  type: string,        // 'ip', 'ipv6', or 'domain'
  verdict: string,     // 'MALICIOUS', 'SUSPICIOUS', 'CLEAN', or 'UNKNOWN'
  malicious: number,   // Count of malicious detections
  suspicious: number,  // Count of suspicious detections
  harmless: number,    // Count of harmless + undetected
  country: string,     // Country of origin
  isp: string,         // AS owner or domain registrar
  tags: string[],      // Up to 3 community tags
  isMatched: boolean,  // Whether it matched the company baseline
  fromCache: boolean   // Whether result was served from cache
}
```

---

### `vt-api.js` — Legacy VT API Module

An alternative/legacy VirusTotal API client with similar functionality to `vtClient.js`.

#### Class: `VTApi`

| Method | Signature | Description |
|---|---|---|
| `constructor` | `new VTApi(apiKey, customProxy)` | Initializes with API key and optional proxy |
| `scanIoc` | `async scanIoc(ioc, type): Promise<Object>` | Scans a single IOC. Uses custom proxy → `corsproxy.io` → `thingproxy` → direct fallback chain |
| `_formatResponse` | `_formatResponse(ioc, type, jsonData): Object` | Parses VirusTotal JSON into result object with verdict, stats, and tags |
| `_extractDomainRegistry` | `_extractDomainRegistry(attr): string` | Extracts registrar info for domain IOCs |
| `_formatEmptyResponse` | `_formatEmptyResponse(ioc, type): Object` | Returns default clean result for 404s |

---

### `correlator.js` — Baseline Correlation

Compares threat IOC datasets against the company asset baseline. All processing is 100% local — company data never leaves the browser.

#### Class: `Correlator`

| Method | Signature | Description |
|---|---|---|
| `buildBaseline` | `static buildBaseline(companyIocs): Set<string>` | Converts parsed company IOCs into a lowercase `Set` for O(1) lookup |
| `correlate` | `static correlate(threatIocs, baseline): Array` | Tags each threat IOC with `isMatched: true/false` based on baseline presence |
| `getMatched` | `static getMatched(correlated): Array` | Returns only IOCs that matched the company baseline |
| `getUnmatched` | `static getUnmatched(correlated): Array` | Returns only IOCs that did **not** match the baseline |

---

### `fileReader.js` — File Processor

Reads uploaded files into raw text strings. Supports plain text and Excel formats via SheetJS.

#### Class: `FileProcessor`

| Method | Signature | Description |
|---|---|---|
| `readAsText` | `static readAsText(file: File): Promise<string>` | Detects file extension: for `.xlsx`/`.xls`, reads as `ArrayBuffer` and converts all sheets to CSV using SheetJS `XLSX.read()` + `sheet_to_csv()`. For all other formats (`.txt`, `.csv`, `.log`), reads as plain text via `FileReader.readAsText()`. |

#### Supported Formats
| Extension | Method |
|---|---|
| `.txt`, `.csv`, `.log` | `FileReader.readAsText()` — direct text read |
| `.xlsx`, `.xls` | `XLSX.read()` → `sheet_to_csv()` — all sheets concatenated |

---

### `uiRenderer.js` — Results Renderer & Exporter

Renders the results table, applies filters, and handles CSV/JSON data export. Fully decoupled from business logic.

#### Class: `UIRenderer`

| Method | Signature | Description |
|---|---|---|
| `constructor` | `new UIRenderer(bodyId)` | Binds to a `<tbody>` element by ID |
| `render` | `render(results, opts): void` | Renders result rows into the table. Applies filter (`ALL`, `ALL_MATCHES`, `RISKY_MATCHES`, `UNMATCHED_RISKY`, `CLEAN`) and text search. Uses `DocumentFragment` for performance. |
| `_buildRow` | `_buildRow(r): HTMLElement` | Creates a single `<tr>` with: IOC value, type badge, verdict badge, VT score, country, ISP, match status, and VT link button |
| `exportCSV` | `static exportCSV(results, onlyMatched): void` | Generates CSV with headers: `Indicator, Type, Verdict, VT Score, Country, ISP, Match Status`. Downloads as `exposure_matched.csv` or `exposure_all.csv` |
| `exportJSON` | `static exportJSON(results, onlyMatched): void` | Exports filtered results as pretty-printed JSON |
| `_download` | `static _download(mimeType, content, filename): void` | Creates a Blob, generates an Object URL, triggers download, and cleans up |

#### Filter Options
| Value | Behavior |
|---|---|
| `ALL` | Show every scanned result |
| `ALL_MATCHES` | Only IOCs matching the company baseline |
| `RISKY_MATCHES` | Matched IOCs with MALICIOUS or SUSPICIOUS verdict |
| `UNMATCHED_RISKY` | Non-matched IOCs with MALICIOUS or SUSPICIOUS verdict |
| `CLEAN` | Only CLEAN verdict results |

---

### `cleanFilter.js` — IOC Clean Filter Tab

Self-contained controller for Tab 2 ("Clean Filter"). Performs client-side cross-list deduplication between a threat IOC list and a company baseline — no API calls needed.

#### Class: `CleanFilter`

| Method | Signature | Description |
|---|---|---|
| `constructor` | `new CleanFilter()` | Initializes own UI references, state, company baseline `Set`, and binds all events |
| `bindEvents` | `bindEvents(): void` | Wires up drop zones, file inputs, action buttons, copy buttons, and export dropdown menus |
| `setupDropZone` | `setupDropZone(zoneId, inputEl): void` | Configures click-to-upload and drag-and-drop for a drop zone element |
| `handleIocUpload` | `async handleIocUpload(e): void` | Reads the threat IOC file, caches full text in `window._cleanIocRawText`, shows preview in textarea |
| `handleCompanyFileUpload` | `async handleCompanyFileUpload(e): void` | Reads the company baseline file, triggers `buildCompanyBaseline()` |
| `buildCompanyBaseline` | `async buildCompanyBaseline(text, label): void` | Parses company data in async 300KB chunks, builds `companySet`, persists to `localStorage` with `clean_ioc_baseline_*` keys |
| `clearCompanyBaseline` | `clearCompanyBaseline(): void` | Clears baseline from memory and `localStorage` |
| `loadCompanyBaselineFromStorage` | `loadCompanyBaselineFromStorage(): void` | Restores baseline on page load from `localStorage` |
| `syncCompanyUI` | `syncCompanyUI(nameText, statusText, state, showRemove): void` | Updates all baseline UI elements atomically |
| `setCompanyStatusClass` | `setCompanyStatusClass(state): void` | Applies color for `loading` or `ready` states |
| `startCleaning` | `async startCleaning(): void` | Main processing pipeline: parses IOCs in 250KB chunks → deduplicates → filters benign → cross-references baseline → splits into clean/removed arrays → renders output |
| `updateStats` | `updateStats(): void` | Updates stat cards (Unique Total, Matched & Removed, Final Clean) |
| `renderOutput` | `renderOutput(): void` | Populates the clean and removed `<textarea>` elements |
| `copyToClipboard` | `async copyToClipboard(text, btn): void` | Copies textarea content to clipboard with visual feedback ("Copied!") |
| `clearAll` | `clearAll(): void` | Resets all inputs, results, stats, and disables export buttons |
| `setStatus` | `setStatus(text, cls): void` | Updates the Clean Filter status badge |
| `exportTxt` | `exportTxt(items, type): void` | Downloads results as `.txt` (one IOC per line) with timestamped filename |
| `exportCsv` | `exportCsv(items, type): void` | Downloads results as `.csv` with `Indicator, Type` headers |

---

### `app-worker.js` — Web Worker for Background Parsing

A dedicated Web Worker that parses files in a background thread to prevent UI freezing on large datasets.

| Handler | Description |
|---|---|
| `self.onmessage` | Receives `{file, extension}`. For Excel files, uses SheetJS to convert to CSV. Processes text in 1MB chunks using `IOCParser.parse()`. Sends `progress` messages during processing and a `done` message with the final deduplicated IOC array. |

#### Message Protocol
| Direction | Type | Data |
|---|---|---|
| Main → Worker | — | `{ file: File, extension: string }` |
| Worker → Main | `progress` | `number` (percentage 0-100) |
| Worker → Main | `done` | `string[]` (array of unique IOC values) |
| Worker → Main | `error` | `string` (error message) |

---

### `worker.js` — Cloudflare CORS Proxy

A Cloudflare Workers script that acts as a private CORS proxy to bypass corporate firewalls blocking direct VirusTotal API access.

| Feature | Description |
|---|---|
| **OPTIONS Preflight** | Responds with proper CORS headers (`Access-Control-Allow-Origin: *`) |
| **Request Proxying** | Forwards the request to the target URL (passed via `?url=` parameter) |
| **Header Sanitization** | Strips `origin` and `referer` headers to prevent VT rejection |
| **Response CORS Injection** | Attaches CORS headers to the proxied response |

See [PROXY-SETUP.md](PROXY-SETUP.md) for deployment instructions.

---

## 🛠️ Getting Started

### Prerequisites
- A modern browser (Chrome, Edge, Firefox, Safari)
- A **VirusTotal API Key** — [create a free account](https://www.virustotal.com/) and grab your v3 API key

### Quick Start

1. Visit the live deployment: [**IOC Hunter**](https://naseeeeef.github.io/ioc-hunter/)
2. Click **API Settings** (gear icon, top-right)
3. Paste your VirusTotal API key
4. Select your API tier (Free / Standard / Premium)
5. *(Optional)* Paste a custom CORS proxy URL if behind a corporate firewall
6. Click **Save & Close**

### Running Locally

```bash
# Clone the repository
git clone https://github.com/naseeeeef/ioc-hunter.git
cd ioc-hunter

# Serve with any static file server
npx serve .
# or
python -m http.server 8000
```

> **Note:** The app is fully static HTML/CSS/JS — no build step or `npm install` required. ES Modules require a local server (not `file://`).

### Usage — VT Scan Tab
1. Upload a threat IOC file (`.txt`, `.csv`, `.xlsx`) **or** paste IOCs into the textarea
2. *(Optional)* Upload a Company Asset File as your internal baseline
3. Click **Start Scan** — the engine processes each IOC with rate-limited VT API calls
4. Review results in the table — filter by verdict, match status, or search by IOC
5. Export results as CSV or JSON

### Usage — Clean Filter Tab
1. Switch to the **Clean Filter** tab
2. Upload/paste your threat IOC list
3. *(Optional)* Upload a Company Asset baseline file
4. Click **Clean IOCs** — the engine deduplicates and splits the list
5. Copy or export the clean/removed lists

---

## 🛡️ Corporate Proxy Setup

If your corporate firewall blocks CORS requests to VirusTotal, deploy a private Cloudflare Workers proxy in under 2 minutes — completely free.

👉 **Full guide:** [PROXY-SETUP.md](PROXY-SETUP.md)

**Quick steps:**
1. Create a [Cloudflare Workers](https://workers.cloudflare.com/) account
2. Create a new Worker, paste the code from `worker.js`
3. Deploy and copy the URL (e.g., `https://vt-proxy.yourname.workers.dev/`)
4. Paste the URL into **API Settings → Custom Proxy URL** in the app

---

## 🔒 Privacy & Security

IOC Hunter is explicitly engineered for **extreme privacy**:

| Principle | Implementation |
|---|---|
| **100% Client-Side** | No backend, no analytics, no trackers. Your data never leaves your browser. |
| **Local-Only Baselines** | Company asset files are parsed into an in-memory `Set`. Never transmitted anywhere. |
| **API Exfiltration Guard** | Only external, non-private indicators are sent to VirusTotal. Private IPs and trusted domains are filtered before any API call. |
| **localStorage Only** | API key, proxy URL, tier, and baseline data stored exclusively in browser `localStorage`. |
| **No Cookies** | Zero cookies. Zero third-party scripts. |

---

## 💻 Tech Stack

| Technology | Purpose |
|---|---|
| **JavaScript ES6 Modules** | Modular architecture with `import`/`export` |
| **HTML5** | Semantic markup, Web APIs (`FileReader`, `Clipboard`, `Blob`) |
| **CSS3 Glassmorphism** | Custom design system with CSS variables, no frameworks |
| **SheetJS (XLSX)** | Client-side Excel file parsing (CDN-loaded) |
| **VirusTotal v3 REST API** | Threat intelligence lookups for IPs and domains |
| **Cloudflare Workers** | Optional serverless CORS proxy for enterprise environments |
| **Web Workers** | Background thread file processing for large datasets |
| **Google Fonts (Inter)** | Modern typography |

---

## 📄 License

This project is licensed under the **MIT License**.
