/**
 * parser.js
 * Extracts and deduplicates valid IPv4, IPv6, and domain indicators
 * from arbitrary text. Ignores timestamps, hashes, emails, and raw URLs.
 */
import { Normalizer } from './normalizer.js';

// IPv4 regex — strict octet boundaries
const IPV4_RE = /\b((?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))\b/g;

// IPv6 regex — covers full and compressed forms
const IPV6_RE = /\b((?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}|[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,4}[0-9a-fA-F]{1,4})\b/g;

// Domain regex — simple label.tld pattern, avoids ReDoS
// Only matches label chars + TLD of 2-24 alpha chars
const DOMAIN_RE = /\b([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+([a-zA-Z]{2,24})\b/g;

// Patterns to IGNORE — hashes (md5/sha1/sha256), emails
const HASH_RE = /^[a-fA-F0-9]{32,64}$/;
const EMAIL_RE = /@/;

// Common noise suffixes that aren't real TLDs in threat intel context
const NOISE_EXTENSIONS = new Set([
    'png','jpg','jpeg','gif','bmp','svg','ico','webp','mp4','mp3','pdf',
    'zip','rar','tar','gz','exe','dll','sys','log','tmp','bak','js','css',
    'html','htm','xml','json','yaml','yml','ini','cfg','conf','sh','bat','ps1'
]);

export class IOCParser {
    /**
     * Parse text into deduped {value, type} IOC objects.
     * @param {string} text - Raw (or pre-refanged) text
     * @returns {Array<{value: string, type: 'ip'|'ipv6'|'domain'}>}
     */
    static parse(text) {
        if (!text || typeof text !== 'string') return [];

        const clean = Normalizer.refang(text);
        const ips = new Set();
        const ipv6s = new Set();
        const domains = new Set();

        // 1. Extract IPv4
        for (const m of clean.matchAll(IPV4_RE)) {
            ips.add(Normalizer.normalizeIP(m[1]));
        }

        // 2. Extract IPv6
        for (const m of clean.matchAll(IPV6_RE)) {
            ipv6s.add(m[1].toLowerCase());
        }

        // 3. Extract domains — skip anything colliding with an IP or noise
        // We use a deduplicated text where IPs are already known
        for (const m of clean.matchAll(DOMAIN_RE)) {
            const raw = m[0];
            const tld = m[2].toLowerCase();

            // Skip noise file extensions
            if (NOISE_EXTENSIONS.has(tld)) continue;
            // Skip if it's an email address fragment
            if (EMAIL_RE.test(raw)) continue;
            // Skip if it looks like a hash
            if (HASH_RE.test(raw.replace(/\./g, ''))) continue;

            const normalized = Normalizer.normalizeDomain(raw);

            // Skip if it resolved to an IPv4 (pure numeric labels)
            if (/^\d+(\.\d+){3}$/.test(normalized)) continue;
            // Skip if it's in the known IP set
            if (ips.has(normalized)) continue;

            // Must have at least one letter in each label to be a real domain
            const labels = normalized.split('.');
            const allLabelsValid = labels.every(l => /[a-zA-Z]/.test(l) || /^\d+$/.test(l));
            if (!allLabelsValid) continue;

            domains.add(normalized);
        }

        const results = [];
        ips.forEach(v => results.push({ value: v, type: 'ip' }));
        ipv6s.forEach(v => results.push({ value: v, type: 'ipv6' }));
        domains.forEach(v => results.push({ value: v, type: 'domain' }));
        return results;
    }

    /**
     * Filter out known-benign and private indicators.
     */
    static filterBenign(iocs) {
        const PRIVATE_PREFIXES = ['10.', '192.168.', '127.', '0.', '169.254.', '172.16.', '172.17.',
            '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.',
            '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.'];
        const BENIGN_DOMAINS = new Set(['google.com','microsoft.com','amazon.com','cloudflare.com',
            'apple.com','github.com','akamai.net','twitter.com','linkedin.com','facebook.com']);
        const INTERNAL_SUFFIXES = ['.local','.internal','.lan','.corp', '.home'];

        return iocs.filter(ioc => {
            if (ioc.type === 'ip') {
                return !PRIVATE_PREFIXES.some(p => ioc.value.startsWith(p));
            }
            if (ioc.type === 'domain') {
                const d = ioc.value;
                if (BENIGN_DOMAINS.has(d)) return false;
                if (INTERNAL_SUFFIXES.some(s => d.endsWith(s))) return false;
            }
            return true;
        });
    }
}
