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

export class IOCParser {
    /**
     * Parse text and return unique IPs and Domains
     * @param {string} text - Raw input text from textarea or file
     * @returns {Array<{value: string, type: 'ip' | 'domain'}>} List of parsed and deduped IOCs
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

        // 2. Extract IPs from cleaned text
        const ipMatches = cleanedText.match(ipv4Regex);
        if (ipMatches) {
            ipMatches.forEach(ip => {
                const trimmedIp = ip.trim();
                if (trimmedIp) ips.add(trimmedIp);
            });
        }

        // 3. Extract Domains and convert URLs to Hostnames
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
                        // Fallback: take only the part before first slash or query param
                        d = d.replace(/^(https?:\/\/)/, '');
                        d = d.split(/[/?#]/)[0];
                    }
                }
                
                // Normalization: Strip 'www.' to ensure 'www.google.com' and 'google.com' are identical
                if (d.startsWith('www.')) {
                    d = d.substring(4);
                }

                // Final cleanup: Remove any trailing dots
                d = d.replace(/\.+$/, '');

                // Validation: 
                // - Ensure it's not an IP (Set handled)
                // - Ensure it has a dot (valid domain structure)
                // - Ensure no brackets/parentheses remained
                if (d && !ips.has(d) && !d.includes('@') && d.includes('.') && 
                    !d.includes('[') && !d.includes(']') && !d.includes('(') && !d.includes(')')) {
                    domains.add(d);
                }
            });
        }

        // Format unique results
        const results = [];
        
        ips.forEach(ip => {
            results.push({ value: ip, type: 'ip' });
        });
        
        domains.forEach(domain => {
            results.push({ value: domain, type: 'domain' });
        });

        return results;
    }
}
