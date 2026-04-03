import * as XLSX from 'https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs';
import { IOCParser } from './parser.js';

self.onmessage = async (e) => {
    const { file, extension } = e.data;
    
    try {
        let text = '';
        if (extension === 'xlsx' || extension === 'xls') {
            const data = new Uint8Array(await file.arrayBuffer());
            const workbook = XLSX.read(data, { type: 'array' });
            workbook.SheetNames.forEach(sheetName => {
                text += XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]) + '\n';
            });
        } else {
            text = await file.text();
        }

        // Now process text efficiently without blocking the OS since we are in a background thread
        const iocs = new Set();
        
        // We use string-based progression instead of heavy split to avoid V8 out-of-memory
        let position = 0;
        while (position < text.length) {
            let nextPos = position + 1000000; // Chunk ~1MB
            if (nextPos < text.length) {
                let newlineIdx = text.indexOf('\n', nextPos);
                if (newlineIdx !== -1 && newlineIdx - nextPos < 5000) {
                    nextPos = newlineIdx;
                }
            } else {
                nextPos = text.length;
            }

            let chunkText = text.substring(position, nextPos);
            const parsed = IOCParser.parse(chunkText);
            parsed.forEach(p => iocs.add(p.value));

            position = nextPos;
            let percentage = Math.round((position / text.length) * 100);
            
            self.postMessage({ type: 'progress', data: percentage });
        }

        // Convert set to array and send back
        self.postMessage({ type: 'done', data: Array.from(iocs) });

    } catch (err) {
        self.postMessage({ type: 'error', data: err.message });
    }
};
