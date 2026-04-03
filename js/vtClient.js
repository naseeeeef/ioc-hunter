/**
 * vtClient.js
 * Handles all VirusTotal v3 API communication with CORS proxy fallbacks and caching.
 */

export class VTClient {
    /**
     * @param {string} apiKey - VirusTotal API Key
     * @param {string} [proxyUrl] - Optional custom CORS proxy URL
     */
    constructor(apiKey, proxyUrl = '') {
        this.apiKey = apiKey;
        this.proxyUrl = proxyUrl;
        this.baseUrl = 'https://www.virustotal.com/api/v3';
        // In-memory LRU-style cache: key → result
        this.cache = new Map();
    }

    /**
     * Lookup a single IOC. Returns cached result if available.
     * @param {string} value - The IP or domain
     * @param {'ip'|'ipv6'|'domain'} type
     * @returns {Promise<VTResult>}
     */
    async lookup(value, type) {
        const cacheKey = `${type}:${value}`;
        if (this.cache.has(cacheKey)) {
            return { ...this.cache.get(cacheKey), fromCache: true };
        }

        const path = type === 'ip' || type === 'ipv6'
            ? `/ip_addresses/${encodeURIComponent(value)}`
            : `/domains/${encodeURIComponent(value)}`;

        const targetUrl = this.baseUrl + path;
        const endpoints = this._buildEndpoints(targetUrl);

        let lastError = null;
        for (const endpoint of endpoints) {
            try {
                const res = await fetch(endpoint, {
                    method: 'GET',
                    headers: { 'x-apikey': this.apiKey, 'Accept': 'application/json' }
                });
                if (res.status === 429) throw new Error('RATE_LIMIT');
                if (res.status === 403) throw new Error('FORBIDDEN');
                if (res.status === 404) {
                    const r = this._empty(value, type);
                    this.cache.set(cacheKey, r);
                    return r;
                }
                if (!res.ok) throw new Error(`HTTP_${res.status}`);

                const json = await res.json();
                const result = this._format(value, type, json);
                this.cache.set(cacheKey, result);
                return result;
            } catch (err) {
                if (err.message === 'RATE_LIMIT' || err.message === 'FORBIDDEN') throw err;
                lastError = err;
            }
        }
        throw lastError || new Error('All proxies failed');
    }

    _buildEndpoints(targetUrl) {
        const endpoints = [];
        if (this.proxyUrl) {
            const p = this.proxyUrl.trim();
            if (p.endsWith('=')) {
                endpoints.push(`${p}${encodeURIComponent(targetUrl)}`);
            } else {
                endpoints.push(`${p}${p.includes('?') ? '&' : '?'}url=${encodeURIComponent(targetUrl)}`);
            }
        }
        endpoints.push(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);
        endpoints.push(targetUrl); // direct fallback (needs browser extension)
        return endpoints;
    }

    _format(value, type, json) {
        const attr = json?.data?.attributes;
        if (!attr) return this._empty(value, type);

        const stats = attr.last_analysis_stats || {};
        const malicious  = stats.malicious  || 0;
        const suspicious = stats.suspicious || 0;
        const harmless   = (stats.harmless  || 0) + (stats.undetected || 0);

        let verdict = 'CLEAN';
        if (malicious > 0)  verdict = 'MALICIOUS';
        else if (suspicious > 0) verdict = 'SUSPICIOUS';

        return {
            ioc:        value,
            type,
            verdict,
            malicious,
            suspicious,
            harmless,
            country:    attr.country    || 'Unknown',
            isp:        attr.as_owner  || attr.registrar || 'Unknown',
            tags:       (attr.tags || []).slice(0, 3),
            isMatched:  false,  // will be set by correlator
            fromCache:  false
        };
    }

    _empty(value, type) {
        return {
            ioc: value, type,
            verdict: 'CLEAN',
            malicious: 0, suspicious: 0, harmless: 0,
            country: 'Unknown', isp: 'Unknown',
            tags: ['Not Found'], isMatched: false, fromCache: false
        };
    }
}
