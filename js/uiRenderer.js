/**
 * uiRenderer.js
 * Renders and manages the results table, summary cards and export UI.
 * Completely decoupled from business logic.
 */

export class UIRenderer {
    constructor(bodyId) {
        this.tbody = document.getElementById(bodyId);
    }

    /**
     * Render an array of result objects into the table.
     * @param {VTResult[]} results
     * @param {{filter: string, search: string}} opts
     */
    render(results, opts = {}) {
        const { filter = 'ALL', search = '' } = opts;
        const q = search.toLowerCase();

        const filtered = results.filter(r => {
            const matchSearch = !q || r.ioc.toLowerCase().includes(q);
            let matchFilter = true;
            if (filter === 'ALL_MATCHES')   matchFilter = r.isMatched;
            if (filter === 'RISKY_MATCHES') matchFilter = r.isMatched && (r.verdict === 'MALICIOUS' || r.verdict === 'SUSPICIOUS');
            if (filter === 'MALICIOUS')     matchFilter = r.isMatched && r.verdict === 'MALICIOUS';
            if (filter === 'SUSPICIOUS')    matchFilter = r.isMatched && r.verdict === 'SUSPICIOUS';
            // filter === 'ALL' → matchFilter stays true (show everything)
            return matchSearch && matchFilter;
        });

        this.tbody.innerHTML = '';

        if (!filtered.length) {
            const msg = results.length === 0 ? 'No results yet. Upload files and start scanning.' : 'No results match your filters.';
            this.tbody.innerHTML = `
                <tr class="empty-state-row">
                    <td colspan="8" class="empty-state">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="opacity:0.25;margin-bottom:8px">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                        <p>${msg}</p>
                    </td>
                </tr>`;
            return;
        }

        const frag = document.createDocumentFragment();
        filtered.forEach(r => frag.appendChild(this._buildRow(r)));
        this.tbody.appendChild(frag);
    }

    _buildRow(r) {
        const tr = document.createElement('tr');
        if (r.isMatched) tr.classList.add('row-matched');

        const badgeMap = { MALICIOUS: 'badge-malicious', SUSPICIOUS: 'badge-suspicious', CLEAN: 'badge-clean' };
        const badgeClass = badgeMap[r.verdict] || 'badge-unknown';
        const vtScore = `${r.malicious + r.suspicious} / ${r.malicious + r.suspicious + r.harmless}`;
        const matchBadge = r.isMatched
            ? `<span class="match-badge match-yes">⚠ Exposed</span>`
            : `<span class="match-badge match-no">— No Match</span>`;

        const vtType = (r.type === 'ip' || r.type === 'ipv6') ? 'ip-address' : 'domain';
        const vtLink = `https://www.virustotal.com/gui/${vtType}/${r.ioc}`;

        tr.innerHTML = `
            <td><strong class="ioc-value">${r.ioc}</strong></td>
            <td><span class="badge type-badge">${r.type.toUpperCase()}</span></td>
            <td><span class="badge ${badgeClass}">${r.verdict}</span></td>
            <td class="vt-score">${vtScore}</td>
            <td>${r.country}</td>
            <td class="isp-cell">${r.isp}</td>
            <td>${matchBadge}</td>
            <td>
                <a href="${vtLink}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">VT</a>
            </td>`;
        return tr;
    }

    /**
     * Export matched results to CSV.
     */
    static exportCSV(results) {
        const rows = results.filter(r => r.isMatched);
        if (!rows.length) { alert('No matched results to export.'); return; }

        const headers = ['Indicator','Type','Verdict','VT Score','Country','ISP','Match Status'];
        const lines = rows.map(r => {
            const score = `${r.malicious + r.suspicious}/${r.malicious + r.suspicious + r.harmless}`;
            return [r.ioc, r.type, r.verdict, score, r.country, r.isp, r.isMatched ? 'Matched' : 'Not Matched']
                .map(v => `"${String(v).replace(/"/g, '""')}"`)
                .join(',');
        });

        const csv = [headers.join(','), ...lines].join('\n');
        UIRenderer._download('text/csv', csv, 'exposure_matched.csv');
    }

    /**
     * Export matched results to JSON.
     */
    static exportJSON(results) {
        const rows = results.filter(r => r.isMatched);
        if (!rows.length) { alert('No matched results to export.'); return; }
        UIRenderer._download('application/json', JSON.stringify(rows, null, 2), 'exposure_matched.json');
    }

    static _download(mimeType, content, filename) {
        const blob = new Blob([content], { type: mimeType });
        const url  = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    }
}
