/**
 * Extracts and deduplicates IP Addresses and Domains from arbitrary text.
 * Uses exact regex matching to avoid false positives.
 */

// Regex for IPv4 - Slightly more permissive on boundaries to handle CSV mashups
const ipv4Regex = /(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g;

// Regex for basic domain matching (excludes IPs and protocol handlers)
// Validates common TLDs to avoid matching random sentences
// Regex for basic domain matching - More permissive on boundaries
const domainRegex = /(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,24}/g;

// Regex for SHA256 (64 hex)
const sha256Regex = /\b[A-Fa-f0-9]{64}\b/g;
// Regex for SHA1 (40 hex)
const sha1Regex = /\b[A-Fa-f0-9]{40}\b/g;
// Regex for MD5 (32 hex)
const md5Regex = /\b[A-Fa-f0-9]{32}\b/g;

export class IOCParser {
    /**
     * Parse text and return unique IPs, Domains, and Hashes
     * @param {string} text - Raw input text from textarea or file
     * @returns {Array<{value: string, type: 'ip' | 'domain' | 'hash'}>} List of parsed and deduped IOCs
     */
    static parse(text) {
        if (!text || typeof text !== 'string') return [];

        // 1. Refang the text first (standard security obfuscation removal)
        let cleanedText = text
            .replace(/\[\.\]/g, '.')        // 8.8[.]8[.]8 -> 8.8.8.8
            .replace(/\(\.\)/g, '.')        // 8.8(.)8(.)8 -> 8.8.8.8
            .replace(/\[dot\]/gi, '.')      // example[dot]com
            .replace(/\(dot\)/gi, '.')      // example(dot)com
            .replace(/\[:\]/g, ':')         // hxxp[:]// -> hxxp://
            .replace(/\(:\)/g, ':')         // hxxp(:)// -> hxxp://
            .replace(/\bhxxp/gi, 'http')    // hxxp -> http
            .replace(/\[at\]/gi, '@')       // example[at]gmail[.]com
            .replace(/\(at\)/gi, '@');

        const ips = new Set();
        const domains = new Set();
        const hashes = new Set();

        // 2. Extract IPs from cleaned text
        const ipMatches = cleanedText.match(ipv4Regex);
        if (ipMatches) {
            ipMatches.forEach(ip => {
                const trimmedIp = ip.trim();
                // Basic validation to ensure it's not part of a larger hash or string
                if (trimmedIp && /^\d{1,3}(\.\d{1,3}){3}$/.test(trimmedIp)) {
                    ips.add(trimmedIp);
                }
            });
        }

        // 3. Extract Hashes
        [sha256Regex, sha1Regex, md5Regex].forEach(regex => {
            const matches = cleanedText.match(regex);
            if (matches) {
                matches.forEach(hash => hashes.add(hash.toLowerCase()));
            }
        });

        // 4. Extract Domains and convert URLs to Hostnames
        const domainMatches = cleanedText.match(domainRegex);
        if (domainMatches) {
            domainMatches.forEach(match => {
                let d = match.toLowerCase().trim();
                
                // If it looks like a full URL, we only want the domain
                if (d.includes('://') || d.includes('/')) {
                    try {
                        const urlToParse = d.includes('://') ? d : 'http://' + d;
                        const url = new URL(urlToParse);
                        d = url.hostname;
                    } catch (e) {
                        d = d.replace(/^(https?:\/\/)/, '');
                        d = d.split(/[/?#]/)[0];
                    }
                }
                
                if (d.startsWith('www.')) d = d.substring(4);
                d = d.replace(/\.+$/, '');

                if (d && !ips.has(d) && !d.includes('@') && d.includes('.') && 
                    !d.includes('[') && !d.includes(']') && !d.includes('(') && !d.includes(')') &&
                    !/^[0-9.]+$/.test(d)) { // Extra check: not just numbers and dots
                    domains.add(d);
                }
            });
        }

        const results = [];
        ips.forEach(ip => results.push({ value: ip, type: 'ip' }));
        domains.forEach(domain => results.push({ value: domain, type: 'domain' }));
        hashes.forEach(hash => results.push({ value: hash, type: 'hash' }));

        return results;
    }

    /**
     * Filter iocs to remove common/benign items
     */
    static filterMalicious(iocs) {
        const benignDomains = ['google.com', 'microsoft.com', 'amazon.com', 'cloudflare.com', 'apple.com', 'twitter.com', 'facebook.com', 'linkedin.com', 'akamai.net', 'github.com'];
        const internalSuffixes = ['.local', '.internal', '.lan'];

        return iocs.filter(ioc => {
            if (ioc.type === 'ip') {
                const ip = ioc.value;
                // Exclude Private/Local Ranges
                if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip === '127.0.0.1') return false;
                if (ip.startsWith('172.')) {
                    const second = parseInt(ip.split('.')[1]);
                    if (second >= 16 && second <= 31) return false;
                }
                return true;
            }

            if (ioc.type === 'domain') {
                const d = ioc.value;
                if (benignDomains.some(b => d === b || d.endsWith('.' + b))) return false;
                if (internalSuffixes.some(s => d.endsWith(s))) return false;
                return true;
            }

            // Hashes are always kept (assume malicious unless baseline removes them)
            return true;
        });
    }
}
