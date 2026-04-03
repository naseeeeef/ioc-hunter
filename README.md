# Bulk IOC Hunter — Internal Exposure & Correlation Engine

Bulk IOC Hunter is a modern, client-side web application designed for SOC analysts, threat hunters, and security researchers. It allows you to rapidly extract, normalize, and scan thousands of Indicators of Compromise (IOCs) such as IPs and domains against the VirusTotal v3 API. 

It specifically introduces **Local Company Baseline Correlation** — automatically comparing threat feeds against your own internal network assets fully offline within the browser, without ever transmitting your sensitive infrastructure list to a third-party server.

## 🚀 Key Features

### Powerful Indicator Processing
- **Smart Parsing & Extraction**: Paste massive threat feeds or upload files (**Excel (.xlsx, .xls)**, CSV, Text, Logs). The engine strictly extracts IPs and Domains, ignoring dates, hashes, and conversational noise.
- **Advanced Normalization**: Automatically refangs indicators (e.g., `8.8[.]8[.]8` → `8.8.8.8`, `hxxps://evil.com/payload` → `evil.com`).
- **Benign & Private IP Filtering**: Built-in intelligence drops private RFC1918 IPs (e.g., `10.x.x.x`, `192.168.x.x`) and trusted domains (e.g., `google.com`, `.local`), preserving your API quota.

### Asynchronous Scanning 
- **Continuous Queueing**: Dynamic append logistics let you inject new IOCs into the queue even while a scan is running.
- **Configurable Rate Limiting**: Maximize efficiency by adjusting API request speed tiers (from `15s` delay down to `0.5s` Premium Burst).
- **Real-Time Progress**: Track live execution via a visual progress bar and numerical `Processed / Total` indicator.

### Company Asset Correlation 🔒
- **Offline Baseline Matching**: Upload a massive list of your known internal IPs and corporate domains into the **Company Asset File** drop zone. The frontend parses this into an in-memory hash map. 
- Any threat feed indicator that strikes a match against your baseline immediately flags as a **Match (⚠ Exposed)**. Your baseline file is **never** sent over the internet.

### Output & Reporting
- **Filtering & Search**: Quickly pivot results by finding exactly what matches the baseline ("Matched Only") or filter by strict "Malicious" verdicts.
- **Data Export**: Dump your final correlated results seamlessly into JSON or formatted CSV for your internal SIEM or reporting pipelines.

---

## 🛠️ Getting Started

### Prerequisites
You must have a **VirusTotal API Key**.
- Create a free account at [VirusTotal](https://www.virustotal.com/) and grab a v3 API key.

### Initialization
1. Visit the live deployment: [**Bulk IOC Hunter**](https://naseeeeef.github.io/ioc-hunter/)
2. Open the **API Settings** panel (top right).
3. Paste your VirusTotal API key. *(Note: Config is securely saved entirely traversing `localStorage`).*
4. Adjust your API Request limit based on your account tier. Close the settings window.
5. Provide your data and click **Start Scan**.

---

## 🛡️ Corporate Proxy Setup (Bypassing Firewalls)

Using this in a strict SOC environment might result in browser standard CORS request blocks. Installing random extensions to circumvent CORS is dangerous and often blocked by enterprise policies.

**The Solution:** Deploy a secure, serverless private proxy in 2 minutes.
See the [**PROXY-SETUP.md**](PROXY-SETUP.md) setup guide to learn how to deploy the included `worker.js` to Cloudflare Workers for free. Plug the resulting endpoint into the Custom Proxy URL field in your settings.

---

## 🔒 Privacy & Architecture

Bulk IOC Hunter is explicitly built for extreme privacy.
* **100% Client-Side UI**: Your data lives only on your CPU. No tracker servers, no analytics, no backend storage.
* **In-Memory Correlation**: The Company Baseline file processes completely locally on the frontend DOM logic. 
* **API Exfiltration Guarding**: Only external, non-private resolved indicators are bundled and pushed to the VirusTotal APIs.

## 💻 Tech Stack
- **JavaScript (ES6 Modules)**: Engineered for multi-threading and async processing.
- **CSS3 Glassmorphism**: Tailored, no-framework Custom UI tokens.
- **HTML5 Web APIs**: Local FileReader and matching APIs.
- **VirusTotal v3 REST API**

## 📄 License
This project is licensed under the MIT License.
