/**
 * Extracts and deduplicates IP Addresses and Domains from arbitrary text.
 * Uses exact regex matching to avoid false positives.
 */

// Regex for IPv4
const ipv4Regex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

// Regex for basic domain matching (excludes IPs and protocol handlers)
// Validates common TLDs to avoid matching random sentences
const domainRegex = /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,24}\b/g;

export class IOCParser {
    /**
     * Parse text and return unique IPs and Domains
     * @param {string} text - Raw input text from textarea or file
     * @returns {Array<{value: string, type: 'ip' | 'domain'}>} List of parsed and deduped IOCs
     */
    static parse(text) {
        if (!text || typeof text !== 'string') return [];

        const ips = new Set();
        const domains = new Set();

        // 1. Extract IPs
        const ipMatches = text.match(ipv4Regex);
        if (ipMatches) {
            ipMatches.forEach(ip => ips.add(ip));
        }

        // 2. Extract Domains
        const domainMatches = text.match(domainRegex);
        if (domainMatches) {
            domainMatches.forEach(domain => {
                const lowerDomain = domain.toLowerCase();
                // Ensure the matched domain is not already categorized as an IP
                if (!ips.has(lowerDomain) && !lowerDomain.startsWith('www.') && !lowerDomain.includes('@')) {
                    domains.add(lowerDomain);
                } else if (lowerDomain.startsWith('www.')) {
                    // strip www if present
                    domains.add(lowerDomain.replace('www.', ''));
                }
            });
        }

        // Format results
        const results = [];
        
        ips.forEach(ip => {
            results.push({ value: ip, type: 'ip' });
        });
        
        domains.forEach(domain => {
            if (!ips.has(domain)) { // ultimate safety check
               results.push({ value: domain, type: 'domain' });
            }
        });

        return results;
    }
}
