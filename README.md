# Bulk IOC Hunter

Bulk IOC Hunter is a modern, responsive web application designed for security analysts and researchers to quickly scan large lists of Indicators of Compromise (IOCs) such as IP addresses and domains against the VirusTotal v3 API. 

## Features

- **Bulk Processing**: Paste a list of IOCs or upload a text file to scan hundreds of indicators at once.
- **Smart Parsing**: Automatically extracts IPs and domains using regex – no need to manually clean up your input data.
- **VirusTotal Integration**: Queries the VirusTotal v3 Public API for every indicator and displays comprehensive results.
- **Rate-Limit Handling**: Automatically manages and respects VirusTotal's API rate limits (e.g., waiting 15 seconds per request for Free Tier keys).
- **Pause & Resume**: Easily pause and resume large scans without losing your progress.
- **Filtering & Search**: Quickly filter results by verdict (Malicious, Suspicious, Clean, Unknown) or search for specific IOCs.
- **Export Data**: Export your detailed scan results to CSV or JSON formats for reporting or further analysis.
- **Modern UI/UX**: Features a sleek, dark-themed interface with real-time progress tracking, visual badges, and micro-animations.
- **Mobile Responsive**: Fully optimized for mobile screens, allowing analysts to check IOCs on the go.
- **Corporate Firewall Bypass**: Built-in support for custom private proxies (like Cloudflare Workers) to bypass strict Enterprise EDR and SIEM filters.

## Prerequisites

To use this application, you must have a **VirusTotal API Key**.
- You can get a free API key by signing up for an account at [VirusTotal](https://www.virustotal.com/).

## Getting Started

1. **Access the Application:**
   - Either visit the live GitHub Pages link: [Bulk IOC Hunter](https://naseeeeef.github.io/ioc-hunter/)
   - Or clone the repository locally: `git clone https://github.com/naseeeeef/ioc-hunter.git` and open `index.html`.
2. **Configure your API Key:**
   - On first launch, the application will prompt you to enter your VirusTotal API key. 
   - You can update your API key at any time by clicking the **Settings (Gear) Icon** in the top right corner. The key is securely stored in your browser's local storage.
3. **Scan IOCs:**
   - Paste your IOCs into the provided text area, or upload a file containing IOCs.
   - Click "Parse & Start Scan" and wait for the results!

## Corporate Proxy Setup (Bypassing Firewalls)

If you are using this tool in a SOC environment behind a strict corporate firewall, your browser's internal CORS requests might be blocked. Do not install browser extensions to bypass this, as it may alert your SIEM.

Instead, you can deploy the included `worker.js` script to Cloudflare Workers for free in about 2 minutes. This creates a secure, private proxy just for you. 
1. See the [PROXY-SETUP.md](PROXY-SETUP.md) file in this repository for an exact 3-step setup guide.
2. Once deployed, open the **Settings** menu in the IOC Hunter and paste your proxy URL into the **Custom Proxy URL** field. 

## Privacy & Security

- **API Key Storage**: Your VirusTotal API key is stored **locally** in your browser's `localStorage` and never sent anywhere except to the VirusTotal servers.
- **Client-Side Only**: All parsing and data processing occurs directly within your browser. 

## Technical Stack

- **HTML5** & **CSS3** (Custom modern styling, CSS variables, glassmorphism UI)
- **Vanilla JavaScript** (ES6 Modules)
- **VirusTotal API v3**

## License

This project is licensed under the MIT License - see the LICENSE file for details.
