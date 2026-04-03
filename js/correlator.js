/**
 * correlator.js
 * Compares the threat IOC dataset against the company asset baseline.
 * All processing is 100% local — company data never leaves the browser.
 */

export class Correlator {
    /**
     * Build a fast lookup Set from parsed company IOCs.
     * @param {Array<{value: string, type: string}>} companyIocs
     * @returns {Set<string>}
     */
    static buildBaseline(companyIocs) {
        const baseline = new Set();
        companyIocs.forEach(ioc => baseline.add(ioc.value.toLowerCase()));
        return baseline;
    }

    /**
     * For each threat IOC, flag if it exists in the company baseline.
     * @param {Array<{value: string, type: string}>} threatIocs
     * @param {Set<string>} baseline
     * @returns {Array<{value: string, type: string, isMatched: boolean}>}
     */
    static correlate(threatIocs, baseline) {
        return threatIocs.map(ioc => ({
            ...ioc,
            isMatched: baseline.has(ioc.value.toLowerCase())
        }));
    }

    /**
     * Return only the IOCs that matched the company baseline.
     * These are the ONLY ones that should be sent to VirusTotal.
     * @param {Array<{value: string, type: string, isMatched: boolean}>} correlated
     * @returns {Array}
     */
    static getMatched(correlated) {
        return correlated.filter(ioc => ioc.isMatched);
    }

    /**
     * Return IOCs that did NOT match the baseline.
     * @param {Array} correlated
     * @returns {Array}
     */
    static getUnmatched(correlated) {
        return correlated.filter(ioc => !ioc.isMatched);
    }
}
