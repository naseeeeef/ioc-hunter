/**
 * normalizer.js
 * Refangs and normalizes raw IOC text before extraction.
 */

export class Normalizer {
    /**
     * Refang obfuscated indicators and normalize the text block.
     * @param {string} raw - Raw text input
     * @returns {string} - Cleaned text ready for extraction
     */
    static refang(raw) {
        if (!raw || typeof raw !== 'string') return '';
        return raw
            // Brackets around dots: 1.1[.]1[.]1 → 1.1.1.1
            .replace(/\[\.\]/g, '.')
            .replace(/\(\.\)/g, '.')
            // [dot] / (dot)
            .replace(/\[dot\]/gi, '.')
            .replace(/\(dot\)/gi, '.')
            // Brackets around colons: hxxp[:]// → hxxp://
            .replace(/\[:\]/g, ':')
            .replace(/\(:\)/g, ':')
            // hxxp / hxxps → http / https
            .replace(/\bhxxps?/gi, (m) => m.replace(/hxxp/i, 'http'))
            // [at] / (at) → @
            .replace(/\[at\]/gi, '@')
            .replace(/\(at\)/gi, '@')
            // Remove zero-width spaces and BOM
            .replace(/[\u200B\uFEFF]/g, '');
    }

    /**
     * Normalize a single extracted domain value.
     * Strips www prefix, trailing dots, lowercases.
     * @param {string} domain
     * @returns {string}
     */
    static normalizeDomain(domain) {
        let d = domain.toLowerCase().trim();
        if (d.startsWith('www.')) d = d.substring(4);
        d = d.replace(/\.+$/, '');
        return d;
    }

    /**
     * Normalize a single IP address.
     * @param {string} ip
     * @returns {string}
     */
    static normalizeIP(ip) {
        return ip.trim();
    }
}
