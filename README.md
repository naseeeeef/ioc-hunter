# Bulk IOC Hunter

Bulk IOC Hunter is a modern, responsive web application designed for security analysts and researchers to quickly scan large lists of Indicators of Compromise (IOCs) such as IP addresses and domains against the VirusTotal v3 API. 

## Features

- **Bulk Processing**: Paste large lists of IOCs or upload files (**Excel (.xlsx, .xls)**, CSV, or Text) to scan hundreds of indicators at once.
- **Advanced Normalization**: Automatically refangs security-obfuscated indicators (e.g., `8.8[.]8[.]8` → `8.8.8.8`, `example(dot)com` → `example.com`).
- **Smart Parsing**: Strictly extracts only **IP Addresses** and **Domains**. It automatically ignores dates, hashes, and other irrelevant metadata found in raw threat reports.
- **URL to Domain Conversion**: If a full URL is provided (e.g., `https://malicious.rocks/payload`), the tool automatically extracts only the clean domain (`malicious.rocks`).
- **VirusTotal Implementation**: Queries the VirusTotal v3 Public API and displays comprehensive results including stats, country, ISP, and community tags.
- **Configurable API Speed**: Choose your API tier (Free vs Premium) to optimize scanning speed from 15s delay down to **0.5s per request**.
- **Pause & Resume**: Easily pause and resume large scans without losing your progress.
- **Filtering & Search**: Quickly filter results by verdict (Malicious, Suspicious, Clean, Unknown) or search for specific IOCs.
- **Export Data**: Export your detailed scan results to CSV or JSON formats for reporting or further analysis.
- **Modern UI/UX**: Features a sleek, dark-themed interface with real-time progress tracking, visual badges, and glassmorphism design.
- **Mobile Responsive**: Fully optimized for mobile screens, allowing analysts to check IOCs on the go.
- **Corporate Firewall Bypass**: Built-in support for custom private proxies (like Cloudflare Workers) to bypass strict Enterprise SIEM filters.

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
