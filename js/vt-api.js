/**
 * Handle API interactions with VirusTotal v3 Public API
 */
export class VTApi {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://www.virustotal.com/api/v3';
    }

    /**
     * Check an IOC against VirusTotal
     * @param {string} ioc - The IP or Domain
     * @param {'ip'|'domain'} type 
     * @returns {Promise<Object>} Formatted result object
     */
    async scanIoc(ioc, type) {
        const targetUrl = type === 'ip' ? `${this.baseUrl}/ip_addresses/${ioc}` : `${this.baseUrl}/domains/${ioc}`;
        
        // Use multiple fallback CORS proxies, just in case one is down or blocked by an adblocker
        // The final fallback is a direct connection (targetUrl), which requires a "CORS Unblock" browser extension.
        const endpoints = [
            `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
            `https://thingproxy.freeboard.io/fetch/${targetUrl}`,
            targetUrl 
        ];

        let lastError = null;

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {
                    method: 'GET',
                    headers: {
                        'x-apikey': this.apiKey,
                        'Accept': 'application/json'
                    }
                });

                if (response.status === 429) throw new Error('RATE_LIMIT');
                if (response.status === 403) throw new Error('FORBIDDEN');
                if (response.status === 404) return this._formatEmptyResponse(ioc, type);
                if (!response.ok) throw new Error(`HTTP_${response.status}`);

                const data = await response.json();
                return this._formatResponse(ioc, type, data);
            } catch (error) {
                // If the error is explicitly rate limiting or forbidden, bubble it up immediately
                if (error.message === 'RATE_LIMIT' || error.message === 'FORBIDDEN') {
                    throw error;
                }
                console.warn(`Proxy ${endpoint} failed for ${ioc}:`, error);
                lastError = error;
                // Move to the next proxy in the array...
            }
        }
        
        console.error(`All CORS proxies failed for ${ioc}:`, lastError);
        throw lastError; // Rethrow to let queue handler manage delays etc
    }

    _formatResponse(ioc, type, jsonData) {
        if (!jsonData || !jsonData.data || !jsonData.data.attributes) {
            return this._formatEmptyResponse(ioc, type);
        }

        const attr = jsonData.data.attributes;
        const stats = attr.last_analysis_stats || { malicious: 0, suspicious: 0, harmless: 0, undetected: 0 };
        
        // Tags - Get up to 3 community tags if available
        let tags = [];
        if (attr.tags && Array.isArray(attr.tags)) {
            tags = attr.tags.slice(0, 3);
        }

        // Determine Verdict
        let verdict = 'CLEAN';
        if (stats.malicious > 0) {
            verdict = 'MALICIOUS';
        } else if (stats.suspicious > 0) {
            verdict = 'SUSPICIOUS';
        }

        // Country and ISP
        const country = attr.country || 'Unknown';
        const isp = attr.as_owner || (type === 'domain' ? this._extractDomainRegistry(attr) : 'Unknown ISP');

        return {
            ioc,
            type,
            verdict,
            malicious: stats.malicious,
            suspicious: stats.suspicious,
            harmless: stats.harmless + stats.undetected,
            country,
            isp,
            tags
        };
    }

    _extractDomainRegistry(attr) {
        // Fallback for domains to show Registrar if ISP is empty
        return attr.registrar || 'Unknown Registrar';
    }

    _formatEmptyResponse(ioc, type) {
        return {
            ioc,
            type,
            verdict: 'CLEAN',
            malicious: 0,
            suspicious: 0,
            harmless: 0,
            country: 'Unknown',
            isp: 'Unknown',
            tags: ['Not Found']
        };
    }
}
